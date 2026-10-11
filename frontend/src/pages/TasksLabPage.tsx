import { Check, ChevronRight, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ProductIcon } from '@/components/ProductIcon'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { suggest } from '@/lib/suggest'
import { cameras, type Task } from '@/lib/tasks'
import { clock } from '@/lib/time'
import { Plan } from '@/pages/MapStorePage'

const mix = (c: string, pct: number) => `color-mix(in oklab, ${c} ${pct}%, var(--raised))`

/** What to carry to a gondola: the products that are empty, with how many areas, and the ones to put back. */
function Chips({ tasks }: { tasks: Task[] }) {
  const { family, t } = useI18n()
  const count = (group: Task['group']) => {
    const m = new Map<string, number>()
    for (const x of tasks.filter((y) => y.group === group)) m.set(x.area.family, (m.get(x.area.family) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  const bring = count('restock')
  const back = count('moveBack')
  return (
    <span className="flex flex-wrap gap-1.5">
      {bring.map(([f, n]) => (
        <span key={`b${f}`} title={`${family(f)} · ${t.level.empty}`} className="flex h-8 items-center gap-1 rounded-lg pr-2 pl-1" style={{ background: mix('var(--danger)', 14), color: 'var(--danger)' }}>
          <ProductIcon family={f} label={family(f)} className="size-6" />
          <span className="text-meta font-medium tabular-nums">×{n}</span>
        </span>
      ))}
      {back.map(([f, n]) => (
        <span key={`m${f}`} title={`${family(f)} · ${t.wrongProduct}`} className="flex h-8 items-center gap-1 rounded-lg pr-2 pl-1" style={{ background: mix('var(--warning)', 26), color: 'var(--warning)' }}>
          <ProductIcon family={f} label={family(f)} className="size-6" />
          <Undo2 className="size-3" aria-hidden />
          <span className="text-meta font-medium tabular-nums">×{n}</span>
        </span>
      ))}
    </span>
  )
}

/**
 * The first page as one screen: the map on the left says where, and a list on the right says what to
 * carry, stop by stop, in the order of the round. Pressing a stop or a gondola opens its page.
 * Not in the menu: /lab/tasks.
 */
export function TasksLabPage() {
  const { t } = useI18n()
  const { state, tasks, gondola } = useStore()
  const navigate = useNavigate()
  const [all, setAll] = useState(false)
  // Only a gondola with something empty or in the wrong place is work; half full is not.
  const ranked = useMemo(() => suggest(tasks).filter((s) => s.empty + s.wrong > 0), [tasks])
  const order = ranked.map((s) => s.camera)
  const list = cameras(state)
  const byCamera = useMemo(() => {
    const m: Record<string, Task[]> = {}
    for (const x of tasks) (m[x.area.camera] ??= []).push(x)
    return m
  }, [tasks])
  const rankOf = (c: string) => (order.indexOf(c) >= 0 && order.indexOf(c) < 3 ? order.indexOf(c) + 1 : 0)
  const shown = all ? ranked : ranked.slice(0, 5)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6">
        <h1 className="text-display">{ranked.length === 0 ? t.planHeadline(0) : t.planHeadline(ranked.length)}</h1>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Plan list={list} cols={4} byCamera={byCamera} rankOf={rankOf} choose={(c) => navigate(`/gondolas/${c}`)} />

        <aside>
          <h2 className="flex h-9 items-center px-1 text-label text-fg-muted">{t.goFirst}</h2>
          {ranked.length === 0 && (
            <p className="flex items-center gap-2 rounded-xl p-3 text-copy" style={{ background: mix('var(--success)', 14) }}>
              <Check className="size-5" style={{ color: 'var(--success)' }} strokeWidth={3} />
              {t.plan.nothingToDo}
            </p>
          )}
          <ol className="flex flex-col gap-2">
            {shown.map((s, i) => (
              <li key={s.camera}>
                <Link to={`/gondolas/${s.camera}`} className="group block rounded-xl p-3 transition-colors hover:bg-raised" style={{ background: 'color-mix(in oklab, var(--raised) 55%, var(--bg))' }}>
                  <span className="mb-2 flex items-center gap-2.5">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full text-meta tabular-nums text-fg-secondary" style={{ background: 'var(--sunk)' }}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-label">{gondola(s.camera)}</span>
                    {s.emptySince !== null && <span className="text-meta tabular-nums text-fg-muted">{clock(s.emptySince)}</span>}
                    <ChevronRight className="size-4 text-fg-muted transition-colors group-hover:text-fg" aria-hidden />
                  </span>
                  <Chips tasks={byCamera[s.camera] ?? []} />
                </Link>
              </li>
            ))}
          </ol>
          {ranked.length > 5 && (
            <button type="button" onClick={() => setAll(!all)} className="mt-2 h-10 w-full cursor-pointer rounded-xl text-ui text-fg-secondary transition-colors hover:bg-surface">
              {all ? t.showFewer : t.showMore(ranked.length - 5)}
            </button>
          )}
        </aside>
      </div>
    </>
  )
}
