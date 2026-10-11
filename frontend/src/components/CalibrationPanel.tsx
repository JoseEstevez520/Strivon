import { ProductIcon } from '@/components/ProductIcon'
import { defaultLines, linesFor, maxOf, modeOf } from '@/lib/calibration'
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
  // Moving either line sets both, so the marker never contradicts itself: empty stays below full.
  const setLines = (emptyMax: number, fullMin: number) => setProduct(f, { emptyMax, fullMin, threshold: fullMin, level: 'full' })
  const pct = (n: number) => `${(Math.min(max, Math.max(0, n)) / max) * 100}%`

  return (
    <li className="grid gap-3 rounded-xl bg-raised p-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:items-center md:gap-x-5 md:gap-y-1">
      <div className="flex min-w-0 items-center gap-3">
        <ProductIcon family={f} label={name} className="size-8 shrink-0" />
        <span className="truncate text-label">{name}</span>
      </div>
      <div className="grid gap-1 md:col-span-2">
        <div className="flex h-3 overflow-hidden rounded-full text-[0px]" role="img" aria-label={t.calLines(say(lines.emptyMax), say(lines.fullMin))}>
          <span style={{ width: pct(lines.emptyMax) }} className="bg-danger/70" title={t.segEmpty} />
          <span style={{ width: `calc(${pct(lines.fullMin)} - ${pct(lines.emptyMax)})` }} className="bg-fg-muted/50" title={t.segHalf} />
          <span className="flex-1 bg-success/60" title={t.segFull} />
        </div>
        <label className="flex items-center gap-3 text-meta text-fg-muted">
          <span className="w-28 shrink-0">{t.segEmpty}</span>
          <input
            type="range"
            min={0}
            max={max - 1}
            step={step}
            value={Math.min(lines.emptyMax, max - 1)}
            aria-label={t.calEmptyUpTo(name)}
            onChange={(e) => setLines(Number(e.target.value), Math.max(lines.fullMin, Number(e.target.value) + step))}
            className="h-11 min-w-0 flex-1 cursor-pointer accent-fg"
          />
          <span className="w-20 shrink-0 text-right text-label text-fg tabular-nums">{say(lines.emptyMax)}</span>
        </label>
        <label className="flex items-center gap-3 text-meta text-fg-muted">
          <span className="w-28 shrink-0">{t.segFull}</span>
          <input
            type="range"
            min={1}
            max={max}
            step={step}
            value={Math.max(lines.fullMin, 1)}
            aria-label={t.calFullFrom(name)}
            onChange={(e) => setLines(Math.min(lines.emptyMax, Number(e.target.value) - step), Number(e.target.value))}
            className="h-11 min-w-0 flex-1 cursor-pointer accent-fg"
          />
          <span className="w-20 shrink-0 text-right text-label text-fg tabular-nums">{say(lines.fullMin)}</span>
        </label>
      </div>
      <div className={`flex items-center justify-between gap-3 md:col-span-2 ${c ? 'min-h-11' : ''}`}>
        <span className="text-meta text-fg-muted">
          {c ? t.calLines(say(Math.max(0, lines.emptyMax)), say(lines.fullMin)) : t.calFollowsModel}
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
