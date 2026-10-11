import { BIG_FAMILIES, type Calibration } from '@/lib/calibration'

export type PresetId = 'strict' | 'relaxed'

function build(families: string[], percent: number, units: number): Calibration {
  const out: Calibration = {}
  for (const f of families) {
    out[f] = BIG_FAMILIES.includes(f)
      ? { mode: 'units', threshold: units, level: 'full' }
      : { mode: 'percent', threshold: percent, level: 'full' }
  }
  return out
}

/**
 * Two ready-made profiles. The marker says how much stock already counts as full:
 * strict wants the shelf well stocked, relaxed accepts a bit of stock.
 */
export const PRESETS: Record<PresetId, (families: string[]) => Calibration> = {
  strict: (families) => build(families, 80, 6),
  relaxed: (families) => build(families, 40, 3),
}
