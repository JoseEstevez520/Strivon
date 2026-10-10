import { ChevronRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { AreaHistory } from './AreaHistory'
import { GROUP_COLOR } from './groupStyle'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useScrollIntoView } from './useScrollIntoView'
import { useI18n } from '@/lib/i18n'
import { clock } from '@/lib/time'
import type { HistoryPoint, Task } from '@/lib/tasks'

interface Props {
  task: Task
  selected: boolean
  history: HistoryPoint[]
  onSelect: () => void
  onJump: (ts: number) => void
}

/**
 * A task that needs doing now. The product leads; the group above already says the action.
 * Pressed, the card opens in place and shows how the area went through the day.
 */
export function TaskCard({ task, selected, history, onSelect, onJump }: Props) {
  const { t, family } = useI18n()
  const ref = useScrollIntoView<HTMLDivElement>(selected)
  // Restock needs no second line: its group already says "empty". Only a wrong place carries news.
  const reason = task.group === 'moveBack' ? t.wrongPlace(family(task.obs.observed_family ?? '')) : null
  const since = clock(task.since)

  return (
    <div
      ref={ref}
      data-selected={selected}
      style={{ '--c': GROUP_COLOR[task.group] } as CSSProperties}
      className="rounded-lg bg-[color-mix(in_oklab,var(--c)_13%,transparent)] transition-colors hover:bg-[color-mix(in_oklab,var(--c)_19%,transparent)] data-[selected=true]:bg-[color-mix(in_oklab,var(--c)_19%,transparent)]"
    >
      <Collapsible open={selected} onOpenChange={() => onSelect()}>
        <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 pr-3 text-left">
          <div className="size-12 shrink-0 rounded-md bg-[color-mix(in_oklab,var(--c)_22%,#d6d8d0)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="text-label">{family(task.area.family)}</div>
            {reason && <div className="text-meta text-fg-secondary">{reason}</div>}
          </div>
          <span className="text-meta tabular-nums text-fg-secondary" title={t.since(since)}>
            {since}
          </span>
          <ChevronRight
            className={`size-4 text-fg-muted transition-transform duration-200 ease-out motion-reduce:transition-none ${selected ? 'rotate-90' : ''}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <AreaHistory task={task} history={history} onJump={onJump} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
