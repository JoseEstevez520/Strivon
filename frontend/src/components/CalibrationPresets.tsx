import { useI18n } from '@/lib/i18n'
import { useCalibration } from '@/lib/calibrationStore'
import { defaultCalibration } from '@/lib/calibration'
import { PRESETS, type PresetId } from '@/lib/calibrationPresets'
import { Segmented } from '@/components/ui/segmented'

/** Switch the whole store between two calibration profiles, or back to the default. */
export function CalibrationPresets() {
  const { t } = useI18n()
  const { cal, families, setProduct, reset } = useCalibration()
  const s = t.calibrationPresets

  const matches = (build: (f: string[]) => typeof cal) => {
    const want = build(families)
    return families.length > 0 && families.every((f) => {
      const a = cal[f]
      const b = want[f]
      return a && b && a.mode === b.mode && a.threshold === b.threshold && a.level === b.level
    })
  }

  const on = (v: string) => (v === 'reset' ? matches(defaultCalibration) : matches(PRESETS[v as PresetId]))

  const pick = (v: string) => {
    if (v === 'reset') {
      reset()
      return
    }
    const next = PRESETS[v as PresetId](families)
    for (const f of families) setProduct(f, next[f])
  }

  return (
    <div className="flex flex-col gap-2">
      <Segmented
        label={s.label}
        on={on}
        onPick={pick}
        options={[
          { value: 'strict', label: s.strict },
          { value: 'relaxed', label: s.relaxed },
          { value: 'reset', label: s.reset },
        ]}
      />
      <p className="text-meta text-fg-muted">{s.hint}</p>
    </div>
  )
}
