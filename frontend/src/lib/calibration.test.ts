// @ts-nocheck (node:test types are not installed; this file only runs under node)
// Run: node --experimental-strip-types --test src/lib/calibration.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  levelFor,
  linesFor,
  reach,
  amountOf,
  calibrate,
  toCalibFile,
  loadCalibration,
  saveCalibration,
  BIG_FAMILIES,
  CAPACITY,
  type ProductCal,
} from './calibration.ts'

const pct = (threshold: number, level: ProductCal['level']): ProductCal => ({ mode: 'percent', threshold, level })
const units = (threshold: number, level: ProductCal['level']): ProductCal => ({ mode: 'units', threshold, level })

test('orange: 25% marked as full', () => {
  const c = pct(25, 'full')
  assert.deepEqual(linesFor('citrus_orange', c), { emptyMax: 10, fullMin: 25 })
  assert.equal(levelFor(0.25, 'citrus_orange', c), 'full')
  assert.equal(levelFor(1, 'citrus_orange', c), 'full')
  assert.equal(levelFor(0.11, 'citrus_orange', c), 'half')
  assert.equal(levelFor(0.1, 'citrus_orange', c), 'empty')
})

test('same marker as half: 25% is no longer empty, full stays at the model line', () => {
  const c = pct(25, 'half')
  assert.deepEqual(linesFor('citrus_orange', c), { emptyMax: 24, fullMin: 74 })
  assert.equal(levelFor(0.24, 'citrus_orange', c), 'empty')
  assert.equal(levelFor(0.25, 'citrus_orange', c), 'half')
  assert.equal(levelFor(0.74, 'citrus_orange', c), 'full')
})

test('same marker as empty', () => {
  const c = pct(25, 'empty')
  assert.deepEqual(linesFor('citrus_orange', c), { emptyMax: 25, fullMin: 62 })
  assert.equal(levelFor(0.25, 'citrus_orange', c), 'empty')
  assert.equal(levelFor(0.3, 'citrus_orange', c), 'half')
  assert.equal(levelFor(0.62, 'citrus_orange', c), 'full')
})

test('a half marker inside the model lines keeps them', () => {
  assert.deepEqual(linesFor('banana', pct(50, 'half')), { emptyMax: 30, fullMin: 74 })
})

test('big fruit is counted in pieces of its own crate', () => {
  assert.ok(BIG_FAMILIES.includes('melon') && BIG_FAMILIES.includes('cauliflower'))
  assert.equal(CAPACITY.melon, 3)
  assert.equal(amountOf(0.5, 'melon'), 2) // 1.5 pieces rounds up
  assert.equal(amountOf(0.4, 'melon'), 1)
  const c = units(2, 'full')
  assert.deepEqual(linesFor('melon', c), { emptyMax: 1, fullMin: 2 })
  assert.equal(levelFor(0.5, 'melon', c), 'full')
  assert.equal(levelFor(0.4, 'melon', c), 'empty')
  // one melon left marked as half: one piece is not empty any more
  assert.deepEqual(linesFor('melon', units(1, 'half')), { emptyMax: 0, fullMin: 2 })
  assert.equal(levelFor(0.3, 'melon', units(1, 'half')), 'half')
})

test('edge markers never contradict themselves or crash', () => {
  for (const level of ['empty', 'half', 'full'] as const) {
    for (const t of [0, 100, -5, 250, NaN]) {
      const { emptyMax, fullMin } = linesFor('banana', pct(t, level))
      assert.ok(emptyMax < fullMin)
      for (const f of [0, 0.5, 1, -1, 2, NaN]) {
        assert.ok(['empty', 'half', 'full'].includes(levelFor(f, 'banana', pct(t, level))))
      }
    }
  }
  assert.equal(levelFor(0, 'banana', pct(0, 'full')), 'full')
  assert.equal(levelFor(1, 'banana', pct(100, 'empty')), 'empty')
})

