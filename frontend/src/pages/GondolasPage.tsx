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
    .map((camera) => ({
      camera,
      pending: tasks.filter((x) => x.area.camera === camera && ACTION.includes(x.group)).length,
    }))
  // The order is fixed, so each gondola stays where the staff learned to look for it.
  const needing = rows.filter((r) => r.pending > 0).length

  return (
    <>
      <h1 className="mb-8 text-display">{t.gondolasHeadline(needing)}</h1>
      <DayBar className="mb-6" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((r) => (
          <li key={r.camera}>
            <CameraTile camera={r.camera} />
          </li>
        ))}
      </ul>
    </>
  )
}
