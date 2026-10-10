import { DayBar } from '@/components/DayBar'
import { Suggestions } from '@/components/Suggestions'
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
        {/* The order is explained on hover, not written on the page: a standing line was clutter. */}
        <h1 className="text-display" title={t.orderNote}>
          {t.headline(count)}
        </h1>
        <p className="text-meta tabular-nums text-fg-muted">{t.photoFrom(clock(at))}</p>
      </div>
      <DayBar className="mb-6" />
      <TaskBoard tasks={tasks} dayBar={false} split marks aside={<Suggestions />} />
    </>
  )
}
