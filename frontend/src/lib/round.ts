import { suggest } from './suggest'
import type { Task } from './tasks'

/** One product to carry, with the area it is for, so the stop can show the empty spot. */
export interface Carry {
  family: string
  /** How many areas. */
  n: number
  /** The first area it is for, to crop its photo. */
  task: Task
  /** Where it was picked up, when it is a product moved from another gondola. */
  from?: string
}

/** A product standing in the wrong place, and where it belongs. */
export interface Move {
  family: string
  from: string
  /** The gondola it belongs in, or null when the planogram has no place for it. */
  to: string | null
  task: Task
  /** True when the pipeline said the place holds the wrong product but not which one. */
  unknown?: boolean
}

export interface Stop {
  camera: string
  leave: Carry[]
  pick: Move[]
  /** When the oldest empty area there ran out. */
  since: number | null
}

export interface Round {
  /** Everything to take from the back room, summed over the stops. */
  load: { family: string; n: number; cameras: string[] }[]
  stops: Stop[]
}

const num = (camera: string) => Number(camera.match(/\d+$/)?.[0] ?? camera)

/**
 * The round as a walk: first load up, then each gondola in the order of the ranking, saying what
 * to leave and what to pick up. A product in the wrong place is matched with the gondola that has
 * its place in the planogram, so one trip takes it there and it is also listed as a drop at the
 * other end. The order is by need, then by gondola number as an approximation of the walk: the
 * floor positions are not known, so it is a reasonable order and not the shortest path.
 */
export function buildRound(tasks: Task[]): Round {
  const homes = new Map<string, Set<string>>()
  for (const x of tasks) homes.set(x.area.family, (homes.get(x.area.family) ?? new Set()).add(x.area.camera))
  const nearest = (family: string, from: string) =>
    [...(homes.get(family) ?? [])].filter((c) => c !== from).sort((a, b) => Math.abs(num(a) - num(from)) - Math.abs(num(b) - num(from)))[0] ?? null

  const ranked = suggest(tasks).filter((s) => s.empty + s.wrong > 0)
  const order = ranked.map((s) => s.camera)
  const stops = new Map<string, Stop>()
  const stopOf = (camera: string): Stop => {
    let s = stops.get(camera)
    if (!s) stops.set(camera, (s = { camera, leave: [], pick: [], since: ranked.find((r) => r.camera === camera)?.emptySince ?? null }))
    return s
  }
  for (const camera of order) stopOf(camera)

  const add = (list: Carry[], family: string, task: Task, from?: string) => {
    const have = list.find((c) => c.family === family && c.from === from)
    if (have) have.n += 1
    else list.push({ family, n: 1, task, from })
  }
  for (const x of tasks) {
    if (x.group === 'restock') add(stopOf(x.area.camera).leave, x.area.family, x)
    if (x.group === 'moveBack' && !x.obs.observed_family) {
      // The place holds the wrong product and the pipeline did not say which: it can only be taken away.
      stopOf(x.area.camera).pick.push({ family: x.area.family, from: x.area.camera, to: null, task: x, unknown: true })
    }
    if (x.group === 'moveBack' && x.obs.observed_family) {
      const family = x.obs.observed_family
      const to = nearest(family, x.area.camera)
      stopOf(x.area.camera).pick.push({ family, from: x.area.camera, to, task: x })
      // It arrives at its own gondola, which may not have a problem of its own.
      const home = to ? tasks.find((y) => y.area.camera === to && y.area.family === family) : undefined
      if (to && home) add(stopOf(to).leave, family, home, x.area.camera)
    }
  }
  // The gondolas that only receive a moved product come after the ones ranked by need.
  const extra = [...stops.keys()].filter((c) => !order.includes(c)).sort((a, b) => num(a) - num(b))
  const list = [...order, ...extra].map((c) => stops.get(c)!)

  const load = new Map<string, { family: string; n: number; cameras: string[] }>()
  for (const s of list)
    for (const c of s.leave.filter((y) => !y.from)) {
      const row = load.get(c.family) ?? { family: c.family, n: 0, cameras: [] }
      row.n += c.n
      if (!row.cameras.includes(s.camera)) row.cameras.push(s.camera)
      load.set(c.family, row)
    }
  return { load: [...load.values()].sort((a, b) => b.n - a.n), stops: list }
}
