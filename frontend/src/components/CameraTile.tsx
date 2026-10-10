import { Link } from 'react-router'
import { GROUP_COLOR, GROUP_ICON } from './groupStyle'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { snapshot, type Group } from '@/lib/tasks'

/** The states a tile counts. What is fine is not counted: when none of these apply, it says so. */
const COUNTED: Group[] = ['restock', 'moveBack', 'later']

/**
 * One camera. The photo sits whole in a quiet box and nothing covers it, because it is the proof of
 * what the app says. Under it, the name on the left, which may take two lines, and on the right how
 * many areas are in each state, with the same icons as the group headings.
 */
export function CameraTile({ camera }: { camera: string }) {
  const { t } = useI18n()
  const { state, at, tasks, gondola, photoUrl } = useStore()
  const own = tasks.filter((x) => x.area.camera === camera)
  const counts = COUNTED.map((g) => [g, own.filter((x) => x.group === g).length] as const).filter(([, n]) => n > 0)
  const src = photoUrl?.(camera, snapshot(state, camera, at).image)

  return (
    <Link
      to={`/gondolas/${camera}`}
      title={gondola(camera)}
      className="flex h-full flex-col gap-2 rounded-2xl bg-surface p-2 transition-colors hover:bg-raised"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#d6d8d0]">
        {src && <img src={src} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />}
      </div>
      <div className="flex flex-1 items-center justify-between gap-2.5 px-1 pb-1">
        <span className="line-clamp-2 min-w-0 text-label">{gondola(camera)}</span>
        <span className="flex shrink-0 gap-2.5 text-meta font-medium tabular-nums text-fg-secondary">
          {counts.length > 0 ? (
            counts.map(([group, n]) => {
              const Icon = GROUP_ICON[group]
              return (
                <span key={group} className="flex items-center gap-1" title={t[group]}>
                  <Icon className="size-3.5" style={{ color: GROUP_COLOR[group] }} aria-hidden />
                  {n}
                  <span className="sr-only">{t[group]}</span>
                </span>
              )
            })
          ) : (
            <span className="font-normal text-fg-muted">{t.allGood}</span>
          )}
        </span>
      </div>
    </Link>
  )
}
