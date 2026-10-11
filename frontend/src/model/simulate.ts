import { FAMILIES } from './families'
import type { Level, Observation, StoreState } from './types'

const PRODUCTS = Object.keys(FAMILIES).filter((k) => k !== 'other')

/** A small deterministic hash, so a simulated day is the same on every load. */
export function hash(n: number): number {
  let x = (n + 0x9e3779b9) | 0
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

function seedOf(areaId: string): number {
  let n = 0
  for (const ch of areaId) n = (n * 31 + ch.charCodeAt(0)) | 0
  return n
}

/**
 * Fills in what the pipeline will say about every area in every photo: stock drains over about
 * eight photos and is refilled, and a few areas hold the wrong product for part of the day. It
 * replaces the real predictions until they are available. The shape is the pipeline's.
 */
export function simulateObservations(state: StoreState): void {
  for (const [camera, frames] of Object.entries(state.images)) {
    state.observations[camera] = {}
    frames.forEach(({ image }, k) => {
      const frame: Record<string, Observation> = {}
      for (const area of Object.values(state.areas).filter((a) => a.camera === camera)) {
        const seed = seedOf(area.area_id)
        const phase = Math.floor(hash(seed) * 8)
        const fill = ((k + phase) % 8) / 7
        const stock: Level = fill < 0.15 ? 'empty' : fill < 0.45 ? 'half' : 'full'
        const misplaced = hash(seed + 7) < 0.07 && k >= 5 + Math.floor(hash(seed + 3) * 5)
        const pick = Math.floor(hash(seed + 11) * PRODUCTS.length)
        const other = PRODUCTS[pick] === area.family ? PRODUCTS[(pick + 1) % PRODUCTS.length] : PRODUCTS[pick]
        frame[area.area_id] = {
          planogram_compliant: !misplaced,
          stock_level: stock,
          stock_value: Math.min(1, Math.max(0, Math.round((fill * 0.9 + 0.05 + (hash(seed + k * 13) - 0.5) * 0.06) * 100) / 100)),
          observed_family: misplaced ? other : undefined,
        }
      }
      state.observations[camera][image] = frame
    })
  }
}
