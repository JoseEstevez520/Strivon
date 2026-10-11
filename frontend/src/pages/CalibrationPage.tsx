import { CalibrationPanel } from '@/components/CalibrationPanel'
import { CalibrationPresets } from '@/components/CalibrationPresets'
import { toCalibFile } from '@/lib/calibration'
import { useCalibration } from '@/lib/calibrationStore'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'

export function CalibrationPage() {
  const { t } = useI18n()
  const { cal, reset } = useCalibration()
  const { state } = useStore()
  const file = toCalibFile(cal, state.areas)
  const products = Object.keys(file.products).length

  // The same lines as a file for the predictor (`agents/predict.py --calibration calib.json`).
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'calib.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="text-display">{t.calTitle}</h1>
        <p className="max-w-2xl text-ui text-fg-secondary">{t.calIntro}</p>
      </header>
      <CalibrationPresets />
      <CalibrationPanel />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="h-11 w-fit cursor-pointer rounded-lg px-4 text-ui text-fg-secondary transition-colors hover:bg-surface hover:text-fg"
        >
          {t.calReset}
        </button>
        <button
          type="button"
          onClick={download}
          disabled={products === 0}
          className="h-11 w-fit cursor-pointer rounded-lg px-4 text-ui text-fg-secondary transition-colors hover:bg-surface hover:text-fg disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
        >
          {t.calExport}
        </button>
      </div>
    </div>
  )
}
