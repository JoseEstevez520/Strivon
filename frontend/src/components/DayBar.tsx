import { Clock, Pause, Play } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { clock } from '@/lib/time'

interface Props {
  times: number[]
  index: number
  onChange: (index: number) => void
  playing: boolean
  onTogglePlay: () => void
}

/** The day, one stop for every moment a photo arrived from any camera. */
export function DayBar({ times, index, onChange, playing, onTogglePlay }: Props) {
  const { t } = useI18n()
  return (
    <div className="mt-4 flex items-center gap-3 text-meta tabular-nums text-fg-muted">
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={playing ? t.pause : t.play}
        className="grid size-8 cursor-pointer place-items-center rounded-md transition-colors hover:bg-surface [&_svg]:size-4"
      >
        {playing ? <Pause /> : <Play />}
      </button>
      <Clock className="size-4" aria-hidden />
      <span>{clock(times[0])}</span>
      <input
        type="range"
        min={0}
        max={times.length - 1}
        step={1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={t.day}
        className="day-range flex-1"
      />
      <span className="w-10 text-right text-fg-secondary">{clock(times[index])}</span>
    </div>
  )
}
