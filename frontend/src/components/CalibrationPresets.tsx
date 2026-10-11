import { useI18n } from '@/lib/i18n'
import { useCalibration } from '@/lib/calibrationStore'
import { PRESETS, type PresetId } from '@/lib/calibrationPresets'
import { Segmented } from '@/components/ui/segmented'

/** Switch the whole store between two calibration profiles, or back to the model's own levels. */
export function CalibrationPresets() {
  const { t } = useI18n()
  const { cal, families, setAll, reset } = useCalibration()
  const s = t.calibrationPresets

  const matches = (id: PresetId) => {
    const want = PRESETS[id](families)
    return families.length > 0 && families.every((f) => {
      const a = cal[f]
      const b = want[f]
      return a && b && a.threshold === b.threshold && a.level === b.level
    })
  }

  const on = (v: string) => (v === 'reset' ? Object.keys(cal).length === 0 : matches(v as PresetId))

  const pick = (v: string) => (v === 'reset' ? reset() : setAll(PRESETS[v as PresetId](families)))

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
