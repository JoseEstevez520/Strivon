import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { CameraTile } from './CameraTile'
import { DayBar } from './DayBar'
import { PhotoStage } from './PhotoStage'
import { TaskGroup } from './TaskGroup'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { ACTION, cameras, snapshot, type Group, type Task } from '@/lib/tasks'
import { clock } from '@/lib/time'
import { useSelection } from '@/lib/useSelection'

const GROUPS: Group[] = ['restock', 'moveBack', 'later', 'allGood']
// On a gondola's own page everything is already in that gondola, so a place would only repeat it.
const nowhere = () => ''

interface Props {
  /** The tasks to list. */
  tasks: Task[]
  /** A fixed camera for the photo. Without it the panel shows every camera until a task is open. */
  camera?: string
  /** List every area that is fine, as a gondola's own page does. */
  listFine?: boolean
  initialSelected?: string | null
}

/** The tasks on one side. On the other, every camera, or the photo of what is open. */
export function TaskBoard({ tasks, camera, listFine = false, initialSelected = null }: Props) {
  const { t } = useI18n()
  const { state, at, tasks: all, gondola, where, historyOf, jumpTo, photoUrl } = useStore()
  const [selected, select] = useSelection(initialSelected)

  const selectedTask = all.find((x) => x.area.area_id === selected)
  const photoCamera = camera ?? selectedTask?.area.camera
  const photo = photoCamera ? snapshot(state, photoCamera, at) : null

  const sortedCameras = cameras(state)
    .map((c) => ({ c, pending: all.filter((x) => x.area.camera === c && ACTION.includes(x.group)).length }))
    .sort((a, b) => b.pending - a.pending || a.c.localeCompare(b.c))

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div>
        {GROUPS.map((g) => (
          <TaskGroup
            key={g}
            group={g}
            tasks={tasks.filter((x) => x.group === g)}
            selected={selected}
            listFine={listFine}
            gondola={gondola}
            where={camera ? nowhere : where}
            historyOf={historyOf}
            onSelect={select}
            onJump={jumpTo}
          />
        ))}
      </div>

      <div className="lg:sticky lg:top-5">
        {photoCamera && photo ? (
          <>
            <div className="mb-2 flex items-center justify-between gap-3 px-1 text-meta tabular-nums text-fg-muted">
              {!camera && (
                <button
                  type="button"
                  onClick={() => select(null)}
                  className="flex cursor-pointer items-center gap-1 rounded-sm transition-colors hover:text-fg-secondary"
                >
                  <ChevronLeft className="size-3.5" />
                  {t.allCameras}
                </button>
              )}
              {camera ? (
                <span className="ml-auto">
                  {gondola(photoCamera)} · {clock(photo.ts)}
                </span>
              ) : (
                <Link
                  to={`/gondolas/${photoCamera}`}
                  className="ml-auto flex items-center gap-1 rounded-sm transition-colors hover:text-fg-secondary"
                >
                  {gondola(photoCamera)} · {clock(photo.ts)}
                  <ChevronRight className="size-3.5" />
                </Link>
              )}
            </div>
            <PhotoStage
              tasks={all.filter((x) => x.area.camera === photoCamera)}
              selected={selected}
              src={photoUrl?.(photoCamera, photo.image)}
              onSelect={(id) => select(selected === id ? null : id, 'photo')}
            />
          </>
        ) : (
          <ul className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {sortedCameras.map(({ c }) => (
              <li key={c}>
                <CameraTile camera={c} />
              </li>
            ))}
          </ul>
        )}
        <DayBar className="mt-4" />
      </div>
    </div>
  )
}
