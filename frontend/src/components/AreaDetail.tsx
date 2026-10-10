import { useEffect } from 'react'
import { X } from 'lucide-react'
import { LEVEL_COLOR } from './groupStyle'
import { useI18n } from '@/lib/i18n'
import { clock } from '@/lib/time'
import type { HistoryPoint, Task } from '@/lib/tasks'

interface Props {
  task: Task
  history: HistoryPoint[]
  onJump: (ts: number) => void
  onClose: () => void
}

/** One shelf area in detail: what is there now, and how it went through the day. */
export function AreaDetail({ task, history, onJump, onClose }: Props) {
  const { t, family } = useI18n()
  const { area, obs, record } = task

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Say each thing once: the level always, the product only when it is wrong (that is the news).
  const status = obs.planogram_compliant
    ? t.level[obs.stock_level]
    : `${t.level[obs.stock_level]} · ${t.wrongPlace(family(obs.observed_family ?? ''))}`

  return (
    <section className="mt-6 rounded-xl bg-surface p-4">
      <div className="flex items-center gap-4">
        <div className="size-24 shrink-0 rounded-md bg-[#d6d8d0]" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-title">{family(area.family)}</h2>
          <p className="text-meta text-fg-secondary">{t.areaOf(area.camera, area.index)}</p>
          <p className="mt-2 text-ui">{status}</p>
        </div>
        <div className="flex items-center gap-1 self-start">
          <span className="text-meta tabular-nums text-fg-secondary">{clock(record.ts)}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="grid size-8 cursor-pointer place-items-center rounded-md text-fg-muted transition-colors hover:bg-raised"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <h3 className="mt-5 mb-2 text-label text-fg-secondary">{t.throughDay}</h3>
      <div className="flex gap-1" role="list">
        {history.map((p) => {
          const current = p.record.image === record.image
          return (
            <button
              key={p.record.image}
              type="button"
              role="listitem"
              onClick={() => onJump(p.record.ts)}
              title={`${clock(p.record.ts)} · ${t.level[p.obs.stock_level]}`}
              aria-label={`${clock(p.record.ts)} · ${t.level[p.obs.stock_level]}`}
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
    </section>
  )
}
