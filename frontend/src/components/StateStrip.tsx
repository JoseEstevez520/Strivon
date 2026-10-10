import type { Group, Task } from '@/lib/tasks'

/**
 * Colour only for what needs action. Everything else is a quiet grey, so the segments that matter
 * are the ones you see, and a strip does not need a legend.
 */
const SEGMENT: Record<Group, string> = {
  restock: 'var(--danger)',
  moveBack: 'var(--warning)',
  later: 'color-mix(in oklab, var(--fg) 14%, transparent)',
  allGood: 'color-mix(in oklab, var(--fg) 14%, transparent)',
}

/** One thin segment per shelf area of a camera: a gondola at a glance. */
export function StateStrip({ tasks, className = '' }: { tasks: Task[]; className?: string }) {
  return (
    <span className={`flex gap-0.5 ${className}`} aria-hidden>
      {tasks.map((t) => (
        <span key={t.area.area_id} className="h-1 flex-1 rounded-full" style={{ backgroundColor: SEGMENT[t.group] }} />
      ))}
    </span>
  )
}
