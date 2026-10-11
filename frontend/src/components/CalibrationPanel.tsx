import { ProductIcon } from '@/components/ProductIcon'
import { defaultLines, linesFor, maxOf, modeOf, reach } from '@/lib/calibration'
import { useCalibration } from '@/lib/calibrationStore'
import { useI18n } from '@/lib/i18n'

/** One row per product family: the amount where empty ends and where full starts, set on two sliders. */
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
  const c = cal[f]
  const name = family(f)
  const units = modeOf(f) === 'units'
  const max = maxOf(f)
  const step = units ? 1 : 5
  const model = defaultLines(f)
  const lines = c ? linesFor(f, c) : model
  const say = (n: number) => (units ? t.calUnits(n) : `${Math.round(n)}%`)
  const explain = (l: typeof lines) => {
    const r = reach(f, l)
    return [r.empty ? t.calEmptyUpTo(say(l.emptyMax)) : t.calEmptyNever, r.full ? t.calFullFrom(say(l.fullMin)) : t.calFullNever, r.half ? t.calHalfBetween : ''].filter(Boolean).join(' · ')
  }
  // Moving either line sets both, so the marker never contradicts itself: empty stays below full.
  const setLines = (emptyMax: number, fullMin: number) => setProduct(f, { emptyMax, fullMin, threshold: fullMin, level: 'full' })
  // Two sliders on one track: only the round handles take the pointer, so each one can be grabbed.
  const handles =
    'pointer-events-none absolute inset-0 h-11 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-bg [&::-webkit-slider-thumb]:bg-fg [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-bg [&::-moz-range-thumb]:bg-fg'
  const pct = (n: number) => `${(Math.min(max, Math.max(0, n)) / max) * 100}%`

  return (
    <li className="grid gap-3 rounded-xl bg-raised p-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:items-center md:gap-x-5 md:gap-y-1">
      <div className="flex min-w-0 items-center gap-3">
        <ProductIcon family={f} label={name} className="size-8 shrink-0" />
        <span className="truncate text-label">{name}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative h-11 min-w-0 flex-1" role="group" aria-label={explain(lines)}>
          <div className="absolute inset-x-0 top-1/2 flex h-3 -translate-y-1/2 overflow-hidden rounded-full">
            <span style={{ width: pct(lines.emptyMax) }} className="bg-danger/70" title={t.segEmpty} />
            <span style={{ width: `calc(${pct(lines.fullMin)} - ${pct(lines.emptyMax)})` }} className="bg-fg-muted/50" title={t.segHalf} />
            <span className="flex-1 bg-success/60" title={t.segFull} />
          </div>
          <input
            type="range"
            min={0}
            max={max - 1}
            step={step}
            value={Math.min(lines.emptyMax, max - 1)}
            aria-label={t.calEmptyLabel(name)}
            onChange={(e) => setLines(Number(e.target.value), Math.max(lines.fullMin, Number(e.target.value) + step))}
            className={handles}
          />
          <input
            type="range"
            min={1}
            max={max}
            step={step}
            value={Math.max(lines.fullMin, 1)}
            aria-label={t.calFullLabel(name)}
            onChange={(e) => setLines(Math.min(lines.emptyMax, Number(e.target.value) - step), Number(e.target.value))}
            className={handles}
          />
        </div>
        <span className="w-32 shrink-0 text-right text-label tabular-nums" title={explain(lines)}>
          {say(lines.emptyMax)} · {say(lines.fullMin)}
        </span>
      </div>
      <div className={`flex items-center justify-between gap-3 md:col-span-2 ${c ? 'min-h-11' : ''}`}>
        <span className="text-meta text-fg-muted">
          {c ? explain(lines) : t.calFollowsModel}
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