const state = () => ({
  images: { '6215': [{ image: '1.jpg', ts: 1 }] },
  areas: {
    '6215_1': { area_id: '6215_1', camera: '6215', index: 1, quad: [], family: 'citrus_orange', product_id: 'citrus_orange', catalog_id: '111', product_name: 'LARANJA KG' },
    '6215_2': { area_id: '6215_2', camera: '6215', index: 2, quad: [], family: 'banana', product_id: 'banana', catalog_id: '222', product_name: 'BANANA KG' },
    '6215_3': { area_id: '6215_3', camera: '6215', index: 3, quad: [], family: 'melon', product_id: 'melon', catalog_id: '333', product_name: 'MELAO KG' },
  },
  observations: {
    '6215': {
      '1.jpg': {
        '6215_1': { planogram_compliant: true, stock_level: 'empty', stock_value: 0.2 },
        '6215_2': { planogram_compliant: true, stock_level: 'half', stock_value: 0.5 },
        '6215_3': { planogram_compliant: false, stock_level: 'empty' },
      },
    },
  },
})

test('without markers the app shows exactly what the model said', () => {
  const s = state()
  assert.equal(calibrate(s, {}), s)
})

test('a marker changes only its own product, and only where there is a fill', () => {
  const s = calibrate(state(), { citrus_orange: pct(15, 'full'), melon: units(1, 'full') })
  const frame = s.observations['6215']['1.jpg']
  assert.equal(frame['6215_1'].stock_level, 'full') // 20% of oranges, marked full from 15%
  assert.equal(frame['6215_2'].stock_level, 'half') // banana has no marker
  assert.equal(frame['6215_3'].stock_level, 'empty') // no fill for this area: the model's level stays
  assert.equal(frame['6215_3'].planogram_compliant, false)
})

test('export writes the lines per catalogue product', () => {
  const f = toCalibFile({ citrus_orange: pct(25, 'full'), melon: units(2, 'full') }, state().areas)
  assert.equal(f.version, 1)
  assert.deepEqual(Object.keys(f.products).sort(), ['111', '333'])
  assert.deepEqual(f.products['111'], {
    name: 'LARANJA KG', unit: 'percent', capacity: null, points: [{ value: 25, level: 'full' }], empty_max: 10, full_min: 25,
  })
  assert.equal(f.products['333'].unit, 'count')
  assert.equal(f.products['333'].capacity, 3)
  assert.deepEqual([f.products['333'].empty_max, f.products['333'].full_min], [1, 2])
})

test('load/save without localStorage', () => {
  const saved = (globalThis as any).localStorage
  delete (globalThis as any).localStorage
  assert.deepEqual(loadCalibration(), {})
  assert.doesNotThrow(() => saveCalibration({}))
  if (saved) (globalThis as any).localStorage = saved
})

test('load/save round trip, bad JSON and bad entries', () => {
  const store = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  }
  const c = { melon: units(2, 'full') }
  saveCalibration(c)
  assert.deepEqual(loadCalibration(), c)
  store.set('strivon.calibration.v2', JSON.stringify({ melon: units(2, 'full'), kiwi: { threshold: 'x', level: 'full' } }))
  assert.deepEqual(loadCalibration(), c)
  store.set('strivon.calibration.v2', '{nope')
  assert.deepEqual(loadCalibration(), {})
  delete (globalThis as any).localStorage
})

test('lines out of reach are reported, and the export stays inside what the predictor accepts', () => {
  const areas = { a: { family: 'banana', catalog_id: 'p1' }, m: { family: 'melon', catalog_id: 'p2' } }
  // empty at the top: full can never be reached
  assert.equal(reach('banana', linesFor('banana', pct(100, 'empty'))).full, false)
  // full at 0: empty can never be reached (0 counts as full)
  assert.equal(reach('banana', linesFor('banana', pct(0, 'full'))).empty, false)
  // whole pieces: nothing between 1 and 2
  assert.equal(reach('melon', { emptyMax: 1, fullMin: 2 }).half, false)
  assert.equal(reach('melon', { emptyMax: 0, fullMin: 3 }).half, true)
  for (const level of ['empty', 'half', 'full'] as const) {
    for (const [fam, id, top] of [['banana', 'p1', 100], ['melon', 'p2', 3]] as const) {
      for (const v of [0, 1, top - 1, top]) {
        const p = toCalibFile({ [fam]: { mode: 'percent', threshold: v, level } }, areas).products[id]
        assert.ok(p.empty_max >= 0 && p.empty_max < p.full_min && p.full_min <= top, `${fam} ${level} ${v}`)
        for (const pt of p.points) {
          if (pt.level === 'half') assert.ok(p.empty_max < pt.value && pt.value < p.full_min)
        }
      }
    }
  }
})
