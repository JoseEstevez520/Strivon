import { useState } from 'react'
import { AreaHistory } from './AreaHistory'
import { GROUP_COLOR, GROUP_ICON } from './groupStyle'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { TaskCard } from './TaskCard'
import { useScrollIntoView } from './useScrollIntoView'
import { useI18n } from '@/lib/i18n'
import type { Area } from '@/data/types'
import type { Group, HistoryPoint, Task } from '@/lib/tasks'

interface Props {
  group: Group
  tasks: Task[]
  selected: string | null
  historyOf: (area: Area) => HistoryPoint[]
  onSelect: (areaId: string) => void
  onJump: (ts: number) => void
}

interface RowProps {
  task: Task
  selected: boolean
  history: HistoryPoint[]
  onSelect: () => void
  onJump: (ts: number) => void
}

/** A quiet line for what is not urgent. Pressed, it opens in place like a card, on the neutral tone. */
function QuietRow({ task, selected, history, onSelect, onJump }: RowProps) {
  const { family } = useI18n()
  const ref = useScrollIntoView<HTMLDivElement>(selected)
  return (
    <div
      ref={ref}
      data-selected={selected}
      className="rounded-md transition-colors hover:bg-surface data-[selected=true]:bg-surface"
    >
      <Collapsible open={selected} onOpenChange={() => onSelect()}>
        <CollapsibleTrigger className="flex w-full cursor-pointer justify-between rounded-md px-1 py-1.5 text-left text-fg-secondary">
          <span>{family(task.area.family)}</span>
          <span className="text-meta text-fg-muted">{task.area.camera}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <AreaHistory task={task} history={history} onJump={onJump} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export function TaskGroup({ group, tasks, selected, historyOf, onSelect, onJump }: Props) {
  const { t } = useI18n()
  const open = tasks.find((x) => x.area.area_id === selected)
  // An area that is fine has no card. The last one opened stays mounted so it can fold away.
  const [shown, setShown] = useState<Task | null>(null)
  if (group === 'allGood' && open && open !== shown) setShown(open)

  if (tasks.length === 0) return null
  const Icon = GROUP_ICON[group]
  const row = (task: Task) => ({
    task,
    selected: selected === task.area.area_id,
    history: historyOf(task.area),
    onSelect: () => onSelect(task.area.area_id),
    onJump,
  })

  return (
    <section className="mt-7 first:mt-0">
      <h2 className="mb-2 flex items-center gap-2 px-1 text-label text-fg-muted">
        <Icon className="size-4" style={{ color: GROUP_COLOR[group] }} />
        {t[group]}
        {group !== 'restock' && group !== 'moveBack' && (
          <span className="ml-auto text-meta font-normal tabular-nums">{tasks.length}</span>
        )}
      </h2>

      {(group === 'restock' || group === 'moveBack') && (
        <div className="flex flex-col gap-1">
          {tasks.map((task) => (
            <TaskCard key={task.area.area_id} {...row(task)} />
          ))}
        </div>
      )}

      {group === 'later' && (
        <div>
          {tasks.map((task) => (
            <QuietRow key={task.area.area_id} {...row(task)} />
          ))}
        </div>
      )}

      {group === 'allGood' && shown && (
        <Collapsible open={Boolean(open)}>
          <CollapsibleContent>
            <QuietRow {...row(open ?? shown)} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  )
}
