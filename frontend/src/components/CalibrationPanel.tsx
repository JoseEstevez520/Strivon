import { ProductIcon } from '@/components/ProductIcon'
import { Segmented } from '@/components/ui/segmented'
import { BIG_FAMILIES, type Level } from '@/lib/calibration'
import { useCalibration } from '@/lib/calibrationStore'
import { useI18n } from '@/lib/i18n'

const LEVELS: Level[] = ['full', 'half', 'empty']

/** One row per product family: the amount on a slider, and which level that amount stands for. */
export function CalibrationPanel() {
  const { t, family } = useI18n()
  const { cal, families, setProduct } = useCalibration()

  return (
    <ul className="grid gap-2">
      {families.map((f) => {
        const c = cal[f]
        if (!c) return null
        const name = family(f)
        const units = c.mode === 'units' || BIG_FAMILIES.includes(f)
        const max = units ? 7 : 100
        const amount = units ? t.calUnits(c.threshold) : `${Math.round(c.threshold)}%`
        return (
          <li key={f} className="grid gap-3 rounded-xl bg-raised p-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,18rem)] md:items-center md:gap-5">
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
                value={c.threshold}
                aria-label={t.calSlider(name)}
                onChange={(e) => setProduct(f, { threshold: Number(e.target.value) })}
                className="h-11 min-w-0 flex-1 cursor-pointer accent-fg"
              />
              <span className="w-16 shrink-0 text-right text-label tabular-nums" title={t.calMeaning(amount, t.level[c.level])}>
                {amount}
              </span>
            </div>
            <Segmented
              label={t.calLevels(name)}
              options={LEVELS.map((l) => ({ value: l, label: t.level[l] }))}
              on={(v) => c.level === v}
              onPick={(v) => setProduct(f, { level: v as Level })}
              className="[&>button]:h-11"
            />
          </li>
        )
      })}
    </ul>
  )
}
