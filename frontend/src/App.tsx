import { useEffect, useMemo, useState } from 'react'
import { Camera, Globe } from 'lucide-react'
import { ES, GB, PT } from 'country-flag-icons/react/3x2'
import { DayBar } from '@/components/DayBar'
import { PhotoStage } from '@/components/PhotoStage'
import { PickerButton } from '@/components/PickerButton'
import { TaskGroup } from '@/components/TaskGroup'
import { buildMockState } from '@/data/mock'
import { I18nProvider, LANGS, useI18n } from '@/lib/i18n'
import { cameras, historyOf, snapshot, tasksAt, type Group } from '@/lib/tasks'
import { clock } from '@/lib/time'

const GROUPS: Group[] = ['restock', 'moveBack', 'later', 'allGood']
const flag = 'flag block h-3.5 w-[21px] shrink-0 rounded-[3px]'
const LANG_OPTIONS = {
  en: { label: 'English', icon: <GB className={flag} /> },
  pt: { label: 'Português', icon: <PT className={flag} /> },
  es: { label: 'Español', icon: <ES className={flag} /> },
} as const

function Screen() {
  const { t, lang, setLang } = useI18n()
  const state = useMemo(() => buildMockState(), [])
  const times = useMemo(
    () => [...new Set(Object.values(state.images).flatMap((l) => l.map((r) => r.ts)))].sort((a, b) => a - b),
    [state],
  )
  const [index, setIndex] = useState(times.length - 1)
  const [camera, setCamera] = useState(cameras(state)[0])
  const [selected, setSelected] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)

  const at = times[index]
  const tasks = useMemo(() => tasksAt(state, at), [state, at])
  const open = tasks.filter((x) => x.group === 'restock' || x.group === 'moveBack')

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setIndex((i) => {
        if (i >= times.length - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, 900)
    return () => clearInterval(id)
  }, [playing, times.length])

  // Pressing the open one closes it. Picking an area also brings its camera's photo.
  const pick = (areaId: string, from: 'list' | 'photo' = 'list') => {
    const opening = selected !== areaId
    setSelected(opening ? areaId : null)
    setCamera(state.areas[areaId].camera)
    // Only an area picked on the photo needs its row brought into view, once. From the list the
    // user is already looking at it, and moving the page there reads as a jump.
    if (opening && from === 'photo') {
      setTimeout(
        () => document.querySelector(`[data-area="${areaId}"]`)?.scrollIntoView({ block: 'nearest' }),
        220,
      )
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const togglePlay = () => {
    if (!playing && index >= times.length - 1) setIndex(0)
    setPlaying((p) => !p)
  }

  const jumpTo = (ts: number) => {
    setPlaying(false)
    const i = times.findIndex((x) => x >= ts)
    setIndex(i < 0 ? times.length - 1 : i)
  }
  const cameraTasks = tasks.filter((x) => x.area.camera === camera)
  const photo = snapshot(state, camera, at)

  return (
    <div className="mx-auto max-w-6xl px-5 pt-5 pb-14">
      <header className="mb-14 flex items-center gap-2">
        <span className="mr-auto text-title tracking-tight">strivon</span>
        <PickerButton
          icon={<Camera />}
          className="w-48"
          label={t.camera}
          value={camera}
          onChange={(c) => {
            setCamera(c)
            setSelected(null)
          }}
          options={cameras(state).map((c) => ({
            value: c,
            label: `${t.camera} ${c}`,
            hint: String(open.filter((x) => x.area.camera === c).length),
          }))}
        />
        <PickerButton
          icon={<Globe />}
          className="w-44"
          label={t.language}
          value={lang}
          onChange={(v) => setLang(v as typeof lang)}
          options={LANGS.map((l) => ({ value: l, ...LANG_OPTIONS[l] }))}
        />
      </header>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-display">{t.headline(open.length)}</h1>
        <p className="text-meta tabular-nums text-fg-muted">{t.photoFrom(clock(at))}</p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1.7fr_1fr]">
        <div className="order-2 lg:order-1">
          <p className="mb-2 px-1 text-meta tabular-nums text-fg-muted">
            {t.camera} {camera} · {clock(photo.ts)}
          </p>
          <PhotoStage tasks={cameraTasks} selected={selected} onSelect={(id) => pick(id, 'photo')} />
          <DayBar
            times={times}
            index={index}
            onChange={(i) => {
              setPlaying(false)
              setIndex(i)
            }}
            playing={playing}
            onTogglePlay={togglePlay}
          />
        </div>

        <div className="order-1 lg:order-2">
          {GROUPS.map((g) => (
            <TaskGroup
              key={g}
              group={g}
              tasks={tasks.filter((x) => x.group === g)}
              selected={selected}
              historyOf={(area) => historyOf(state, area)}
              onSelect={pick}
              onJump={jumpTo}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <Screen />
    </I18nProvider>
  )
}
