import { maxOf, modeOf, roundHalfUp, type Calibration } from '@/lib/calibration'

export type PresetId = 'strict' | 'relaxed'

/** Every product marked full at `share` of its slider: a share of the crate, or of its capacity in pieces. */
function build(families: string[], share: number): Calibration {
  const out: Calibration = {}
  for (const f of families) {
    const top = maxOf(f)
    out[f] = { mode: modeOf(f), threshold: top === 100 ? share * 100 : roundHalfUp(share * top), level: 'full' }
  }
  return out
}

/**
 * Two ready-made profiles. The marker says how much stock already counts as full:
 * strict wants the shelf well stocked, relaxed accepts a bit of stock.
 */
export const PRESETS: Record<PresetId, (families: string[]) => Calibration> = {
  strict: (families) => build(families, 0.8),
  relaxed: (families) => build(families, 0.4),
}
