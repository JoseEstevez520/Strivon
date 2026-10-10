import { useState } from 'react'
import { AreaRows, TaskCard } from './TaskCard'
import { GROUP_COLOR, GROUP_ICON } from './groupStyle'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { Area } from '@/data/types'
import { useI18n } from '@/lib/i18n'
import { cardsOf, type Card, type Group, type HistoryPoint, type Task } from '@/lib/tasks'
import { AreaHistory } from './AreaHistory'

interface Props {
  group: Group
  tasks: Task[]
  selected: string | null
  gondola: (camera: string) => string
  historyOf: (area: Area) => HistoryPoint[]
  onSelect: (areaId: string | null) => void
  onJump: (ts: number) => void
}

/** A product that can wait: a quiet line instead of a card. It opens like one. */
function QuietRow({ card, ...rest }: Omit<Props, 'group' | 'tasks'> & { card: Card }) {
  const { t, family } = useI18n()
  const { selected, gondola, historyOf, onSelect, onJump } = rest
  const first = card.tasks[0]
  const open = card.tasks.some((x) => x.area.area_id === selected)
  const many = card.tasks.length > 1

  return (
    <div data-selected={open} className="rounded-md transition-colors hover:bg-surface data-[selected=true]:bg-surface">
      <Collapsible open={open} onOpenChange={() => onSelect(open ? null : first.area.area_id)}>
        <CollapsibleTrigger className="flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-md px-1 py-1.5 text-left text-fg-secondary">
          <span>{family(first.area.family)}</span>
          <span className="min-w-0 truncate text-meta text-fg-muted">
            {many ? t.areasCount(card.tasks.length) : gondola(first.area.camera)}
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {many ? (
            <AreaRows tasks={card.tasks} selected={selected} gondola={gondola} historyOf={historyOf} onSelect={onSelect} onJump={onJump} />
          ) : (
            <AreaHistory task={first} history={historyOf(first.area)} onJump={onJump} />
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export function TaskGroup({ group, tasks, selected, ...rest }: Props) {
  const { t } = useI18n()
  const open = tasks.find((x) => x.area.area_id === selected)
  // An area that is fine has no card. The last one opened stays mounted so it can fold away.
  const [shown, setShown] = useState<Task | null>(null)
  if (group === 'allGood' && open && open !== shown) setShown(open)

  if (tasks.length === 0) return null
  const Icon = GROUP_ICON[group]
  const cards = group === 'allGood' ? [] : cardsOf(tasks)
  const props = { selected, ...rest }

  return (
    <section className="mt-7 first:mt-0">
      <h2 className="mb-2 flex items-center gap-2 px-1 text-label text-fg-muted">
        <Icon className="size-4" style={{ color: GROUP_COLOR[group] }} />
        {t[group]}
        <span className="ml-auto text-meta font-normal tabular-nums">{group === 'restock' || group === 'moveBack' ? '' : tasks.length}</span>
      </h2>

      {(group === 'restock' || group === 'moveBack') && (
        <div className="flex flex-col gap-1">
          {cards.map((card) => (
            <TaskCard key={card.key} card={card} {...props} />
          ))}
        </div>
      )}

      {group === 'later' && (
        <div>
          {cards.map((card) => (
            <QuietRow key={card.key} card={card} {...props} />
          ))}
        </div>
      )}

      {group === 'allGood' && shown && (
        <Collapsible open={Boolean(open)}>
          <CollapsibleContent>
            <QuietRow card={{ key: shown.area.area_id, group, tasks: [open ?? shown] }} {...props} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  )
}
