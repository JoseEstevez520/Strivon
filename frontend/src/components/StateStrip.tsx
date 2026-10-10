import { GROUP_COLOR } from './groupStyle'
import type { Task } from '@/lib/tasks'

/** One thin segment per shelf area of a camera, coloured by its state: a gondola at a glance. */
export function StateStrip({ tasks }: { tasks: Task[] }) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {tasks.map((t) => (
        <span
          key={t.area.area_id}
          className="h-1 flex-1 rounded-full"
          style={{ backgroundColor: GROUP_COLOR[t.group], opacity: t.group === 'allGood' ? 0.35 : 1 }}
        />
      ))}
    </span>
  )
}
