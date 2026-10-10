/**
 * Where each gondola sits on the store plan, in grid cells (column and row, counted from 0). We do
 * not have the real plan yet, so this is empty and the gondolas are laid out in rows. Fill it in,
 * for example `'6215': { col: 0, row: 0 }`, and the map follows without anything else changing.
 */
export const PLAN: Record<string, { col: number; row: number }> = {}

export interface Placed {
  camera: string
  col: number
  row: number
}

/** The gondolas with a place: the plan where it has them, rows of four for the rest. */
export function place(cameras: string[], columns = 4): Placed[] {
  const planned = cameras.filter((c) => PLAN[c])
  const free = cameras.filter((c) => !PLAN[c])
  const used = new Set(planned.map((c) => `${PLAN[c].col},${PLAN[c].row}`))
  const out: Placed[] = planned.map((camera) => ({ camera, ...PLAN[camera] }))
  let i = 0
  for (const camera of free) {
    let col = i % columns
    let row = Math.floor(i / columns)
    while (used.has(`${col},${row}`)) {
      i++
      col = i % columns
      row = Math.floor(i / columns)
    }
    used.add(`${col},${row}`)
    out.push({ camera, col, row })
    i++
  }
  return out
}
