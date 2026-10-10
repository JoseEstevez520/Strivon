import { ChevronRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { GROUP_COLOR } from './groupStyle'
import { useI18n } from '@/lib/i18n'
import { clock } from '@/lib/time'
import type { Task } from '@/lib/tasks'

interface Props {
  task: Task
  selected: boolean
  onSelect: () => void
}

/** A task that needs doing now. The product leads; the group above already says the action. */
export function TaskCard({ task, selected, onSelect }: Props) {
  const { t, family } = useI18n()
  const reason =
    task.group === 'moveBack' ? t.wrongPlace(family(task.obs.observed_family ?? '')) : t.empty

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{ '--c': GROUP_COLOR[task.group] } as CSSProperties}
      className="flex w-full cursor-pointer items-center gap-3 rounded-lg bg-[color-mix(in_oklab,var(--c)_7%,transparent)] p-2 pr-3 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--c)_11%,transparent)] aria-pressed:bg-[color-mix(in_oklab,var(--c)_15%,transparent)]"
    >
      <div className="size-12 shrink-0 rounded-md bg-[#d6d8d0]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-label">{family(task.area.family)}</div>
        <div className="text-meta tabular-nums text-fg-muted">
          {reason} · {t.since(clock(task.since))}
        </div>
      </div>
      <ChevronRight className="size-4 text-fg-muted" />
    </button>
  )
}
