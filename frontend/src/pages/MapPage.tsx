import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { AreaCrop } from '@/components/AreaCrop'
import { DayBar } from '@/components/DayBar'
import { GROUP_COLOR, GROUP_ICON } from '@/components/groupStyle'
import { PhotoStage } from '@/components/PhotoStage'
import { StoreMap } from '@/components/StoreMap'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { ACTION, cameras, cardsOf, snapshot } from '@/lib/tasks'
import { clock } from '@/lib/time'

/** The store as a plan with what needs doing on it, and the gondola you pick beside it. */
export function MapPage() {
  const { t, family } = useI18n()
  const { state, tasks, at, gondola, photoUrl, where } = useStore()
  const [picked, setPicked] = useState<string | null>(null)

  // The gondolas that need something, and the one that needs the most, for the first view.
  const worst = useMemo(() => {
    const score = (camera: string) => {
      const own = tasks.filter((x) => x.area.camera === camera)
      return own.filter((x) => x.group === 'restock').length * 10 + own.filter((x) => x.group === 'moveBack').length
    }
    const list = cameras(state)
    return { needing: list.filter((c) => score(c) > 0).length, first: [...list].sort((a, b) => score(b) - score(a))[0] }
  }, [state, tasks])

  const camera = picked ?? worst.first
  const own = tasks.filter((x) => x.area.camera === camera)
  const photo = snapshot(state, camera, at)
  const todo = cardsOf(own.filter((x) => ACTION.includes(x.group)))

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h1 className="text-display">{t.planHeadline(worst.needing)}</h1>
        <p className="text-meta tabular-nums text-fg-muted">{t.photoFrom(clock(at))}</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <StoreMap tasks={tasks} selected={camera} onSelect={setPicked} />

        <div className="lg:sticky lg:top-4">
          <Link
            to={`/gondolas/${camera}`}
            className="mb-2 flex h-9 items-center justify-between gap-3 px-1 text-label text-fg-muted transition-colors hover:text-fg"
          >
            {gondola(camera)}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
          <PhotoStage tasks={own} selected={todo[0]?.tasks[0].area.area_id ?? null} src={photoUrl?.(camera, photo.image)} onSelect={() => {}} />
          <p className="mt-2 px-1 text-meta tabular-nums text-fg-muted">{clock(photo.ts)}</p>

          <ul className="mt-4 flex flex-col gap-2">
            {todo.map((c) => {
              const first = c.tasks[0]
              const Icon = GROUP_ICON[c.group]
              return (
                <li key={c.key}>
                  <Link
                    to={`/gondolas/${camera}?area=${first.area.area_id}`}
                    style={{ '--c': GROUP_COLOR[c.group] } as React.CSSProperties}
                    className="flex items-center gap-3 rounded-lg bg-[color-mix(in_oklab,var(--c)_13%,transparent)] p-2 pr-3 transition-colors hover:bg-[color-mix(in_oklab,var(--c)_19%,transparent)]"
                  >
                    <AreaCrop area={first.area} image={first.record.image} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-label">{family(first.area.family)}</span>
                      <span className="block truncate text-meta text-fg-secondary">
                        {c.tasks.length > 1 ? t.areasCount(c.tasks.length) : where(first.area, first.obs.observed_family)}
                      </span>
                    </span>
                    <span className="text-meta tabular-nums text-fg-secondary">{clock(first.since ?? first.record.ts)}</span>
                    <Icon className="size-4 text-[var(--c)]" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
          <DayBar className="mt-4" />
        </div>
      </div>
    </>
  )
}
