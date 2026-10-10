import { GROUP_COLOR, GROUP_ICON } from './groupStyle'
import { TaskCard } from './TaskCard'
import { useI18n } from '@/lib/i18n'
import type { Group, Task } from '@/lib/tasks'

interface Props {
  group: Group
  tasks: Task[]
  selected: string | null
  onSelect: (areaId: string) => void
}

export function TaskGroup({ group, tasks, selected, onSelect }: Props) {
  const { t, family } = useI18n()
  if (tasks.length === 0) return null
  const Icon = GROUP_ICON[group]
  const label = t[group]

  return (
    <section className="mt-7 first:mt-0">
      <h2 className="mb-2 flex items-center gap-2 px-1 text-label text-fg-muted">
        <Icon className="size-4" style={{ color: GROUP_COLOR[group] }} />
        {label}
        {group !== 'restock' && group !== 'moveBack' && (
          <span className="ml-auto text-meta font-normal tabular-nums">{tasks.length}</span>
        )}
      </h2>

      {(group === 'restock' || group === 'moveBack') && (
        <div className="flex flex-col gap-1">
          {tasks.map((task) => (
            <TaskCard
              key={task.area.area_id}
              task={task}
              selected={selected === task.area.area_id}
              onSelect={() => onSelect(task.area.area_id)}
            />
          ))}
        </div>
      )}

      {group === 'later' && (
        <ul>
          {tasks.map((task) => (
            <li key={task.area.area_id}>
              <button
                type="button"
                onClick={() => onSelect(task.area.area_id)}
                aria-pressed={selected === task.area.area_id}
                className="flex w-full cursor-pointer justify-between rounded-md px-1 py-1.5 text-left text-fg-secondary transition-colors hover:bg-surface aria-pressed:bg-surface"
              >
                <span>{family(task.area.family)}</span>
                <span className="text-meta text-fg-muted">{task.area.camera}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
