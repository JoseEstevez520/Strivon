import { CameraTile } from '@/components/CameraTile'
import { DayBar } from '@/components/DayBar'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { ACTION, cameras } from '@/lib/tasks'

/** Every gondola of the store at a glance, the ones that need someone first. */
export function GondolasPage() {
  const { t } = useI18n()
  const { state, tasks } = useStore()

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
      <DayBar className="mb-6" />
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((r) => (
          <li key={r.camera}>
            <CameraTile camera={r.camera} />
          </li>
        ))}
      </ul>
    </>
  )
}
