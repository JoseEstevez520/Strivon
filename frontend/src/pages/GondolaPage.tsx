import { Check, ChevronLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import { DayBar } from '@/components/DayBar'
import { PhotoStage } from '@/components/PhotoStage'
import { ProductIcon } from '@/components/ProductIcon'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { snapshot, type Group, type Task } from '@/lib/tasks'
import { clock } from '@/lib/time'

const mix = (c: string, pct: number) => `color-mix(in oklab, ${c} ${pct}%, var(--raised))`
const TINT: Record<Group, { bg: string; ink: string }> = {
  restock: { bg: mix('var(--danger)', 16), ink: 'var(--danger)' },
  moveBack: { bg: mix('var(--warning)', 26), ink: 'var(--warning)' },
  later: { bg: 'var(--sunk)', ink: 'var(--fg-secondary)' },
  allGood: { bg: 'var(--raised)', ink: 'var(--fg-secondary)' },
}

/** One product in one state in this gondola: how many areas, and since when. */
interface Line {
  key: string
  group: Group
  family: string
  tasks: Task[]
}

/**
 * One gondola: the camera photo with what is wrong marked on it, and what is wrong in plain
 * words, one line for each product. A view of what the cameras see: nothing here is pressed to
 * be done, because the next photo clears a warning by itself.
 */
export function GondolaPage() {
  const { t, family } = useI18n()
  const { camera = '' } = useParams()
  const [params] = useSearchParams()
  const { state, tasks, at, gondola, gondolaWhat, photoUrl, where } = useStore()
  const [hover, setHover] = useState<string | null>(params.get('area'))

  const own = useMemo(() => tasks.filter((x) => x.area.camera === camera), [tasks, camera])
  const lines = useMemo(() => {
    const m = new Map<string, Line>()
    for (const x of own.filter((y) => y.group !== 'allGood')) {
      const key = `${x.group}:${x.area.family}`
      if (!m.has(key)) m.set(key, { key, group: x.group, family: x.area.family, tasks: [] })
      m.get(key)!.tasks.push(x)
    }
    const rank: Record<Group, number> = { restock: 0, moveBack: 1, later: 2, allGood: 3 }
    return [...m.values()].sort((a, b) => rank[a.group] - rank[b.group] || b.tasks.length - a.tasks.length)
  }, [own])

  if (!state.images[camera]) return <Navigate to="/map" replace />
  const photo = snapshot(state, camera, at)
  const fine = own.filter((x) => x.group === 'allGood').length
  const problems = lines.filter((l) => l.group === 'restock' || l.group === 'moveBack')
  const sectionOf = (g: Group) => (g === 'restock' ? t.level.empty : g === 'moveBack' ? t.wrongProduct : t.level.half)

  return (
    <>
      <Link to="/map" className="mb-3 inline-flex items-center gap-1 rounded-sm text-meta text-fg-muted transition-colors hover:text-fg-secondary">
        <ChevronLeft className="size-3.5" />
        {t.navMap}
      </Link>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h1 className="text-display">{gondola(camera)}</h1>
          <p className="mt-1 text-copy text-fg-muted">{gondolaWhat(camera)}</p>
        </div>
        <p className="text-meta tabular-nums text-fg-muted">{t.photoFrom(clock(photo.ts))}</p>
      </div>
      <DayBar className="mb-6" />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <PhotoStage tasks={own} selected={hover} src={photoUrl?.(camera, photo.image)} onSelect={(id) => setHover(hover === id ? null : id)} marks />
        </div>

        <div className="flex flex-col gap-5">
          {problems.length === 0 && (
            <p className="flex items-center gap-2 rounded-xl p-3 text-copy" style={{ background: mix('var(--success)', 14) }}>
              <Check className="size-5" style={{ color: 'var(--success)' }} strokeWidth={3} />
              {t.plan.nothingHere}
            </p>
          )}
          {(['restock', 'moveBack', 'later'] as Group[]).map((g) => {
            const group = lines.filter((l) => l.group === g)
            if (group.length === 0) return null
            return (
              <section key={g}>
                <h2 className="mb-2 px-1 text-label text-fg-muted">{sectionOf(g)}</h2>
                <ul className="flex flex-col gap-2">
                  {group.map((l) => {
                    const first = l.tasks[0]
                    const on = l.tasks.some((x) => x.area.area_id === hover)
                    const since = l.tasks.map((x) => x.since).filter((v): v is number => v != null)
                    const seen = first.obs.observed_family
                    return (
                      <li
                        key={l.key}
                        onMouseEnter={() => setHover(first.area.area_id)}
                        onMouseLeave={() => setHover(null)}
                        className="flex items-center gap-3 rounded-xl p-2.5 transition-colors"
                        style={{ background: on ? 'var(--raised)' : 'color-mix(in oklab, var(--raised) 60%, var(--bg))' }}
                      >
                        <span className="grid size-11 shrink-0 place-items-center rounded-lg" style={{ background: TINT[g].bg, color: TINT[g].ink }}>
                          <ProductIcon family={l.family} label={family(l.family)} className="size-7" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-label">
                            {family(l.family)}
                            {l.tasks.length > 1 && <span className="ml-1.5 font-normal text-fg-muted tabular-nums">×{l.tasks.length}</span>}
                          </span>
                          <span className="block text-meta text-fg-secondary">
                            {g === 'restock' && since.length > 0 && t.emptySince(clock(Math.min(...since)))}
                            {g === 'moveBack' && (seen ? t.wrongPlace(family(seen)) : t.wrongProduct)}
                            {g === 'later' && where(first.area)}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
          {fine > 0 && <p className="px-1 text-meta text-fg-muted">{t.plan.fineCount(fine)}</p>}
        </div>
      </div>
    </>
  )
}
