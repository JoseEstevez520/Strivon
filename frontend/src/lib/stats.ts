import type { Area, ImageRecord, StoreState } from '@/model/types'
import { groupOf, snapshot } from './tasks'

/** One product through the period: how much of it was empty in each hour. */
export interface MapRow {
  product: string
  /** The share of the product's shelf time in which its areas were empty, 0 to 1. */
  share: number
  /** For each hour column, the share of its areas that were empty, or null where no camera saw it. */
  cells: (number | null)[]
  /** How many hours of the period an area of this product was empty on average: the share times the length of the period. */
  emptyHours: number
  /** The start of the hours in which the most of it was empty, worst first, at most two. */
  worst: number[]
}

export interface Stats {
  /** The share of all shelf time in which areas were empty, 0 to 1. */
  emptyShare: number
  /** Share of the period in which areas held the product the planogram expects, 0 to 1. */
  compliance: number
  /** The first and last photo of the period, in unix seconds. */
  period: { from: number; to: number }
  /** The start of each hour column, in unix seconds. */
  hours: number[]
  map: MapRow[]
  byGondola: { camera: string; share: number; emptyHours: number }[]
  /** The hour in which the most areas were empty, among the hours most cameras were taking photos. */
  peak: { hour: number; share: number } | null
}

/**
 * How long each photo stands for: half the gap to the photo before and half to the one after. The
 * photos come about an hour apart and nothing between them is known, so every figure built on this
 * is an estimate.
 */
export function weights(frames: ImageRecord[]): number[] {
  return frames.map((f, i) => {
    const before = i > 0 ? f.ts - frames[i - 1].ts : 0
    const after = i < frames.length - 1 ? frames[i + 1].ts - f.ts : 0
    return (before + after) / 2 || 0
  })
}

export const HOUR = 3600

/** The summary of the period the photos cover, from the observations of every area in every photo. */
export function storeStats(state: StoreState): Stats {
  const areas = Object.values(state.areas)
  const emptyByProduct: Record<string, number> = {}
  const timeByProduct: Record<string, number> = {}
  const emptyByCamera: Record<string, number> = {}
  const timeByCamera: Record<string, number> = {}
  let emptyTotal = 0
  let timeTotal = 0
  let compliant = 0
  let weighed = 0
  let first = Infinity
  let last = -Infinity

  for (const [camera, frames] of Object.entries(state.images)) {
    if (!frames?.length) continue
    first = Math.min(first, frames[0].ts)
    last = Math.max(last, frames[frames.length - 1].ts)
    const w = weights(frames)
    for (const area of areas.filter((a) => a.camera === camera)) {
      frames.forEach((frame, i) => {
        const obs = state.observations[camera][frame.image]?.[area.area_id]
        if (!obs) return
        weighed += w[i]
        timeTotal += w[i]
        timeByProduct[area.product_id] = (timeByProduct[area.product_id] ?? 0) + w[i]
        timeByCamera[camera] = (timeByCamera[camera] ?? 0) + w[i]
        if (obs.planogram_compliant) compliant += w[i]
        if (groupOf(obs) === 'restock') {
          emptyByProduct[area.product_id] = (emptyByProduct[area.product_id] ?? 0) + w[i]
          emptyByCamera[camera] = (emptyByCamera[camera] ?? 0) + w[i]
          emptyTotal += w[i]
        }
      })
    }
  }

  const start = Math.floor(first / HOUR) * HOUR
  const end = Math.ceil(last / HOUR) * HOUR
  const hours: number[] = []
  for (let t = start; t < end; t += HOUR) hours.push(t)

  const periodHours = (last - first) / HOUR
  const products = [...new Set(areas.map((a) => a.product_id))]
  const map: MapRow[] = products.map((product) => {
    const own = areas.filter((a) => a.product_id === product)
    const cells = hours.map((hour) => cell(state, own, hour + HOUR / 2))
    const time = timeByProduct[product] ?? 0
    const worst = cells
      .map((share, i) => ({ share: share ?? 0, hour: hours[i] }))
      .filter((c) => c.share > 0)
      .sort((a, b) => b.share - a.share || a.hour - b.hour)
      .slice(0, 2)
      .map((c) => c.hour)
    return { product, share: time ? (emptyByProduct[product] ?? 0) / time : 0, cells, emptyHours: (time ? (emptyByProduct[product] ?? 0) / time : 0) * periodHours, worst }
  })

  return {
    emptyShare: timeTotal ? emptyTotal / timeTotal : 0,
    period: { from: first, to: last },
    compliance: weighed ? compliant / weighed : 1,
    hours,
    map: map.sort((a, b) => b.share - a.share),
    byGondola: Object.keys(timeByCamera)
      .map((camera) => ({ camera, share: (emptyByCamera[camera] ?? 0) / timeByCamera[camera], emptyHours: ((emptyByCamera[camera] ?? 0) / timeByCamera[camera]) * periodHours }))
      .sort((a, b) => b.share - a.share),
    peak: peakHour(state, areas, hours),
  }
}

/** The hour with the most areas empty. Hours where fewer than 60% of the areas had a camera on them are left out, since a few areas alone would swing it. */
function peakHour(state: StoreState, areas: Area[], hours: number[]): Stats['peak'] {
  let best: Stats['peak'] = null
  for (const hour of hours) {
    const { seen, empty } = tally(state, areas, hour + HOUR / 2)
    if (seen < areas.length * 0.6) continue
    const share = empty / seen
    if (share > 0 && (!best || share > best.share)) best = { hour, share }
  }
  return best
}

/** The share of a product's areas that were empty at a moment, counting only cameras that were taking photos then. */
export function cell(state: StoreState, areas: Area[], at: number): number | null {
  const { seen, empty } = tally(state, areas, at)
  return seen ? empty / seen : null
}

function tally(state: StoreState, areas: Area[], at: number): { seen: number; empty: number } {
  let seen = 0
  let empty = 0
  for (const area of areas) {
    const frames = state.images[area.camera]
    if (!frames?.length) continue
    if (at < frames[0].ts - HOUR * 0.75 || at > frames[frames.length - 1].ts + HOUR * 0.75) continue
    const record = snapshot(state, area.camera, at)
    const obs = state.observations[area.camera][record.image]?.[area.area_id]
    if (!obs) continue
    seen++
    if (groupOf(obs) === 'restock') empty++
  }
  return { seen, empty }
}
