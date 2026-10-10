import { CircleAlert, CircleCheck, Clock, Undo2, type LucideIcon } from 'lucide-react'
import type { Group } from '@/lib/tasks'

/** Colour is only for outcomes: red for what is missing, amber for what is misplaced, green for fine. */
export const GROUP_COLOR: Record<Group, string> = {
  restock: 'var(--danger)',
  moveBack: 'var(--warning)',
  later: 'var(--fg-muted)',
  allGood: 'var(--success)',
}

export const GROUP_ICON: Record<Group, LucideIcon> = {
  restock: CircleAlert,
  moveBack: Undo2,
  later: Clock,
  allGood: CircleCheck,
}
