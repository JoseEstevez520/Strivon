import type { Task } from './tasks'

/** A gondola worth going to, with why and what to carry there. */
export interface Suggestion {
  camera: string
  /** How much it needs, to rank by. */
  score: number
  empty: number
  half: number
  wrong: number
  /** When the oldest empty area there ran out, if any. */
  emptySince: number | null
  /** What to bring: the products that are empty or half there, with how many areas of each. */
  bring: { family: string; n: number }[]
}

const WEIGHT = { restock: 1, moveBack: 1, later: 0.5, allGood: 0 } as const
const HOUR = 3600

/**
 * Which gondola to go to first. Every area that needs something counts: empty and wrong-place as 1,
 * half full as 0.5. That is made heavier by how long it has been like that (up to double after six
 * hours) and by how much of the product is gone across the store (up to double when it is out
 * everywhere). The gondola with the biggest sum comes first.
 */
export function suggest(tasks: Task[]): Suggestion[] {
  const by = new Map<string, Task[]>()
  for (const task of tasks) {
    if (WEIGHT[task.group] === 0) continue
    by.set(task.area.camera, [...(by.get(task.area.camera) ?? []), task])
  }
  return [...by.entries()]
    .map(([camera, own]) => {
      const score = own.reduce((sum, x) => {
        const waited = x.since === null ? 0 : Math.max(0, x.record.ts - x.since) / HOUR
        return sum + WEIGHT[x.group] * (1 + x.urgency) * (1 + Math.min(waited, 6) / 6)
      }, 0)
      const families = new Map<string, number>()
      for (const x of own.filter((y) => y.group === 'restock' || y.group === 'later')) {
        families.set(x.area.family, (families.get(x.area.family) ?? 0) + 1)
      }
      const empties = own.filter((x) => x.group === 'restock' && x.since !== null).map((x) => x.since as number)
      return {
        camera,
        score,
        empty: own.filter((x) => x.group === 'restock').length,
        half: own.filter((x) => x.group === 'later').length,
        wrong: own.filter((x) => x.group === 'moveBack').length,
        emptySince: empties.length ? Math.min(...empties) : null,
        bring: [...families.entries()].map(([family, n]) => ({ family, n })).sort((a, b) => b.n - a.n),
      }
    })
    .sort((a, b) => b.score - a.score)
}
