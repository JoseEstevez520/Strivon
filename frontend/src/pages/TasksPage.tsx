import { Box, Map as MapIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { DayBar } from '@/components/DayBar'
import { StopList } from '@/components/StopList'
import { Plan, useLayout } from '@/components/StorePlan'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { suggest } from '@/lib/suggest'
import { cameras, type Task } from '@/lib/tasks'
import { clock } from '@/lib/time'

// three.js is heavy, so the 3D store loads only when it is asked for.
const Store3D = lazy(() => import('@/components/Store3D').then((m) => ({ default: m.Store3D })))

const KEY = 'strivon.tasks.view'
type Mode = '2d' | '3d'

/** The 3D view needs room and a pointer, so it is offered from 1280 px; below that the flat plan is the only one. */
function useWide() {
  const calc = () => typeof window !== 'undefined' && window.innerWidth >= 1280
  const [wide, setWide] = useState(calc)
  useEffect(() => {
    const on = () => setWide(calc())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return wide
}

/**
 * What to do now, across the whole store, on one screen: the plan on the left says where, the list
 * on the right says what to carry to each stop in the order of the round. The plan is flat by
 * default; a button swaps it for the 3D store. On a phone the list comes first.
 */
export function TasksPage() {
  const { t } = useI18n()
  const { state, tasks, at } = useStore()
  const navigate = useNavigate()
  const { cols } = useLayout()
  const wide = useWide()
  const [mode, setMode] = useState<Mode>(() => {
    // A link can open straight on a view: /#/?view=3d
    const asked = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('view')
    if (asked === '3d' || asked === '2d') return asked
    try {
      return localStorage.getItem(KEY) === '3d' ? '3d' : '2d'
    } catch {
      return '2d'
    }
  })
  const pick = (m: Mode) => {
    setMode(m)
    try {
      localStorage.setItem(KEY, m)
    } catch {
      /* the choice just is not remembered */
    }
  }
  // Only a gondola with something empty or in the wrong place is work; half full is not.
  const stops = useMemo(() => suggest(tasks).filter((s) => s.empty + s.wrong > 0), [tasks])
  const byCamera = useMemo(() => {
    const m: Record<string, Task[]> = {}
    for (const x of tasks) (m[x.area.camera] ??= []).push(x)
    return m
  }, [tasks])
  const rankOf = (c: string) => {
    const i = stops.findIndex((s) => s.camera === c)
    return i >= 0 && i < 3 ? i + 1 : 0
  }
  const three = wide && mode === '3d'

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        {/* The order is explained on hover, not written on the page: a standing line was clutter. */}
        <h1 className="text-display" title={t.orderNote}>
          {t.planHeadline(stops.length)}
        </h1>
        <p className="text-meta tabular-nums text-fg-muted">{t.photoFrom(clock(at))}</p>
      </div>
      <DayBar className="mb-6" />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="order-2 xl:order-1">
          {wide && (
            <div className="mb-3 flex justify-end gap-1">
              {(
                [
                  ['2d', MapIcon, '2D'],
                  ['3d', Box, '3D'],
                ] as const
              ).map(([m, Icon, label]) => (
                <button
                  key={m}
                  type="button"
                  data-on={mode === m}
                  onClick={() => pick(m)}
                  className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-ui text-fg-secondary transition-colors hover:bg-surface data-[on=true]:bg-surface data-[on=true]:text-fg"
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          )}
          {three ? (
            <Suspense fallback={<div className="h-[min(84dvh,54rem)] rounded-2xl bg-sunk" />}>
              <Store3D />
            </Suspense>
          ) : (
            <Plan list={cameras(state)} cols={cols} byCamera={byCamera} rankOf={rankOf} choose={(c) => navigate(`/gondolas/${c}`)} />
          )}
        </div>
        <div className="order-1 xl:order-2">
          <StopList stops={stops} byCamera={byCamera} />
        </div>
      </div>
    </>
  )
}
