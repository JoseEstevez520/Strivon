import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react'
import { Link } from 'react-router'
import { CameraTile } from './CameraTile'
import { DayBar } from './DayBar'
import { PhotoStage } from './PhotoStage'
import { TaskGroup } from './TaskGroup'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { cameras, snapshot, type Group, type Task } from '@/lib/tasks'
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

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div>
        {GROUPS.map((g) => (
          <TaskGroup
            key={g}
            group={g}
            tasks={tasks.filter((x) => x.group === g)}
            selected={selected}
            listFine={listFine}
            fold={!camera}
            gondola={gondola}
            where={camera ? nowhere : where}
            historyOf={historyOf}
            onSelect={select}
            onJump={jumpTo}
          />
        ))}
      </div>

      {/* The panel stays in view beside the list and never decides how tall the page is. The grid of
          cameras is taller than a screen, so it scrolls inside the panel. If it set the page
          height, opening a task would swap it for one photo and the page would shrink under you. */}
      <div className="lg:sticky lg:top-4 lg:max-h-[calc(100dvh-5rem)] lg:overflow-y-auto lg:overscroll-contain scrollbar-subtle">
        {photoCamera && photo ? (
          <>
            <div className="flex h-9 items-center justify-between gap-3 px-1 text-meta tabular-nums text-fg-muted">
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
          <>
            {/* The same height as a group heading, so the first tile lines up with the first card. */}
            <h2 className="flex h-9 items-center gap-2 px-1 text-label text-fg-muted">
              <LayoutGrid className="size-4" />
              {t.navGondolas}
            </h2>
          <ul className="grid grid-cols-2 gap-3">
            {cameras(state).map((c) => (
              <li key={c}>
                <CameraTile camera={c} />
              </li>
            ))}
          </ul>
          </>
        )}
        <DayBar className="mt-4" />
      </div>
    </div>
  )
}
