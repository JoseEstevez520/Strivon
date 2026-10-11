import { useEffect, useState } from 'react'
import { ProductIcon } from '@/components/ProductIcon'
import { Segmented } from '@/components/ui/segmented'
import { linesFor, maxOf, reach, modeOf, startOf, type Level } from '@/lib/calibration'
import { useCalibration } from '@/lib/calibrationStore'
import { useI18n } from '@/lib/i18n'

const LEVELS: Level[] = ['full', 'half', 'empty']

/** One row per product family: the amount on a slider, and which level that amount stands for. */
export function CalibrationPanel() {
  const { families } = useCalibration()
  return (
    <ul className="grid gap-2">
      {families.map((f) => (
        <Row key={f} family={f} />
      ))}
    </ul>
  )
}

/**
 * A product nobody marked shows the model's own level: its slider can move, but nothing changes
 * until a level is pressed. Pressing one sets the marker, and the line under it says what follows.
 */
function Row({ family: f }: { family: string }) {
  const { t, family } = useI18n()
  const { cal, setProduct, clearProduct } = useCalibration()
  const [draft, setDraft] = useState(() => startOf(f))
  const c = cal[f]
  // Back to the model (or Reset): the slider goes back to where it starts.
  useEffect(() => {
    if (!c) setDraft(startOf(f))
  }, [c, f])
  const name = family(f)
  const units = modeOf(f) === 'units'
  const max = maxOf(f)
  const value = c ? Math.min(max, c.threshold) : draft
  const say = (n: number) => (units ? t.calUnits(n) : `${Math.round(n)}%`)
  const lines = c ? linesFor(f, c) : null
  const explain = (l: NonNullable<typeof lines>) => {
    const r = reach(f, l)
    return [
      r.empty ? t.calEmptyUpTo(say(l.emptyMax)) : t.calEmptyNever,
      r.full ? t.calFullFrom(say(l.fullMin)) : t.calFullNever,
      r.half ? t.calHalfBetween : '',
    ]
      .filter(Boolean)
      .join(' · ')
  }

  return (
    <li className="grid gap-3 rounded-xl bg-raised p-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,18rem)] md:items-center md:gap-x-5 md:gap-y-1">
      <div className="flex min-w-0 items-center gap-3">
        <ProductIcon family={f} label={name} className="size-8 shrink-0" />
        <span className="truncate text-label">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={max}
          step={units ? 1 : 5}
          value={value}
          aria-label={t.calSlider(name)}
          onChange={(e) => (c ? setProduct(f, { threshold: Number(e.target.value) }) : setDraft(Number(e.target.value)))}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-fg"
        />
        <span className="w-20 shrink-0 text-right text-label tabular-nums" title={c ? t.calMeaning(say(value), t.level[c.level]) : undefined}>
          {say(value)}
        </span>
      </div>
      <Segmented
        label={t.calLevels(name)}
        options={LEVELS.map((l) => ({ value: l, label: t.level[l] }))}
        on={(v) => c?.level === v}
        onPick={(v) => setProduct(f, { threshold: value, level: v as Level })}
        className="[&>button]:h-11"
      />
      <div className={`flex items-center justify-between gap-3 md:col-span-3 ${c ? 'min-h-11' : ''}`}>
        <span className="text-meta text-fg-muted">
          {lines ? explain(lines) : t.calFollowsModel}
        </span>
        {c && (
          <button
            type="button"
            onClick={() => clearProduct(f)}
            className="h-11 shrink-0 cursor-pointer rounded-lg px-3 text-ui text-fg-secondary transition-colors hover:bg-surface hover:text-fg"
          >
            {t.calClear}
          </button>
        )}
      </div>
    </li>
  )
}
