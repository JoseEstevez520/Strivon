import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { AreaRows, TaskCard } from './TaskCard'
import { GROUP_COLOR, GROUP_ICON } from './groupStyle'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { Area } from '@/model/types'
import { useI18n } from '@/lib/i18n'
import { cardsOf, type Card, type Group, type HistoryPoint, type Task } from '@/lib/tasks'
import { AreaHistory } from './AreaHistory'

interface Props {
  group: Group
  tasks: Task[]
  selected: string | null
  gondola: (camera: string) => string
  where: (area: Area, alsoSaid?: string) => string
  historyOf: (area: Area) => HistoryPoint[]
  onSelect: (areaId: string | null) => void
  onJump: (ts: number) => void
  /** List every area that is fine, instead of only the one opened from the photo. */
  listFine?: boolean
  /** Fold the long groups: only the most urgent show, and the rest sit behind a line. */
  fold?: boolean
  /** Replaces the group's name in its heading. */
  label?: string
  /** A single column of cards, and cards for what is half full too: for putting groups side by side. */
  column?: boolean
}

/** A product that can wait: a quiet line instead of a card. It opens like one. */
function QuietRow({ card, ...rest }: Omit<Props, 'group' | 'tasks'> & { card: Card }) {
  const { t, family } = useI18n()
  const { selected, gondola, where, historyOf, onSelect, onJump } = rest
  const first = card.tasks[0]
  const open = card.tasks.some((x) => x.area.area_id === selected)
  const many = card.tasks.length > 1

  return (
    <div data-selected={open} className="rounded-md transition-colors hover:bg-surface data-[selected=true]:bg-surface">
      <Collapsible open={open} onOpenChange={() => onSelect(open ? null : first.area.area_id)}>
        <CollapsibleTrigger className="flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-md px-1 py-1.5 text-left text-fg-secondary">
          <span>{family(first.area.family)}</span>
          <span className="min-w-0 truncate text-meta text-fg-muted">
            {many ? t.areasCount(card.tasks.length) : where(first.area)}
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

/** How many of a group show before the rest fold. Later is what can wait, so it starts folded. */
/** True when what is open is in the part that would be folded. */
function folded(cards: Card[], limit: number, selected: string | null): boolean {
  return cards.slice(limit).some((c) => c.tasks.some((x) => x.area.area_id === selected))
}

const SHOWN: Record<Group, number> = { restock: 6, moveBack: 4, later: 0, allGood: 0 }

/**
 * The first `limit` items, then a line that unfolds the rest in place. It opens by itself when
 * what is open (an area picked on the photo) sits in the folded part.
 */
function Folded({
  items,
  limit,
  forced,
  className,
  children,
}: {
  items: Card[]
  limit: number
  forced: boolean
  className: string
  children: (card: Card) => ReactNode
}) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const rest = items.slice(limit)
  if (rest.length === 0) return <div className={className}>{items.map(children)}</div>
  const open = expanded || forced
  return (
    <div className={className}>
      {items.slice(0, limit).map(children)}
      <Collapsible open={open} onOpenChange={setExpanded} className="contents">
        <CollapsibleTrigger className="col-span-full flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-meta text-fg-secondary transition-colors hover:bg-surface">
          {open ? t.showFewer : limit === 0 ? t.showAll(rest.length) : t.showMore(rest.length)}
          <ChevronDown className={`size-3.5 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="col-span-full">
          <div className={className}>{rest.map(children)}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export function TaskGroup({ group, tasks, selected, listFine = false, fold = true, label, column = false, ...rest }: Props) {
  const { t } = useI18n()
  const open = tasks.find((x) => x.area.area_id === selected)
  // An area that is fine has no card. The last one opened stays mounted so it can fold away.
  const [shown, setShown] = useState<Task | null>(null)
  if (group === 'allGood' && open && open !== shown) setShown(open)

  if (tasks.length === 0) return null
  const Icon = GROUP_ICON[group]
  const cards = group === 'allGood' && !listFine ? [] : cardsOf(tasks)
  const props = { selected, ...rest }

  return (
    <section className="mt-7 first:mt-0">
      <h2 className="sticky top-0 z-10 flex h-9 items-center gap-2 bg-bg px-1 text-label text-fg-muted">
        <Icon className="size-4" style={{ color: GROUP_COLOR[group] }} />
        {label ?? t[group]}
        <span className="ml-auto text-meta font-normal tabular-nums">{group === 'allGood' ? tasks.length : cards.length}</span>
      </h2>

      {(group === 'restock' || group === 'moveBack' || (group === 'later' && column)) && (
        <Folded
          items={cards}
          limit={fold ? (column ? 6 : SHOWN[group]) : cards.length}
          forced={folded(cards, column ? 6 : SHOWN[group], selected)}
          className={`grid grid-cols-[minmax(0,1fr)] items-start gap-2 ${column ? '' : 'sm:grid-cols-2'}`}
        >
          {(card) => <TaskCard key={card.key} card={card} {...props} />}
        </Folded>
      )}

      {((group === 'later' && !column) || (group === 'allGood' && listFine)) && (
        <Folded
          items={cards}
          limit={fold && group === 'later' ? SHOWN[group] : cards.length}
          forced={folded(cards, SHOWN[group], selected)}
          className="grid grid-cols-[minmax(0,1fr)] items-start gap-x-4 sm:grid-cols-2"
        >
          {(card) => <QuietRow key={card.key} card={card} {...props} />}
        </Folded>
      )}

      {group === 'allGood' && !listFine && shown && (
        <Collapsible open={Boolean(open)}>
          <CollapsibleContent>
            <QuietRow card={{ key: shown.area.area_id, group, tasks: [open ?? shown] }} {...props} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  )
}
