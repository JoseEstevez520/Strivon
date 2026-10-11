import type { Area, ImageRecord, Observation, StoreState } from '@/model/types'

export type Group = 'restock' | 'moveBack' | 'later' | 'allGood'

/** The groups that ask someone to do something. */
export const ACTION: Group[] = ['restock', 'moveBack']

export interface Task {
  area: Area
  obs: Observation
  record: ImageRecord
  group: Group
  /** When the area first reached this state, going back from the photo shown. */
  since: number | null
  /**
   * How much of the product is gone across the whole store, 0 to 1: an empty area counts 1 and a
   * half-empty one 0.5. A product that is out everywhere cannot be bought at all, so it comes first.
   */
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
  while (i >= 0) {
    const o = s.observations[area.camera]?.[list[i].image]?.[area.area_id]
    if (!o || groupOf(o) !== group) break
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
    // Most urgent first. Equal urgency goes to what has waited longest, which is the time the card
    // shows, and the camera and area only decide what is still tied.
    .sort(
      (a, b) =>
        b.urgency - a.urgency ||
        (a.since ?? 0) - (b.since ?? 0) ||
        a.area.camera.localeCompare(b.area.camera) ||
        a.area.index - b.area.index,
    )
}

export interface HistoryPoint {
  record: ImageRecord
  obs: Observation
}

/** One area through the day: its state in every photo of its camera, in time order. */
export function historyOf(s: StoreState, area: Area): HistoryPoint[] {
  return s.images[area.camera]
    .map((record) => ({ record, obs: s.observations[area.camera][record.image]?.[area.area_id] }))
    .filter((p): p is HistoryPoint => p.obs !== undefined)
}

/**
 * What the list shows. A product that needs the same thing in several areas is one card, so a
 * whole store of tasks stays short. Misplaced products stay one per area, because each is a
 * different wrong thing in a different place.
 */
export interface Card {
  key: string
  group: Group
  /** The areas of the card, the one waiting longest first. */
  tasks: Task[]
}

const GROUPED: Group[] = ['restock', 'later', 'allGood']

export function cardKey(task: Task): string {
  return GROUPED.includes(task.group) ? `${task.group}:${task.area.product_id}` : task.area.area_id
}

export function cardsOf(tasks: Task[]): Card[] {
  const byKey = new Map<string, Card>()
  for (const task of tasks) {
    const key = cardKey(task)
    const card = byKey.get(key)
    if (card) card.tasks.push(task)
    else byKey.set(key, { key, group: task.group, tasks: [task] })
  }
  const cards = [...byKey.values()]
  for (const c of cards) c.tasks.sort((a, b) => (a.since ?? 0) - (b.since ?? 0))
  return cards
}

/** The two products that fill most of a camera's areas: how people would call that gondola. */
export function gondolaFamilies(s: StoreState, camera: string): string[] {
  const counts: Record<string, number> = {}
  for (const a of areasOf(s, camera)) counts[a.family] = (counts[a.family] ?? 0) + 1
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([family]) => family)
}
