// @ts-nocheck (node:test types are not installed; this file only runs under node)
// Run: node --experimental-strip-types --test src/lib/calibration.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  levelFor,
  defaultCalibration,
  loadCalibration,
  saveCalibration,
  BIG_FAMILIES,
  type ProductCal,
} from './calibration.ts'

const pct = (threshold: number, level: ProductCal['level']): ProductCal => ({ mode: 'percent', threshold, level })

test('orange: 25% marked as full', () => {
  const c = pct(25, 'full')
  assert.equal(levelFor(0.25, c), 'full')
  assert.equal(levelFor(0.1, c), 'half')
  assert.equal(levelFor(0.05, c), 'empty')
  assert.equal(levelFor(1, c), 'full')
})

test('same marker as half', () => {
  const c = pct(25, 'half')
  assert.equal(levelFor(0.05, c), 'empty')
  assert.equal(levelFor(0.25, c), 'half')
  assert.equal(levelFor(0.7, c), 'full')
})

test('same marker as empty', () => {
  const c = pct(25, 'empty')
  assert.equal(levelFor(0.25, c), 'empty')
  assert.equal(levelFor(0.5, c), 'half')
  assert.equal(levelFor(0.7, c), 'full')
})

test('units mode normalises by 7', () => {
  const c: ProductCal = { mode: 'units', threshold: 3.5, level: 'full' }
  assert.equal(levelFor(0.5, c), 'full')
  assert.equal(levelFor(0.3, c), 'half')
  assert.equal(levelFor(0.1, c), 'empty')
})

test('no calibration falls back to fixed cutoffs', () => {
  assert.equal(levelFor(0.1, undefined), 'empty')
  assert.equal(levelFor(0.5, undefined), 'half')
  assert.equal(levelFor(0.9, undefined), 'full')
})

test('edge thresholds do not crash', () => {
  for (const level of ['empty', 'half', 'full'] as const) {
    for (const t of [0, 100, -5, 250, NaN]) {
      for (const f of [0, 0.5, 1, -1, 2, NaN]) {
        assert.ok(['empty', 'half', 'full'].includes(levelFor(f, pct(t, level))))
      }
    }
  }
  assert.equal(levelFor(0, pct(0, 'full')), 'full')
  assert.equal(levelFor(1, pct(100, 'empty')), 'empty')
  assert.equal(levelFor(1, pct(100, 'half')), 'full')
})

test('defaultCalibration picks units for big families', () => {
  const d = defaultCalibration(['melon', 'banana'])
  assert.ok(BIG_FAMILIES.includes('melon'))
  assert.deepEqual(d.melon, { mode: 'units', threshold: 4, level: 'half' })
  assert.deepEqual(d.banana, { mode: 'percent', threshold: 50, level: 'half' })
})

test('load/save without localStorage', () => {

  const saved = (globalThis as any).localStorage
  delete (globalThis as any).localStorage
  assert.deepEqual(loadCalibration(), {})
  assert.doesNotThrow(() => saveCalibration({}))
  if (saved) (globalThis as any).localStorage = saved
})

test('load/save round trip and bad JSON', () => {
  const store = new Map<string, string>()
  ;(globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  }
  const c = { melon: { mode: 'units', threshold: 2, level: 'full' } as ProductCal }
  saveCalibration(c)
  assert.deepEqual(loadCalibration(), c)
  store.set('strivon.calibration', '{nope')
  assert.deepEqual(loadCalibration(), {})
  delete (globalThis as any).localStorage
})
