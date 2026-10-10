import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { loadSource, type Source } from '@/model/source'
import type { Area } from '@/model/types'
import { useI18n } from './i18n'
import { gondolaFamilies, historyOf, tasksAt, type HistoryPoint, type Task } from './tasks'

interface Store {
  state: Source['state']
  /** The URL of a camera's photo, or null when there are no real photos. */
  photoUrl: Source['photoUrl']
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
  /** How people would call a gondola: the two products that fill most of it. */
  gondola: (camera: string) => string
  /**
   * Where an area is, without repeating its own product: the other products of its gondola
   * ("with Cabbage"), or nothing when the gondola holds only that product.
   */
  where: (area: Area) => string
  historyOf: (area: Area) => HistoryPoint[]
}

const Context = createContext<Store | null>(null)

/** Loads the store, then shares its state at the chosen moment with every page. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [source, setSource] = useState<Source | null>(null)

  useEffect(() => {
    let live = true
    loadSource().then((s) => live && setSource(s))
    return () => {
      live = false
    }
  }, [])

  if (!source) {
    return <p className="grid min-h-screen place-items-center text-ui text-fg-secondary">{t.loading}</p>
  }
  return <LoadedStore source={source}>{children}</LoadedStore>
}

function LoadedStore({ source, children }: { source: Source; children: ReactNode }) {
  const { t, family } = useI18n()
  const { state, photoUrl } = source
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
      gondola: (camera) => gondolaFamilies(state, camera).map(family).join(' · '),
      where: (area) => {
        const keys = gondolaFamilies(state, area.camera)
        const others = keys.filter((k) => k !== area.family)
        if (others.length === keys.length) return keys.map(family).join(' · ')
        return others.length ? t.withProduct(others.map(family).join(' · ')) : ''
      },
      historyOf: (area) => historyOf(state, area),
    }
  }, [state, photoUrl, times, index, playing, family, t])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useStore(): Store {
  const v = useContext(Context)
  if (!v) throw new Error('useStore needs a StoreProvider')
  return v
}
