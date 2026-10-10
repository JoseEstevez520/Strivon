import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { GROUP_COLOR, GROUP_ICON } from './groupStyle'
import { ShelfCard } from './ShelfCard'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { suggest, type Suggestion } from '@/lib/suggest'
import { snapshot } from '@/lib/tasks'
import { clock } from '@/lib/time'

/** What a gondola needs, as the same icons and counts the tiles use. */
function Counts({ s }: { s: Suggestion }) {
  const { t } = useI18n()
  const items = [
    ['restock', s.empty, t.level.empty],
    ['later', s.half, t.level.half],
    ['moveBack', s.wrong, t.wrongProduct],
  ] as const
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1 text-meta font-medium tabular-nums text-fg-secondary">
      {items
        .filter(([, n]) => n > 0)
        .map(([group, n, label]) => {
          const Icon = GROUP_ICON[group]
          return (
            <span key={group} className="flex items-center gap-1">
              <Icon className="size-3.5" style={{ color: GROUP_COLOR[group] }} aria-hidden />
              {n} <span className="font-normal text-fg-muted">{label}</span>
            </span>
          )
        })}
    </span>
  )
}

/**
 * Where to go and what to carry, worked out from what is empty, half full and in the wrong place.
 * The first is the one to go to; the next two are the ones after it.
 */
export function Suggestions() {
  const { t } = useI18n()
  const { state, tasks, at, gondola, gondolaWhat, photoUrl } = useStore()
  const list = useMemo(() => suggest(tasks), [tasks])
  if (list.length === 0) return null
  const [first, ...rest] = list
  const photo = (camera: string) => photoUrl?.(camera, snapshot(state, camera, at).image)

  return (
    <div>
      <h2 className="flex h-9 items-center px-1 text-label text-fg-muted">{t.goFirst}</h2>
      <Link
        to={`/gondolas/${first.camera}`}
        className="group block rounded-2xl bg-surface p-2 transition-colors hover:bg-raised"
      >
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-[#d6d8d0]">
          {photo(first.camera) && (
            <img src={photo(first.camera)!} alt="" decoding="async" className="absolute inset-0 size-full object-cover" />
          )}
        </div>
        <div className="px-2 pt-3 pb-2">
          <div className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-title">{gondola(first.camera)}</span>
              <span className="block text-ui text-fg-muted">{gondolaWhat(first.camera)}</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-fg-muted transition-colors group-hover:text-fg" aria-hidden />
          </div>
          <div className="mt-2">
            <Counts s={first} />
          </div>
          {first.emptySince !== null && <p className="mt-2 text-meta text-fg-muted">{t.emptySince(clock(first.emptySince))}</p>}
          <ShelfCard tasks={tasks.filter((x) => x.area.camera === first.camera)} className="mt-3" />
        </div>
      </Link>

      {rest.length > 0 && (
        <>
          <h2 className="mt-6 flex h-9 items-center px-1 text-label text-fg-muted">{t.thenGo}</h2>
          <ul className="flex flex-col gap-2">
            {rest.slice(0, 3).map((s, i) => (
              <li key={s.camera}>
                <Link to={`/gondolas/${s.camera}`} className="flex items-center gap-3 rounded-xl bg-surface p-2 pr-3 transition-colors hover:bg-raised">
                  <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-[#d6d8d0]">
                    {photo(s.camera) && <img src={photo(s.camera)!} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="text-meta tabular-nums text-fg-muted">{i + 2}</span>
                      <span className="truncate text-label">{gondola(s.camera)}</span>
                      <span className="truncate text-meta text-fg-muted">{gondolaWhat(s.camera)}</span>
                    </span>
                    <Counts s={s} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
