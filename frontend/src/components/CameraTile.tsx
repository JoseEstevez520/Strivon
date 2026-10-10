import { Link } from 'react-router'
import { GROUP_COLOR, GROUP_ICON } from './groupStyle'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { snapshot, type Group } from '@/lib/tasks'

/** The states a tile counts. What is fine is not counted: when none of these apply, it says so. */
const COUNTED: Group[] = ['restock', 'moveBack', 'later']

/**
 * One camera: its latest photo, what it is called, and how many areas are in each state, with the
 * same icons as the group headings so nothing needs a legend.
 */
export function CameraTile({ camera }: { camera: string }) {
  const { t } = useI18n()
  const { state, at, tasks, gondola, photoUrl } = useStore()
  const own = tasks.filter((x) => x.area.camera === camera)
  const counts = COUNTED.map((g) => [g, own.filter((x) => x.group === g).length] as const)
  const anything = counts.some(([, n]) => n > 0)
  const src = photoUrl?.(camera, snapshot(state, camera, at).image)

  return (
    <Link
      to={`/gondolas/${camera}`}
      className="flex h-full flex-col gap-2 rounded-xl bg-surface p-2 transition-colors hover:bg-raised"
    >
      <div className="relative aspect-video overflow-hidden rounded-lg bg-[#d6d8d0]">
        {src && <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />}
      </div>
      <div className="flex flex-col gap-1.5 px-1 pb-1">
        <span className="truncate text-label">{gondola(camera)}</span>
        {anything ? (
          // Three fixed columns, so a count sits in the same place on every tile and the row fills the width.
          <span className="grid grid-cols-3 text-meta font-medium tabular-nums">
            {counts.map(([group, n]) => {
              const Icon = GROUP_ICON[group]
              return (
                <span key={group} className={`flex items-center gap-1.5 ${n > 0 ? 'text-fg-secondary' : 'text-fg-muted opacity-50'}`} title={t[group]}>
                  <Icon className="size-3.5" style={n > 0 ? { color: GROUP_COLOR[group] } : undefined} aria-hidden />
                  {n}
                  <span className="sr-only">{t[group]}</span>
                </span>
              )
            })}
          </span>
        ) : (
          <span className="text-meta text-fg-muted">{t.allGood}</span>
        )}
      </div>
    </Link>
  )
}
