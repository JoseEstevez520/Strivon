import { CalibrationPanel } from '@/components/CalibrationPanel'
import { CalibrationPresets } from '@/components/CalibrationPresets'
import { useCalibration } from '@/lib/calibrationStore'
import { useI18n } from '@/lib/i18n'

export function CalibrationPage() {
  const { t } = useI18n()
  const { reset } = useCalibration()
  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="text-display">{t.calTitle}</h1>
        <p className="max-w-2xl text-ui text-fg-secondary">{t.calIntro}</p>
      </header>
      <CalibrationPresets />
      <CalibrationPanel />
      <button
        type="button"
        onClick={reset}
        className="h-11 w-fit cursor-pointer rounded-lg px-4 text-ui text-fg-secondary transition-colors hover:bg-surface hover:text-fg"
      >
        {t.calReset}
      </button>
    </div>
  )
}
