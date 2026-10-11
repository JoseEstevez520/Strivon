import { Check, ChevronsUp, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ProductIcon } from '@/components/ProductIcon'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import type { Task } from '@/lib/tasks'
import { clock } from '@/lib/time'

/*
 * The store plan, a passive live view: nothing here asks the employee to mark anything, because the
 * next hourly photo clears a warning by itself. From 1024 px it is a top-down plan with walls, a
 * door, a department sign, aisle lanes with names and gondolas as furniture with hanging signs, and
 * a grey line shows the walk. Below that the same gondola block sits in a compact grid in walking
 * order. The layout reflows (HTML and CSS), there is no fixed-size drawing. Floor positions are made
 * up; the areas, their states and the order are real. Depth is tone, colour only says an outcome and
 * every state has a shape too.
 */

type Look = 'critical' | 'empty' | 'wrong' | 'half' | 'fine'

const mix = (c: string, pct: number, base = 'var(--raised)') => `color-mix(in oklab, ${c} ${pct}%, ${base})`
const WALL = mix('var(--fg)', 20, 'var(--bg)')
const FLOOR = 'var(--sunk)'
export const isProblem = (x: Task) => x.group === 'restock' || x.group === 'moveBack'

/** Pure red is for what is really critical: a product that is gone from half the store or more. */
function lookOf(x: Task): Look {
  if (x.group === 'restock') return x.urgency >= 0.5 ? 'critical' : 'empty'
  if (x.group === 'moveBack') return 'wrong'
  if (x.group === 'later') return 'half'
  return 'fine'
}

const TILE_BG: Record<Look, string> = {
  critical: mix('var(--danger)', 30),
  empty: mix('var(--danger)', 12),
  wrong: mix('var(--warning)', 26),
  half: 'var(--sunk)',
  fine: 'var(--raised)',
}
const TILE_INK: Record<Look, string> = {
  critical: 'var(--danger)',
  empty: mix('var(--danger)', 78, 'var(--fg)'),
  wrong: 'var(--warning)',
  half: 'var(--fg-secondary)',
  fine: 'var(--fg-secondary)',
}

