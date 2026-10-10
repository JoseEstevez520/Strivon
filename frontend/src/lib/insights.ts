import type { Area, StoreState } from '@/model/types'
import { cell, HOUR, storeStats, weights } from './stats'

/** What a question is about: the whole store, one product, one gondola, or a product in a gondola. */
export interface Scope {
  product?: string
  camera?: string
}

const inScope = (a: Area, s: Scope) => (!s.product || a.product_id === s.product) && (!s.camera || a.camera === s.camera)

/** How shelf time split between levels, and how much of it held the wrong product. All 0 to 1. */
export interface Breakdown {
  empty: number
  half: number
  full: number
  wrong: number
}

/** Time-weighted over the period, like the rest of the figures: every one of them is an estimate. */
export function breakdown(state: StoreState, scope: Scope = {}): Breakdown {
  const sum = { empty: 0, half: 0, full: 0, wrong: 0 }
  let total = 0
  for (const [camera, frames] of Object.entries(state.images)) {
    if (scope.camera && camera !== scope.camera) continue
    const w = weights(frames)
    for (const area of Object.values(state.areas)) {
      if (area.camera !== camera || !inScope(area, scope)) continue
      frames.forEach((frame, i) => {
        const obs = state.observations[camera][frame.image]?.[area.area_id]
        if (!obs) return
        total += w[i]
        sum[obs.stock_level] += w[i]
        if (!obs.planogram_compliant) sum.wrong += w[i]
      })
    }
  }
  const share = (n: number) => (total ? n / total : 0)
  return { empty: share(sum.empty), half: share(sum.half), full: share(sum.full), wrong: share(sum.wrong) }
}

/** The share of the scope's areas that were empty in each hour, null where no camera was looking. */
export function trend(state: StoreState, scope: Scope = {}): { hours: number[]; values: (number | null)[] } {
  const { hours } = storeStats(state)
  const areas = Object.values(state.areas).filter((a) => inScope(a, scope))
  return { hours, values: hours.map((h) => cell(state, areas, h + HOUR / 2)) }
}

export interface Row {
  key: string
  empty: number
  half: number
  wrong: number
}

/** Every product, or every gondola, with its figures, the one empty the longest first. */
export function rows(state: StoreState, by: 'products' | 'gondolas'): Row[] {
  const keys =
    by === 'products' ? [...new Set(Object.values(state.areas).map((a) => a.product_id))] : Object.keys(state.images)
  return keys
    .map((key) => {
      const b = breakdown(state, by === 'products' ? { product: key } : { camera: key })
      return { key, empty: b.empty, half: b.half, wrong: b.wrong }
    })
    .sort((a, b) => b.empty - a.empty)
}
