import { CircleAlert, Undo2 } from 'lucide-react'
import { useMemo } from 'react'
import { GROUP_COLOR } from './groupStyle'
import { useI18n } from '@/lib/i18n'
import { cameras, type Group, type Task } from '@/lib/tasks'
import { place } from '@/model/layout'
import { useStore } from '@/lib/store'

const COLUMNS = 4

/** The state of an area as one small square: the colour says what it needs, grey that it is fine. */
const squareColor = (g: Group) =>
  g === 'restock' ? GROUP_COLOR.restock : g === 'moveBack' ? GROUP_COLOR.moveBack : g === 'later' ? 'color-mix(in oklab, var(--fg) 30%, transparent)' : 'var(--sunk)'

/**
 * The store as a plan: one block for every gondola, tinted by the worst thing it has, with a square
 * for each of its shelf areas and the warnings counted in a corner. Pick one to see it.
 */
export function StoreMap({ tasks, selected, onSelect }: { tasks: Task[]; selected: string | null; onSelect: (camera: string) => void }) {
  const { t } = useI18n()
  const { state, gondola } = useStore()
  const placed = useMemo(() => place(cameras(state), COLUMNS), [state])
  const rows = Math.max(...placed.map((p) => p.row)) + 1

  return (
    <div
      className="grid gap-x-3 gap-y-5"
      style={{ gridTemplateColumns: `repeat(${Math.max(...placed.map((p) => p.col)) + 1}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, auto)` }}
    >
      {placed.map(({ camera, col, row }) => {
        const own = tasks.filter((x) => x.area.camera === camera).sort((a, b) => a.area.index - b.area.index)
        const count = (g: Group) => own.filter((x) => x.group === g).length
        const restock = count('restock')
        const moveBack = count('moveBack')
        const worst: Group = restock ? 'restock' : moveBack ? 'moveBack' : 'allGood'
        const on = camera === selected
        return (
          <button
            key={camera}
            type="button"
            onClick={() => onSelect(camera)}
            style={{ gridColumn: col + 1, gridRow: row + 1, '--c': worst === 'allGood' ? 'transparent' : GROUP_COLOR[worst] } as React.CSSProperties}
            data-on={on}
            className="flex min-h-28 cursor-pointer flex-col justify-between gap-3 rounded-xl bg-[color-mix(in_oklab,var(--c)_13%,var(--surface))] p-3 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--c)_20%,var(--surface))] data-[on=true]:bg-[color-mix(in_oklab,var(--c)_26%,var(--raised))]"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="line-clamp-2 text-label">{gondola(camera)}</span>
              <span className="flex shrink-0 gap-2 text-meta font-medium tabular-nums text-fg-secondary">
                {restock > 0 && (
                  <span className="flex items-center gap-1" title={t.restock}>
                    <CircleAlert className="size-3.5" style={{ color: GROUP_COLOR.restock }} aria-hidden />
                    {restock}
                    <span className="sr-only">{t.restock}</span>
                  </span>
                )}
                {moveBack > 0 && (
                  <span className="flex items-center gap-1" title={t.moveBack}>
                    <Undo2 className="size-3.5" style={{ color: GROUP_COLOR.moveBack }} aria-hidden />
                    {moveBack}
                    <span className="sr-only">{t.moveBack}</span>
                  </span>
                )}
              </span>
            </span>
            <span className="flex flex-wrap gap-1" aria-hidden>
              {own.map((x) => (
                <span key={x.area.area_id} className="size-2.5 rounded-[3px]" style={{ background: squareColor(x.group) }} />
              ))}
            </span>
          </button>
        )
      })}
    </div>
  )
}
