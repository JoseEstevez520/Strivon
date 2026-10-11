import { Check, ChevronRight, Footprints, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { BringList } from '@/components/BringList'
import { Segmented } from '@/components/ui/segmented'
import { ProductIcon } from '@/components/ProductIcon'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import type { Suggestion } from '@/lib/suggest'
import type { Task } from '@/lib/tasks'
import { clock } from '@/lib/time'

const mix = (c: string, pct: number) => `color-mix(in oklab, ${c} ${pct}%, var(--raised))`

/** What to carry to a gondola: the products that are empty, with how many areas, and the ones to put back. */
export function Chips({ tasks }: { tasks: Task[] }) {
  const { family, t } = useI18n()
  const count = (group: Task['group']) => {
    const m = new Map<string, number>()
    for (const x of tasks.filter((y) => y.group === group)) m.set(x.area.family, (m.get(x.area.family) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {count('restock').map(([f, n]) => (
        <span key={`b${f}`} title={`${family(f)} · ${t.level.empty}`} className="flex h-8 items-center gap-1 rounded-lg pr-2 pl-1" style={{ background: mix('var(--danger)', 14), color: 'var(--danger)' }}>
          <ProductIcon family={f} label={family(f)} className="size-6" />
          <span className="text-meta font-medium tabular-nums">×{n}</span>
        </span>
      ))}
      {count('moveBack').map(([f, n]) => (
        <span key={`m${f}`} title={`${family(f)} · ${t.wrongProduct}`} className="flex h-8 items-center gap-1 rounded-lg pr-2 pl-1" style={{ background: mix('var(--warning)', 26), color: 'var(--warning)' }}>
          <ProductIcon family={f} label={family(f)} className="size-6" />
          <Undo2 className="size-3" aria-hidden />
          <span className="text-meta font-medium tabular-nums">×{n}</span>
        </span>
      ))}
    </span>
  )
}

/** The round as a list: one stop per gondola in the order to walk, with what to carry to each. Five show, the rest on demand. */
export function StopList({ stops, byCamera, tasks }: { stops: Suggestion[]; byCamera: Record<string, Task[]>; tasks: Task[] }) {
  const { t } = useI18n()
  const { gondola } = useStore()
  const [all, setAll] = useState(false)
  const [view, setView] = useState<'stops' | 'bring'>('stops')
  const shown = all ? stops : stops.slice(0, 5)
  return (
    <aside>
      {stops.length > 0 && (
        <Link to="/round" className="mb-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-surface text-ui font-medium transition-colors hover:bg-raised">
          <Footprints className="size-4" aria-hidden />
          {t.roundStart}
        </Link>
      )}
      <Segmented
        className="mb-3"
        label={t.goFirst}
        options={[
          { value: 'stops', label: t.goFirst },
          { value: 'bring', label: t.toBring },
        ]}
        on={(v) => view === v}
        onPick={(v) => setView(v as 'stops' | 'bring')}
      />
      {view === 'bring' ? (
        <BringList tasks={tasks} />
      ) : (
        <>
      {stops.length === 0 && (
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
      {stops.length > 5 && (
        <button type="button" onClick={() => setAll(!all)} className="mt-2 h-10 w-full cursor-pointer rounded-xl text-ui text-fg-secondary transition-colors hover:bg-surface">
          {all ? t.showFewer : t.showMore(stops.length - 5)}
        </button>
      )}
        </>
      )}
    </aside>
  )
}
