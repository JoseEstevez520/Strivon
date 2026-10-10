import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { PhotoStage } from './PhotoStage'
import { TaskGroup } from './TaskGroup'
import { useStore } from '@/lib/store'
import { cameras, snapshot, type Group, type Task } from '@/lib/tasks'
import { clock } from '@/lib/time'
import { useSelection } from '@/lib/useSelection'

const GROUPS: Group[] = ['restock', 'moveBack', 'later', 'allGood']
export const ACTION: Group[] = ['restock', 'moveBack']

interface Props {
  /** The tasks to list. */
  tasks: Task[]
  /** A fixed camera for the photo. Without it the photo follows what is open. */
  camera?: string
  /** List every area that is fine, as a gondola's own page does. */
  listFine?: boolean
  initialSelected?: string | null
}

/** The photo with its shelf areas on one side, the tasks on the other, linked by what is open. */
export function TaskBoard({ tasks, camera, listFine = false, initialSelected = null }: Props) {
  const { state, at, tasks: all, gondola, where, historyOf, jumpTo } = useStore()
  const [selected, select] = useSelection(initialSelected)

  const selectedTask = all.find((x) => x.area.area_id === selected)
  const firstAction = tasks.find((x) => ACTION.includes(x.group))
  const photoCamera = camera ?? selectedTask?.area.camera ?? firstAction?.area.camera ?? cameras(state)[0]
  const photo = snapshot(state, photoCamera, at)

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1.7fr_1fr]">
      <div className="order-2 lg:sticky lg:top-32 lg:order-1">
        <p className="mb-2 flex items-center gap-1 px-1 text-meta tabular-nums text-fg-muted">
          {camera ? (
            <span>
              {gondola(photoCamera)} · {clock(photo.ts)}
            </span>
          ) : (
            <Link
              to={`/gondolas/${photoCamera}`}
              className="flex items-center gap-1 rounded-sm transition-colors hover:text-fg-secondary"
            >
              {gondola(photoCamera)} · {clock(photo.ts)}
              <ChevronRight className="size-3.5" />
            </Link>
          )}
        </p>
        <PhotoStage
          tasks={all.filter((x) => x.area.camera === photoCamera)}
          selected={selected}
          onSelect={(id) => select(selected === id ? null : id, 'photo')}
        />
      </div>

      <div className="order-1 lg:order-2">
        {GROUPS.map((g) => (
          <TaskGroup
            key={g}
            group={g}
            tasks={tasks.filter((x) => x.group === g)}
            selected={selected}
            listFine={listFine}
            gondola={gondola}
            where={where}
            historyOf={historyOf}
            onSelect={select}
            onJump={jumpTo}
          />
        ))}
      </div>
    </div>
  )
}
