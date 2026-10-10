import { ChevronRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { AreaCrop } from './AreaCrop'
import { AreaHistory } from './AreaHistory'
import { GROUP_COLOR } from './groupStyle'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { Area } from '@/model/types'
import { useI18n } from '@/lib/i18n'
import { clock } from '@/lib/time'
import type { Card, HistoryPoint, Task } from '@/lib/tasks'

interface Props {
  card: Card
  /** The area open right now, if it belongs to this card. */
  selected: string | null
  gondola: (camera: string) => string
  where: (area: Area) => string
  historyOf: (area: Area) => HistoryPoint[]
  onSelect: (areaId: string | null) => void
  onJump: (ts: number) => void
}

/**
 * A task that needs doing now. The product leads and the group above says the action. A product
 * that is short in several places is one card: its second line says how many, and opening it
 * lists where. Pressed, a card opens in place and shows how the area went through the day.
 */
export function TaskCard({ card, selected, gondola, where, historyOf, onSelect, onJump }: Props) {
  const { t, family } = useI18n()
  const first = card.tasks[0]
  const open = card.tasks.some((x) => x.area.area_id === selected)
  const many = card.tasks.length > 1
  const place = where(first.area)
  const second = many
    ? t.areasCount(card.tasks.length)
    : card.group === 'moveBack'
      ? [t.wrongPlace(family(first.obs.observed_family ?? '')), place].filter(Boolean).join(' · ')
      : place
  const since = clock(first.since)

  return (
    <div
      data-selected={open}
      style={{ '--c': GROUP_COLOR[card.group] } as CSSProperties}
      className="rounded-lg bg-[color-mix(in_oklab,var(--c)_13%,transparent)] transition-colors hover:bg-[color-mix(in_oklab,var(--c)_19%,transparent)] data-[selected=true]:bg-[color-mix(in_oklab,var(--c)_19%,transparent)]"
    >
      <Collapsible open={open} onOpenChange={() => onSelect(open ? null : first.area.area_id)}>
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 pr-3 text-left">
          <AreaCrop area={first.area} image={first.record.image} />
          <div className="min-w-0 flex-1">
            <div className="text-label">{family(first.area.family)}</div>
            {second && <div className="truncate text-meta text-fg-secondary">{second}</div>}
          </div>
          <span className="text-meta tabular-nums text-fg-secondary" title={t.since(since)}>
            {since}
          </span>
          <ChevronRight
            className={`size-4 text-fg-muted transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? 'rotate-90' : ''}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          {many ? (
            <AreaRows
              tasks={card.tasks}
              selected={selected}
              gondola={gondola}
              historyOf={historyOf}
              onSelect={onSelect}
              onJump={onJump}
            />
          ) : (
            <AreaHistory task={first} history={historyOf(first.area)} onJump={onJump} />
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

/** The places where a product is short: one line each, the open one shows its day. */
export function AreaRows({
  tasks,
  selected,
  gondola,
  historyOf,
  onSelect,
  onJump,
}: {
  tasks: Task[]
  selected: string | null
  gondola: (camera: string) => string
  historyOf: (area: Area) => HistoryPoint[]
  onSelect: (areaId: string | null) => void
  onJump: (ts: number) => void
}) {
  return (
    <ul className="px-1 pb-2">
      {tasks.map((task) => {
        const open = selected === task.area.area_id
        return (
          <li key={task.area.area_id} data-area={task.area.area_id} data-selected={open}>
            <Collapsible open={open} onOpenChange={() => onSelect(open ? null : task.area.area_id)}>
              <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-ui text-fg-secondary transition-colors hover:bg-raised/60 aria-expanded:bg-raised/70">
                <span className="min-w-0 truncate">{gondola(task.area.camera)}</span>
                <span className="text-meta tabular-nums">{clock(task.since)}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <AreaHistory task={task} history={historyOf(task.area)} onJump={onJump} />
              </CollapsibleContent>
            </Collapsible>
          </li>
        )
      })}
    </ul>
  )
}
