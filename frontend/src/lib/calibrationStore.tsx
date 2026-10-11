import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { loadCalibration, modeOf, saveCalibration, startOf, type Calibration, type ProductCal } from './calibration'

interface CalibrationApi {
  /** Only the products a person has marked. The others show the model's own level. */
  cal: Calibration
  families: string[]
  setProduct: (family: string, patch: Partial<ProductCal>) => void
  /** Puts a product back on the model's own level. */
  clearProduct: (family: string) => void
  /** Sets every product at once, as a profile does. */
  setAll: (next: Calibration) => void
  reset: () => void
}

const Context = createContext<CalibrationApi | null>(null)

/** Holds the per-product calibration and keeps it saved. `families` are the products on the shelves. */
export function CalibrationProvider({ families, children }: { families: string[]; children: ReactNode }) {
  const [cal, setCal] = useState<Calibration>(() => loadCalibration())

  const update = useCallback((change: (prev: Calibration) => Calibration) => {
    setCal((prev) => {
      const next = change(prev)
      saveCalibration(next)
      return next
    })
  }, [])

  const setProduct = useCallback(
    (family: string, patch: Partial<ProductCal>) =>
      update((prev) => {
        const base = prev[family] ?? { mode: modeOf(family), threshold: startOf(family), level: 'half' }
        return { ...prev, [family]: { ...base, ...patch, mode: modeOf(family) } }
      }),
    [update],
  )

  const clearProduct = useCallback(
    (family: string) =>
      update((prev) => {
        const next = { ...prev }
        delete next[family]
        return next
      }),
    [update],
  )

  const setAll = useCallback((next: Calibration) => update(() => next), [update])
  const reset = useCallback(() => update(() => ({})), [update])

  const value = useMemo(
    () => ({ cal, families, setProduct, clearProduct, setAll, reset }),
    [cal, families, setProduct, clearProduct, setAll, reset],
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useCalibration(): CalibrationApi {
  const v = useContext(Context)
  if (!v) throw new Error('useCalibration needs a CalibrationProvider')
  return v
}
