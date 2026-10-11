import { Check, ChevronRight } from 'lucide-react'
import { Canvas } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { suggest } from '@/lib/suggest'
import type { Task } from '@/lib/tasks'
import { clock } from '@/lib/time'
import { Scene } from '@/pages/Map3DPage'
import { Chips } from '@/pages/TasksLabPage'

/**
 * The first page with the 3D store on the left, which says where and how full each shelf is, and
 * on the right the list of what to carry, stop by stop in the order of the round. Pressing a stop
 * or a gondola opens its page. Not in the menu: /lab/tasks-3d.
 */
export function Tasks3DLabPage() {
  const { t } = useI18n()
  const { tasks, gondola } = useStore()
  const navigate = useNavigate()
  const [all, setAll] = useState(false)
  const ranked = useMemo(() => suggest(tasks).filter((s) => s.empty + s.wrong > 0), [tasks])
  const byCamera = useMemo(() => {
    const m: Record<string, Task[]> = {}
    for (const x of tasks) (m[x.area.camera] ??= []).push(x)
    return m
  }, [tasks])
  const shown = all ? ranked : ranked.slice(0, 5)

  return (
    <>
      <h1 className="mb-4 text-display">{t.planHeadline(ranked.length)}</h1>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-2 h-[min(80dvh,50rem)] min-h-[24rem] overflow-hidden rounded-2xl xl:order-1" style={{ background: 'var(--bg)' }}>
          <Canvas flat dpr={[1, 2]} frameloop="demand" gl={{ antialias: true }}>
            <Scene view="front" onOpen={(c) => navigate(`/gondolas/${c}`)} onHoverChange={() => undefined} />
          </Canvas>
        </div>

        <aside className="order-1 xl:order-2">
          <h2 className="flex h-9 items-center px-1 text-label text-fg-muted">{t.goFirst}</h2>
          {ranked.length === 0 && (
            <p className="flex items-center gap-2 rounded-xl p-3 text-copy" style={{ background: 'color-mix(in oklab, var(--success) 14%, var(--raised))' }}>
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
