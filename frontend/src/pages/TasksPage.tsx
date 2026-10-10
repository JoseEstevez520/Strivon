import { TaskBoard } from '@/components/TaskBoard'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { ACTION, cardsOf } from '@/lib/tasks'
import { clock } from '@/lib/time'

/** What to do now, across the whole store. */
export function TasksPage() {
  const { t } = useI18n()
  const { tasks, at } = useStore()
  const count = cardsOf(tasks.filter((x) => ACTION.includes(x.group))).length

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-display">{t.headline(count)}</h1>
          <p className="mt-1 text-meta text-fg-muted">{t.orderNote}</p>
        </div>
        <p className="text-meta tabular-nums text-fg-muted">{t.photoFrom(clock(at))}</p>
      </div>
      <TaskBoard tasks={tasks} />
    </>
  )
}
