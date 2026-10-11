import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { suggest } from '@/lib/suggest'
import { snapshot } from '@/lib/tasks'
import { clock } from '@/lib/time'
import { AreaTile, isProblem, shelfOrder } from '@/pages/MapStorePage'

/**
 * Where to go next, and nothing else. The first gondola shows its photo, its name, since when it
 * has been empty and a tile for each thing that is wrong in it. The next three are a name and how
 * many things are wrong. What is fine or half full is not drawn: it is not work, and the gondola
 * page has it. Pressing any of them opens its gondola.
 */
export function Suggestions() {
  const { t } = useI18n()
  const { state, tasks, at, gondola, photoUrl } = useStore()
  const list = useMemo(() => suggest(tasks), [tasks])
  if (list.length === 0) return null
  const [first, ...rest] = list
  const src = photoUrl?.(first.camera, snapshot(state, first.camera, at).image)
  const problems = shelfOrder(tasks.filter((x) => x.area.camera === first.camera)).filter(isProblem)

  return (
    <div>
      <h2 className="flex h-9 items-center px-1 text-label text-fg-muted">{t.goFirst}</h2>
      <Link to={`/gondolas/${first.camera}`} className="group block rounded-2xl bg-surface p-2 transition-colors hover:bg-raised">
        <div className="relative aspect-[16/9] overflow-hidden rounded-xl bg-[#d6d8d0]">
          {src && <img src={src} alt="" decoding="async" className="absolute inset-0 size-full object-cover" />}
        </div>
        <div className="flex items-start justify-between gap-3 px-2 pt-3">
          <span>
            <span className="block text-title">{gondola(first.camera)}</span>
            {first.emptySince !== null && <span className="block text-meta text-fg-muted">{t.emptySince(clock(first.emptySince))}</span>}
          </span>
          <ChevronRight className="mt-1 size-5 shrink-0 text-fg-muted transition-colors group-hover:text-fg" aria-hidden />
        </div>
        <span className="grid gap-1 px-2 pt-3 pb-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(30px, 1fr))' }}>
          {problems.map((x) => (
            <AreaTile key={x.area.area_id} task={x} />
          ))}
        </span>
      </Link>

      {rest.length > 0 && (
        <>
          <h2 className="mt-6 flex h-9 items-center px-1 text-label text-fg-muted">{t.thenGo}</h2>
          <ul className="flex flex-col gap-1">
            {rest.slice(0, 3).map((s, i) => (
              <li key={s.camera}>
                <Link to={`/gondolas/${s.camera}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full text-meta tabular-nums text-fg-secondary" style={{ background: 'var(--sunk)' }}>
                    {i + 2}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-label">{gondola(s.camera)}</span>
                  <span className="text-meta tabular-nums text-fg-muted">{s.empty + s.wrong}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
