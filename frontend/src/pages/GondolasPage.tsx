import { Link } from 'react-router'
import { ACTION } from '@/components/TaskBoard'
import { StateStrip } from '@/components/StateStrip'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { cameras } from '@/lib/tasks'

/** Every gondola of the store at a glance, the ones that need someone first. */
export function GondolasPage() {
  const { t } = useI18n()
  const { state, tasks, gondola } = useStore()

  const rows = cameras(state)
    .map((camera) => {
      const own = tasks.filter((x) => x.area.camera === camera)
      return { camera, own, pending: own.filter((x) => ACTION.includes(x.group)).length }
    })
    .sort((a, b) => b.pending - a.pending || a.camera.localeCompare(b.camera))
  const needing = rows.filter((r) => r.pending > 0).length

  return (
    <>
      <h1 className="mb-8 text-display">{t.gondolasHeadline(needing)}</h1>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li key={r.camera}>
            <Link
              to={`/gondolas/${r.camera}`}
              className="flex h-full flex-col justify-between gap-4 rounded-xl bg-surface p-4 transition-colors hover:bg-raised"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-label">{gondola(r.camera)}</span>
                <span className="shrink-0 text-meta tabular-nums text-fg-secondary">
                  {r.pending > 0 ? t.toDo(r.pending) : t.allGood}
                </span>
              </div>
              <StateStrip tasks={r.own} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
