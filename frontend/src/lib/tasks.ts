import type { Area, ImageRecord, Observation, StoreState } from '@/data/types'

export type Group = 'restock' | 'moveBack' | 'later' | 'allGood'

export interface Task {
  area: Area
  obs: Observation
  record: ImageRecord
  group: Group
  /** When the area first reached this state, going back from the photo shown. */
  since: number | null
  /** The fraction of this product's areas that need restocking: how urgent the product is. */
  urgency: number
}

export const cameras = (s: StoreState) => Object.keys(s.images).sort()
export const areasOf = (s: StoreState, camera: string) =>
  Object.values(s.areas)
    .filter((a) => a.camera === camera)
    .sort((a, b) => a.index - b.index)

/** The newest photo of a camera at or before `at`, or its first one. */
export function snapshot(s: StoreState, camera: string, at: number): ImageRecord {
  const list = s.images[camera]
  let pick = list[0]
  for (const r of list) if (r.ts <= at) pick = r
  return pick
}

export function groupOf(o: Observation): Group {
  if (!o.planogram_compliant) return 'moveBack'
  if (o.stock_level === 'empty') return 'restock'
  if (o.stock_level === 'half') return 'later'
  return 'allGood'
}

function since(s: StoreState, area: Area, image: string, group: Group): number | null {
  const list = s.images[area.camera]
  let i = list.findIndex((r) => r.image === image)
  let start: ImageRecord | undefined = list[i]
  while (i >= 0 && groupOf(s.observations[area.camera][list[i].image][area.area_id]) === group) {
    start = list[i]
    i--
  }
  return start ? start.ts : null
}

/** Every area of the store at time `at`, with the group it belongs to. */
export function tasksAt(s: StoreState, at: number): Task[] {
  const rows: Omit<Task, 'urgency' | 'since'>[] = []
  for (const camera of cameras(s)) {
    const record = snapshot(s, camera, at)
    for (const area of areasOf(s, camera)) {
      const obs = s.observations[camera][record.image]?.[area.area_id]
      if (obs) rows.push({ area, obs, record, group: groupOf(obs) })
    }
  }

  const product: Record<string, { n: number; score: number }> = {}
  for (const r of rows) {
    const p = (product[r.area.product_id] ??= { n: 0, score: 0 })
    p.n++
    if (r.obs.planogram_compliant && r.obs.stock_level === 'empty') p.score += 1
    if (r.obs.planogram_compliant && r.obs.stock_level === 'half') p.score += 0.5
  }

  return rows
    .map((r) => ({
      ...r,
      since: since(s, r.area, r.record.image, r.group),
      urgency: product[r.area.product_id].score / product[r.area.product_id].n,
    }))
    .sort((a, b) => b.urgency - a.urgency || a.area.camera.localeCompare(b.area.camera) || a.area.index - b.area.index)
}
