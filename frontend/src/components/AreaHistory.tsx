import { LEVEL_COLOR } from './groupStyle'
import { useI18n } from '@/lib/i18n'
import { clock } from '@/lib/time'
import type { HistoryPoint, Task } from '@/lib/tasks'

interface Props {
  task: Task
  history: HistoryPoint[]
  onJump: (ts: number) => void
}

/**
 * What an open task adds to its own row: where the area is, and how it went through the day.
 * It lives inside the card that was pressed, so there is one object and one colour.
 */
export function AreaHistory({ task, history, onJump }: Props) {
  const { t } = useI18n()
  const { area, obs, record } = task
  // The group already says the stock for the other groups. Only a misplaced product hides it.
  const stock = task.group === 'moveBack' ? ` · ${t.level[obs.stock_level]}` : ''

  return (
    <div className="px-3 pt-1 pb-3">
      <p className="text-meta text-fg-secondary">
        {t.areaOf(area.camera, area.index)}
        {stock}
      </p>

      <h3 className="mt-4 mb-2 text-label text-fg-secondary">{t.throughDay}</h3>
      <div className="flex gap-1" role="list">
        {history.map((p) => {
          const current = p.record.image === record.image
          const label = `${clock(p.record.ts)} · ${t.level[p.obs.stock_level]}`
          return (
            <button
              key={p.record.image}
              type="button"
              role="listitem"
              onClick={() => onJump(p.record.ts)}
              title={label}
              aria-label={label}
              aria-current={current}
              style={{ backgroundColor: LEVEL_COLOR[p.obs.stock_level] }}
              className="relative h-7 flex-1 cursor-pointer overflow-hidden rounded-sm opacity-40 transition-opacity hover:opacity-70 aria-[current=true]:opacity-100"
            >
              {!p.obs.planogram_compliant && (
                <span className="absolute inset-x-0 bottom-0 h-1.5 bg-warning" aria-hidden />
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-meta tabular-nums text-fg-secondary">
        <span>{clock(history[0]?.record.ts ?? null)}</span>
        <span>{clock(history[history.length - 1]?.record.ts ?? null)}</span>
      </div>
    </div>
  )
}
