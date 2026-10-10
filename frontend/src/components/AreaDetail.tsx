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

  const product = obs.planogram_compliant ? t.inPlace : t.wrongPlace(family(obs.observed_family ?? ''))

  return (
    <section className="mt-6 rounded-xl bg-surface p-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-title">{family(area.family)}</h2>
          <p className="text-meta text-fg-secondary">{t.areaOf(area.camera, area.index)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="grid size-8 cursor-pointer place-items-center rounded-md text-fg-muted transition-colors hover:bg-raised"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="mt-4 flex gap-4">
        <div className="h-28 w-40 shrink-0 rounded-md bg-[#d6d8d0]" aria-hidden />
        <dl className="grid content-center gap-x-6 gap-y-2 text-ui [grid-template-columns:auto_1fr]">
          <dt className="text-fg-secondary">{t.stock}</dt>
          <dd className="font-medium">{t.level[obs.stock_level]}</dd>
          <dt className="text-fg-secondary">{t.product}</dt>
          <dd className="font-medium">{product}</dd>
        </dl>
      </div>

      <h3 className="mt-6 mb-2 text-label text-fg-secondary">{t.throughDay}</h3>
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