/** One shelf area: its product on a tint. Empty has a "!" badge, wrong a return arrow, half full a filled lower half, fine nothing extra. */
export function AreaTile({ task, large = false }: { task: Task; large?: boolean }) {
  const { family, t } = useI18n()
  const look = lookOf(task)
  const name = family(task.area.family)
  const state = look === 'half' ? t.level.half : look === 'wrong' ? t.wrongProduct : look === 'fine' ? t.plan.fine : t.level.empty
  const dot = large ? 'size-4' : 'size-3.5'
  return (
    <span
      role="img"
      aria-label={t.plan.areaLabel(name, state)}
      title={`${name} · ${state}`}
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-md ${large ? 'size-10' : 'h-8 w-full'}`}
      style={{ background: TILE_BG[look], color: TILE_INK[look] }}
    >
      {look === 'half' && <span className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: mix('var(--fg)', 13) }} />}
      <ProductIcon family={task.area.family} label={name} className={`relative ${large ? 'size-6' : 'size-5'}`} />
      {(look === 'critical' || look === 'empty') && (
        <span
          className={`absolute top-0 right-0 grid ${dot} place-items-center rounded-bl-md text-[11px] leading-none font-bold text-white`}
          style={{ background: 'var(--danger)' }}
          aria-hidden
        >
          !
        </span>
      )}
      {look === 'wrong' && (
        <span className={`absolute top-0 right-0 grid ${dot} place-items-center rounded-bl-md text-white`} style={{ background: 'var(--warning)' }} aria-hidden>
          <Undo2 className="size-2.5" strokeWidth={3.5} />
        </span>
      )}
    </span>
  )
}

/** The areas as they sit on the shelf: the upper half first, each half from left to right. */
export function shelfOrder(tasks: Task[]): Task[] {
  const cy = (x: Task) => x.area.quad.reduce((s, p) => s + p[1], 0) / 4
  const cx = (x: Task) => x.area.quad.reduce((s, p) => s + p[0], 0) / 4
  const byY = [...tasks].sort((a, b) => cy(a) - cy(b))
  const cut = Math.ceil(byY.length / 2)
  return [...byY.slice(0, cut).sort((a, b) => cx(a) - cx(b)), ...byY.slice(cut).sort((a, b) => cx(a) - cx(b))]
}

/** A gondola as one box: a header with its name and what is wrong in chips, then one tile per shelf area. The same block at every width. */
export function GondolaBlock({
  camera,
  tasks,
  rank,
  wide,
  extra,
  onPick,
}: {
  camera: string
  tasks: Task[]
  rank: number
  wide: boolean
  extra?: { bring: string[]; since: number | null }
  onPick: () => void
}) {
  const { gondola, gondolaWhat } = useStore()
  const { t, family } = useI18n()
  const empty = tasks.filter((x) => x.group === 'restock').length
  const wrong = tasks.filter((x) => x.group === 'moveBack').length
  const problemTiles = shelfOrder(tasks).filter(isProblem)
  const fine = tasks.filter((x) => x.group === 'allGood').length
  const first = rank === 1
  const number = rank > 0 && (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-medium tabular-nums ${first ? 'size-8 text-copy' : 'size-6 text-meta'}`}
      style={{ background: 'var(--sunk)', color: 'var(--fg-secondary)' }}
      aria-label={t.plan.stop(rank)}
    >
      {rank}
    </span>
  )
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`${gondola(camera)}, ${gondolaWhat(camera)}`}
      className={`relative z-10 flex h-full min-h-40 min-w-0 cursor-pointer flex-col gap-2 rounded-xl p-2.5 text-left transition-colors hover:bg-raised ${wide ? 'col-span-full sm:col-span-2' : ''}`}
      style={{ background: empty + wrong === 0 ? mix('var(--success)', 14) : mix('var(--raised)', 62, 'var(--bg)') }}
    >
      <span className="flex h-8 items-center gap-2">
        {number}
        <span className="min-w-0">
          <span className="block text-ui leading-tight font-medium whitespace-nowrap">{gondola(camera)}</span>
        </span>
        {empty + wrong === 0 && (
          <Check className="ml-auto size-5 shrink-0 self-start" style={{ color: 'var(--success)' }} strokeWidth={3} role="img" aria-label={t.plan.allFine} />
        )}
      </span>
      {extra && (
        <span className="flex flex-wrap items-center gap-1">
          <span className="mr-0.5 text-meta text-fg-muted">{t.bring}</span>
          {extra.bring.slice(0, 5).map((f) => (
            <span key={f} title={family(f)} className="grid size-7 place-items-center rounded-md" style={{ background: mix('var(--danger)', 14), color: 'var(--danger)' }}>
              <ProductIcon family={f} label={family(f)} className="size-5" />
            </span>
          ))}
          {extra.since != null && <span className="ml-1 text-meta text-fg-secondary">{t.emptySince(clock(extra.since))}</span>}
        </span>
      )}
      {problemTiles.length > 0 && (
        <span className="grid gap-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(30px, 1fr))' }}>
          {problemTiles.map((x) => (
            <AreaTile key={x.area.area_id} task={x} />
          ))}
        </span>
      )}
      {problemTiles.length > 0 && fine > 0 && <span className="mt-auto text-meta text-fg-muted">{t.plan.fineCount(fine)}</span>}
    </button>
  )
}

/** Columns for the width: the plan from 1024 with five (four while the panel is narrow), then four, then two. */
export function useLayout() {
  const calc = () => {
    const w = typeof window === 'undefined' ? 1280 : window.innerWidth
    return { plan: w >= 1024, cols: w >= 1280 ? 5 : w >= 640 ? 4 : 2 }
  }
  const [v, setV] = useState(calc)
  useEffect(() => {
    const on = () => setV((p) => (JSON.stringify(p) === JSON.stringify(calc()) ? p : calc()))
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return v
}

/** Walls, the department name, rows of gondolas with a flat aisle band after each, and an opening for the door. Flat tones only. */
export function Plan({
  list,
  cols,
  byCamera,
  rankOf,
  choose,
}: {
  list: string[]
  cols: number
  byCamera: Record<string, Task[]>
  rankOf: (c: string) => number
  choose: (c: string) => void
}) {
  const rows = useMemo(() => Array.from({ length: Math.ceil(list.length / cols) }, (_, r) => list.slice(r * cols, r * cols + cols)), [list, cols])
  return (
    <div className="pb-9">
      <div className="relative rounded-3xl p-2.5 pb-0" style={{ background: WALL }}>
        <div className="rounded-t-2xl px-4 pt-4" style={{ background: FLOOR }}>
          {rows.map((row, r) => (
            <div key={r}>
              <div className="mb-4 grid gap-x-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {row.map((c) => (
                  <GondolaBlock
                    key={c}
                    camera={c}
                    tasks={byCamera[c] ?? []}
                    rank={rankOf(c)}
                    wide={false}
                    onPick={() => choose(c)}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="h-8" />
        </div>
        {/* the opening in the bottom wall: a clean doorway with a lighter threshold and an arrow into the store */}
        <div className="flex h-9 justify-center">
          <span className="grid w-[17%] min-w-32 place-items-center rounded-b-3xl" style={{ background: mix('var(--bg)', 70, FLOOR) }} aria-hidden>
            <ChevronsUp className="size-6 text-fg-muted" />
          </span>
        </div>
      </div>
    </div>
  )
}
