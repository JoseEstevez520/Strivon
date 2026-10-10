import { Link } from 'react-router'
import { GROUP_COLOR, GROUP_ICON } from './groupStyle'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { snapshot, type Group } from '@/lib/tasks'

/** The states a tile counts. What is fine is not counted: when none of these apply, it says so. */
const COUNTED: Group[] = ['restock', 'moveBack', 'later']

/**
 * One camera. The photo is the tile, and a small piece of the page tone sits on its lower edge with
 * the name and how many areas are in each state, in the same type and with the same icons as the
 * group headings. There is no box around the photo, so nothing is left to balance.
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
      className="group relative block aspect-[16/10] overflow-hidden rounded-2xl bg-[#d6d8d0]"
      title={gondola(camera)}
    >
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <div className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded-xl bg-[color-mix(in_oklab,var(--bg)_93%,transparent)] px-2.5 py-1.5 transition-colors group-hover:bg-raised">
        <div className="truncate text-label">{gondola(camera)}</div>
        <div className="flex items-center gap-3.5 text-meta font-medium tabular-nums text-fg-secondary">
          {counts.length > 0 ? (
            counts.map(([group, n]) => {
              const Icon = GROUP_ICON[group]
              return (
                <span key={group} className="flex items-center gap-1.5" title={t[group]}>
                  <Icon className="size-3.5" style={{ color: GROUP_COLOR[group] }} aria-hidden />
                  {n}
                  <span className="sr-only">{t[group]}</span>
                </span>
              )
            })
          ) : (
            <span className="font-normal text-fg-muted">{t.allGood}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
