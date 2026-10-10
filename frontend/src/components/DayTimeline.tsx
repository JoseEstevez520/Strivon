import { Pause, Play } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { GROUP_COLOR } from './groupStyle'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { tasksAt } from '@/lib/tasks'
import { clock } from '@/lib/time'

/**
 * The day as a timeline: one column for every moment a photo arrived, with how much needed doing
 * then, red for what had to be restocked on top of amber for what was in the wrong place. The
 * moment you are looking at is lit; press or drag across it to go to another, and the whole page
 * follows. It also plays the day.
 */
export function DayTimeline({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  const { state, times, index, setIndex, playing, togglePlay } = useStore()
  const track = useRef<HTMLDivElement>(null)

  // Photos come from every camera at different minutes, so the day is cut into hours: each column
  // is how things stood at the last photo of that hour.
  const series = useMemo(() => {
    const HOUR = 3600
    const out: { start: number; at: number; restock: number; moveBack: number }[] = []
    for (let start = Math.floor(times[0] / HOUR) * HOUR; start <= times[times.length - 1]; start += HOUR) {
      const last = times.findLastIndex((x) => x >= start && x < start + HOUR)
      if (last < 0) continue
      const now = tasksAt(state, times[last])
      out.push({
        start,
        at: last,
        restock: now.filter((x) => x.group === 'restock').length,
        moveBack: now.filter((x) => x.group === 'moveBack').length,
      })
    }
    return out
  }, [state, times])
  const max = Math.max(1, ...series.map((s) => s.restock + s.moveBack))
  const current = Math.max(0, series.findLastIndex((s) => s.at <= index || s.start <= times[index]))

  const pick = (clientX: number) => {
    const box = track.current?.getBoundingClientRect()
    if (!box) return
    const i = Math.floor(((clientX - box.left) / box.width) * series.length)
    setIndex(series[Math.max(0, Math.min(series.length - 1, i))].at)
  }

  return (
    <div className={`flex items-end gap-3 ${className}`}>
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? t.pause : t.play}
        className="mb-6 grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-fg-muted transition-colors hover:bg-surface hover:text-fg [&_svg]:size-4"
      >
        {playing ? <Pause /> : <Play />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          ref={track}
          role="group"
          aria-label={t.day}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            pick(e.clientX)
          }}
          onPointerMove={(e) => e.buttons === 1 && pick(e.clientX)}
          className="grid h-16 cursor-pointer touch-none items-end gap-1 select-none"
          style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}
        >
          {series.map((s, i) => {
            const on = i === current
            return (
              <button
                key={s.start}
                type="button"
                tabIndex={on ? 0 : -1}
                onFocus={() => setIndex(s.at)}
                title={`${clock(s.start)} · ${s.restock} ${t.restock} · ${s.moveBack} ${t.moveBack}`}
                data-on={on}
                className="group flex h-full min-w-0 cursor-pointer flex-col justify-end gap-px rounded-md bg-transparent px-px pb-px transition-colors data-[on=true]:bg-surface"
              >
                <span
                  className="block w-full rounded-[3px] transition-opacity group-data-[on=false]:opacity-50"
                  style={{ height: `${(s.restock / max) * 100}%`, background: GROUP_COLOR.restock }}
                />
                <span
                  className="block w-full rounded-[3px] transition-opacity group-data-[on=false]:opacity-50"
                  style={{ height: `${(s.moveBack / max) * 100}%`, background: GROUP_COLOR.moveBack }}
                />
              </button>
            )
          })}
        </div>
        <div className="mt-1.5 grid text-meta tabular-nums text-fg-muted" style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }}>
          {series.map((s, i) => (
            <span key={s.start} className={i === current ? 'text-fg' : undefined}>
              {i % 2 === 0 || i === current ? clock(s.start).slice(0, 2) : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
