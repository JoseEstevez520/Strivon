import type { Area, Level, StoreState } from '../model/types'

export type { Level }

export type CalMode = 'percent' | 'units'

/** One person's marker for a product: the amount on the slider (percent 0..100, or pieces 0..capacity) and the level it counts as. */
export interface ProductCal {
  mode: CalMode
  threshold: number
  level: Level
  /**
   * Both lines set by hand (empty up to `emptyMax`, full from `fullMin`, half in between), in the family's unit.
   * When both are present they win over the lines a single marker would give.
   */
  emptyMax?: number
  fullMin?: number
}

/** Key = product family (Area.family). A family without a marker shows the model's own level. */
export type Calibration = Record<string, ProductCal>

/** Big fruit is counted in pieces. How many fit in a full crate, counted by eye on one full photo. */
export const CAPACITY: Record<string, number> = {
  melon: 3,
  watermelon: 4,
  papaya: 7,
  pineapple: 6,
  pumpkin: 12,
  cabbage: 8,
  red_cabbage: 6,
  cauliflower: 6,
}

/** Families that are measured in units (pieces in the crate) instead of percent. */
export const BIG_FAMILIES: string[] = Object.keys(CAPACITY)

/**
 * The model's own lines on the fill scale: empty up to 30%, full from 74%. On our 1947 labelled
 * areas they give the model's answers within 2 points, so a marker moves the store away from them.
 */
export const DEFAULT_EMPTY_MAX = 30
export const DEFAULT_FULL_MIN = 74

// v1 stored a marker for every family, which overrode the model everywhere. v2 keeps only the ones a person set.
const STORAGE_KEY = 'strivon.calibration.v2'

export interface Lines {
  /** An amount up to this is empty. */
  emptyMax: number
  /** An amount from this is full. Between the two it is half. */
  fullMin: number
}

/** Halves round up, the same rule as the predictor: floor(x + 0.5). */
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5)
}

export function modeOf(family: string): CalMode {
  return family in CAPACITY ? 'units' : 'percent'
}

/** The top of the slider: 100% or the crate's capacity in pieces. */
export function maxOf(family: string): number {
  return CAPACITY[family] ?? 100
}

/** Where a row's slider starts before anyone sets a marker: the middle. */
export function startOf(family: string): number {
  return family in CAPACITY ? roundHalfUp(maxOf(family) / 2) : 50
}

/** The model's lines in the family's own unit. */
export function defaultLines(family: string): Lines {
  const cap = CAPACITY[family]
  if (cap) return { emptyMax: roundHalfUp(0.3 * cap), fullMin: roundHalfUp(0.74 * cap) }
  return { emptyMax: DEFAULT_EMPTY_MAX, fullMin: DEFAULT_FULL_MIN }
}

/**
 * The lines a marker sets. Full at v: full from v, and the empty line keeps the model's ratio
 * (v·30/74). Empty at v: empty up to v, and full from v·74/30, at most the top. Half at v: the
 * model's lines, moved just enough to keep v in the middle. One marker never contradicts itself.
 */
export function linesFor(family: string, c: ProductCal): Lines {
  const top = maxOf(family)
  if (Number.isFinite(c.emptyMax) && Number.isFinite(c.fullMin)) {
    const emptyMax = Math.min(top - 1, Math.max(0, c.emptyMax as number))
    return { emptyMax, fullMin: Math.min(top, Math.max(emptyMax + 1, c.fullMin as number)) }
  }
  const v = Math.min(top, Math.max(0, Number.isFinite(c.threshold) ? c.threshold : 0))
  if (c.level === 'full') return { emptyMax: Math.min(roundHalfUp((v * 30) / 74), v - 1), fullMin: v }
  if (c.level === 'empty') return { emptyMax: v, fullMin: Math.max(v + 1, Math.min(top, roundHalfUp((v * 74) / 30))) }
  const d = defaultLines(family)
  return { emptyMax: Math.min(d.emptyMax, v - 1), fullMin: Math.max(d.fullMin, v + 1) }
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

/** How much a crate holds, in the family's unit: percent of the crate, or pieces (fill × capacity, halves up). */
export function amountOf(fill: number, family: string): number {
  const f = clamp01(fill)
  const cap = CAPACITY[family]
  return cap ? roundHalfUp(f * cap) : f * 100
}

/** The level a marker gives to a crate with this fill (0 to 1 of the crate). */
export function levelFor(fill: number, family: string, c: ProductCal): Level {
  const a = amountOf(fill, family)
  const { emptyMax, fullMin } = linesFor(family, c)
  if (a <= emptyMax) return 'empty'
  return a >= fullMin ? 'full' : 'half'
}

/**
 * The state the pages show. An area keeps the model's own level unless a person set a marker for
 * its product and the model gave a fill for it, so with no markers the app shows exactly what
 * the model answered.
 */
export function calibrate(state: StoreState, cal: Calibration): StoreState {
  if (Object.keys(cal).length === 0) return state
  const observations: StoreState['observations'] = {}
  for (const [camera, photos] of Object.entries(state.observations)) {
    observations[camera] = {}
    for (const [image, frame] of Object.entries(photos)) {
      const out: typeof frame = {}
      for (const [id, o] of Object.entries(frame)) {
        const fam = state.areas[id]?.family
        const c = fam ? cal[fam] : undefined
        out[id] = c && fam && o.stock_value !== undefined ? { ...o, stock_level: levelFor(o.stock_value, fam, c) } : o
      }
      observations[camera][image] = out
    }
  }
  return { ...state, observations }
}

function isMarker(v: unknown): v is ProductCal {
  const c = v as ProductCal
  return !!c && typeof c === 'object' && Number.isFinite(c.threshold) && ['empty', 'half', 'full'].includes(c.level)
}

export function loadCalibration(): Calibration {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => isMarker(v))) as Calibration
  } catch {
    return {}
  }
}

export function saveCalibration(c: Calibration): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
  } catch {
    // storage unavailable or full: calibration just won't persist
  }
}

/** The predictor's calibration file (`calib.json`, version 1), one entry per catalogue product. */
export interface CalibFile {
  version: 1
  products: Record<
    string,
    {
      name: string
      unit: 'percent' | 'count'
      capacity: number | null
      points: { value: number; level: Level }[]
      empty_max: number
      full_min: number
    }
  >
}

/**
 * The markers as the predictor's `calib.json`. Every product of a marked family gets the marker
 * and the lines it sets, written out, so the predictor uses the same lines as the app.
 */
export function toCalibFile(cal: Calibration, areas: Record<string, Area>): CalibFile {
  const products: CalibFile['products'] = {}
  for (const a of Object.values(areas)) {
    const c = cal[a.family]
    if (!c || !a.catalog_id || products[a.catalog_id]) continue
    const { emptyMax, fullMin } = linesFor(a.family, c)
    const cap = CAPACITY[a.family]
    products[a.catalog_id] = {
      name: a.product_name ?? a.family,
      unit: cap ? 'count' : 'percent',
      capacity: cap ?? null,
      points: [{ value: Math.min(maxOf(a.family), Math.max(0, c.threshold)), level: c.level }],
      empty_max: emptyMax,
      full_min: fullMin,
    }
  }
  return { version: 1, products }
}
