import { useEffect, useMemo, useState } from 'react'
import { Camera, Globe } from 'lucide-react'
import { DayBar } from '@/components/DayBar'
import { PhotoStage } from '@/components/PhotoStage'
import { PickerButton } from '@/components/PickerButton'
import { TaskGroup } from '@/components/TaskGroup'
import { buildMockState } from '@/data/mock'
import { I18nProvider, LANGS, useI18n } from '@/lib/i18n'
import { cameras, snapshot, tasksAt, type Group } from '@/lib/tasks'
import { clock } from '@/lib/time'

const GROUPS: Group[] = ['restock', 'moveBack', 'later', 'allGood']
const LANG_LABEL = { en: 'EN', pt: 'PT', es: 'ES' } as const

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

  const pick = (areaId: string) => {
    setSelected(areaId)
    setCamera(state.areas[areaId].camera)
  }
  const togglePlay = () => {
    if (!playing && index >= times.length - 1) setIndex(0)
    setPlaying((p) => !p)
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
          className="w-24"
          label={t.language}
          value={lang}
          onChange={(v) => setLang(v as typeof lang)}
          options={LANGS.map((l) => ({ value: l, label: LANG_LABEL[l] }))}
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
          <PhotoStage tasks={cameraTasks} selected={selected} onSelect={pick} />
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
              onSelect={pick}
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
