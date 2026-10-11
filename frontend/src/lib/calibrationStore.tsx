import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { defaultCalibration, loadCalibration, saveCalibration, type Calibration, type ProductCal } from './calibration'

interface CalibrationApi {
  cal: Calibration
  families: string[]
  setProduct: (family: string, patch: Partial<ProductCal>) => void
  reset: () => void
}

const Context = createContext<CalibrationApi | null>(null)

function initial(families: string[]): Calibration {
  return { ...defaultCalibration(families), ...loadCalibration() }
}

/** Holds the per-product calibration and keeps it saved. `families` are the products on the shelves. */
export function CalibrationProvider({ families, children }: { families: string[]; children: ReactNode }) {
  const [cal, setCal] = useState<Calibration>(() => initial(families))

  const setProduct = useCallback((family: string, patch: Partial<ProductCal>) => {
    setCal((prev) => {
      const base = prev[family] ?? defaultCalibration([family])[family]
      const next = { ...prev, [family]: { ...base, ...patch } }
      saveCalibration(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    const next = defaultCalibration(families)
    saveCalibration(next)
    setCal(next)
  }, [families])

  const value = useMemo(() => ({ cal, families, setProduct, reset }), [cal, families, setProduct, reset])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useCalibration(): CalibrationApi {
  const v = useContext(Context)
  if (!v) throw new Error('useCalibration needs a CalibrationProvider')
  return v
}
