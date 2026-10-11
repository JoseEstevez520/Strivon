import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadSource, type Source } from '@/model/source'
import type { Area } from '@/model/types'
import { CalibrationProvider, useCalibration } from './calibrationStore'
import { calibrate } from './calibration'
import { useI18n } from './i18n'
import { cameras, gondolaFamilies, historyOf, tasksAt, type HistoryPoint, type Task } from './tasks'

interface Store {
  state: Source['state']
  /** The URL of a camera's photo, or null when there are no real photos. */
  photoUrl: Source['photoUrl']
  /** True while the stock states are invented, so pages with figures can say so. */
  simulated: boolean
  /** Every moment any camera took a photo, in order. */
  times: number[]
  index: number
  /** The moment being shown, in unix seconds. */
  at: number
  setIndex: (i: number) => void
  playing: boolean
  togglePlay: () => void
  jumpTo: (ts: number) => void
  tasks: Task[]
  /** A gondola's name: a fixed number, in the order of the cameras, so it never changes with what is on it. */
  gondola: (camera: string) => string
  /** What fills most of a gondola: its two main products. */
  gondolaWhat: (camera: string) => string
  /** The number and the products together, for places with room for both. */
  gondolaFull: (camera: string) => string
  /**
   * Where an area is, without repeating its own product: the other products of its gondola
   * ("with Cabbage"), or nothing when the gondola holds only that product. `alsoSaid` is a
   * product the caller already names, so it is not repeated.
   */
  where: (area: Area, alsoSaid?: string) => string
  historyOf: (area: Area) => HistoryPoint[]
}

const Context = createContext<Store | null>(null)

/**
 * Loads the store, then shares its state at the chosen moment with every page. `limit` keeps only
 * the first few gondolas, for a demo that shows a small store.
 */
export function StoreProvider({ children, limit }: { children: ReactNode; limit?: number }) {
  const { t } = useI18n()
  const [source, setSource] = useState<Source | null>(null)

  useEffect(() => {
    let live = true
    loadSource(limit).then((s) => live && setSource(s))
    return () => {
      live = false
    }
  }, [limit])

  if (!source) {
    return <p className="grid min-h-screen place-items-center text-ui text-fg-secondary">{t.loading}</p>
  }
  return <LoadedStore source={source}>{children}</LoadedStore>
}

function LoadedStore({ source, children }: { source: Source; children: ReactNode }) {
  const families = useMemo(() => [...new Set(Object.values(source.state.areas).map((a) => a.family))].sort(), [source])
  return (
    <CalibrationProvider families={families}>
      <CalibratedStore source={source}>{children}</CalibratedStore>
    </CalibrationProvider>
  )
}

/** Applies the per-product calibration once, so every page reads the effective stock level. */
function CalibratedStore({ source, children }: { source: Source; children: ReactNode }) {
  const { t, family } = useI18n()
  const { cal } = useCalibration()
  const { photoUrl, simulated } = source
  // Without markers this is the model's own state, so the app shows exactly what the model answered.
  const state = useMemo(() => calibrate(source.state, cal), [source, cal])
  const times = useMemo(
    () => [...new Set(Object.values(state.images).flatMap((l) => l.map((r) => r.ts)))].sort((a, b) => a - b),
    [state],
  )
  const [index, setIndexState] = useState(times.length - 1)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setIndexState((i) => {
        if (i >= times.length - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, 900)
    return () => clearInterval(id)
  }, [playing, times.length])

  const value = useMemo<Store>(() => {
    const at = times[index]
    return {
      state,
      photoUrl,
      simulated,
      times,
      index,
      at,
      setIndex: (i) => {
        setPlaying(false)
        setIndexState(i)
      },
      playing,
      togglePlay: () => {
        if (!playing && index >= times.length - 1) setIndexState(0)
        setPlaying((p) => !p)
      },
      jumpTo: (ts) => {
        setPlaying(false)
        const i = times.findIndex((x) => x >= ts)
        setIndexState(i < 0 ? times.length - 1 : i)
      },
      tasks: tasksAt(state, at),
      gondola: (camera) => t.gondolaN(cameras(state).indexOf(camera) + 1),
      gondolaWhat: (camera) => gondolaFamilies(state, camera).map(family).join(' · '),
      gondolaFull: (camera) =>
        `${t.gondolaN(cameras(state).indexOf(camera) + 1)} · ${gondolaFamilies(state, camera).map(family).join(' · ')}`,
      where: (area, alsoSaid) => {
        const keys = gondolaFamilies(state, area.camera).filter((k) => k !== alsoSaid)
        const others = keys.filter((k) => k !== area.family)
        if (others.length === keys.length) return keys.map(family).join(' · ')
        return others.length ? t.withProduct(others.map(family).join(' · ')) : ''
      },
      historyOf: (area) => historyOf(state, area),
    }
  }, [state, photoUrl, simulated, times, index, playing, family, t])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useStore(): Store {
  const v = useContext(Context)
  if (!v) throw new Error('useStore needs a StoreProvider')
  return v
}
