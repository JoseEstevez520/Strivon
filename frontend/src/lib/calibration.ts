import type { Level } from '../model/types'

export type { Level }

export type CalMode = 'percent' | 'units'

/** percent: threshold 0..100; units: threshold 0..7 */
export interface ProductCal {
  mode: CalMode
  threshold: number
  level: Level
}

/** Key = product family (Area.family). */
export type Calibration = Record<string, ProductCal>

/** Families that are measured in units (pieces in the crate) instead of percent. */
export const BIG_FAMILIES: string[] = ['watermelon', 'melon', 'pineapple', 'pumpkin', 'papaya']

const STORAGE_KEY = 'strivon.calibration'
const MAX_UNITS = 7

export function defaultCalibration(families: string[]): Calibration {
  const out: Calibration = {}
  for (const f of families) {
    out[f] = BIG_FAMILIES.includes(f)
      ? { mode: 'units', threshold: 4, level: 'half' }
      : { mode: 'percent', threshold: 50, level: 'half' }
  }
  return out
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

/**
 * Turn a fill fraction (0..1 of the container) into a level, using the user's marker:
 * `threshold` is the amount the user says IS `level`.
 */
export function levelFor(fill: number, cal: ProductCal | undefined): Level {
  const f = clamp01(fill)
  if (!cal) return f < 0.2 ? 'empty' : f < 0.7 ? 'half' : 'full'

  const t = clamp01(cal.mode === 'units' ? cal.threshold / MAX_UNITS : cal.threshold / 100)

  switch (cal.level) {
    case 'full':
      if (f >= t) return 'full'
      return f >= t / 2 ? 'half' : 'empty'
    case 'half':
      if (f < t / 2) return 'empty'
      return f < t + (1 - t) / 2 ? 'half' : 'full'
    case 'empty':
      if (f <= t) return 'empty'
      return f <= (t + 1) / 2 ? 'half' : 'full'
  }
}

export function loadCalibration(): Calibration {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
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
