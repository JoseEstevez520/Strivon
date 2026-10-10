import { useEffect, useMemo, useState } from 'react'
import { Camera, Globe } from 'lucide-react'
import { ES, GB, PT } from 'country-flag-icons/react/3x2'
import { DayBar } from '@/components/DayBar'
import { PhotoStage } from '@/components/PhotoStage'
import { PickerButton } from '@/components/PickerButton'
import { StateStrip } from '@/components/StateStrip'
import { TaskGroup } from '@/components/TaskGroup'
import { buildMockState } from '@/data/mock'
import { I18nProvider, LANGS, useI18n } from '@/lib/i18n'
import { cameras, cardsOf, gondolaFamilies, historyOf, snapshot, tasksAt, type Group } from '@/lib/tasks'
import { clock } from '@/lib/time'

const GROUPS: Group[] = ['restock', 'moveBack', 'later', 'allGood']
const ACTION: Group[] = ['restock', 'moveBack']
const flag = 'flag block h-3.5 w-[21px] shrink-0 rounded-[3px]'
const LANG_OPTIONS = {
  en: { label: 'English', icon: <GB className={flag} /> },
  pt: { label: 'Português', icon: <PT className={flag} /> },
  es: { label: 'Español', icon: <ES className={flag} /> },
} as const

function Screen() {
  const { t, lang, setLang, family } = useI18n()
  const state = useMemo(() => buildMockState(), [])
  const times = useMemo(
    () => [...new Set(Object.values(state.images).flatMap((l) => l.map((r) => r.ts)))].sort((a, b) => a - b),
    [state],
  )
  const [index, setIndex] = useState(times.length - 1)
  // "all" shows the whole store. A camera narrows the list to what is on that gondola.
  const [camera, setCamera] = useState<string>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)

  const at = times[index]
  const tasks = useMemo(() => tasksAt(state, at), [state, at])
  const visible = camera === 'all' ? tasks : tasks.filter((x) => x.area.camera === camera)
  const cardCount = cardsOf(visible.filter((x) => ACTION.includes(x.group))).length

  const gondola = (c: string) => gondolaFamilies(state, c).map(family).join(' · ')

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // From the list the user is already looking at the row. Only an area picked on the photo is
  // brought into view, once.
  const select = (areaId: string | null, from: 'list' | 'photo' = 'list') => {
    setSelected(areaId)
    if (areaId && from === 'photo') {
      setTimeout(
        () =>
          (document.querySelector(`[data-area="${areaId}"]`) ?? document.querySelector('[data-selected="true"]'))?.scrollIntoView({
            block: 'nearest',
          }),
        220,
      )
    }
  }
  const togglePlay = () => {
    if (!playing && index >= times.length - 1) setIndex(0)
    setPlaying((p) => !p)
  }
  const jumpTo = (ts: number) => {
    setPlaying(false)
    const i = times.findIndex((x) => x >= ts)
    setIndex(i < 0 ? times.length - 1 : i)
  }

  const selectedTask = tasks.find((x) => x.area.area_id === selected)
  const firstAction = visible.find((x) => ACTION.includes(x.group))
  const photoCamera =
    camera !== 'all' ? camera : (selectedTask?.area.camera ?? firstAction?.area.camera ?? cameras(state)[0])
  const photo = snapshot(state, photoCamera, at)
  const cameraTasks = tasks.filter((x) => x.area.camera === photoCamera)

  const pendingAreas = (c: string) => tasks.filter((x) => x.area.camera === c && ACTION.includes(x.group)).length

  return (
    <div className="mx-auto max-w-6xl px-5 pt-5 pb-14">
      <header className="mb-14 flex items-center gap-2">
        <span className="mr-auto text-title tracking-tight">strivon</span>
        <PickerButton
          icon={<Camera />}
          label={t.camera}
          value={camera}
          className="w-64"
          onChange={(c) => {
            setCamera(c)
            setSelected(null)
          }}
          options={[
            {
              value: 'all',
              label: t.allCameras,
              hint: String(tasks.filter((x) => ACTION.includes(x.group)).length),
            },
            ...cameras(state).map((c) => ({
              value: c,
              label: gondola(c),
              hint: String(pendingAreas(c)),
              extra: <StateStrip tasks={tasks.filter((x) => x.area.camera === c)} />,
            })),
          ]}
        />
        <PickerButton
          icon={<Globe />}
          label={t.language}
          value={lang}
          className="w-44"
          onChange={(v) => setLang(v as typeof lang)}
          options={LANGS.map((l) => ({ value: l, ...LANG_OPTIONS[l] }))}
        />
      </header>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-display">{t.headline(cardCount)}</h1>
        <p className="text-meta tabular-nums text-fg-muted">{t.photoFrom(clock(at))}</p>
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[1.7fr_1fr]">
        <div className="order-2 lg:order-1 lg:sticky lg:top-5">
          <p className="mb-2 px-1 text-meta tabular-nums text-fg-muted">
            {gondola(photoCamera)} · {clock(photo.ts)}
          </p>
          <PhotoStage
            tasks={cameraTasks}
            selected={selected}
            onSelect={(id) => select(selected === id ? null : id, 'photo')}
          />
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
              tasks={visible.filter((x) => x.group === g)}
              selected={selected}
              gondola={gondola}
              historyOf={(area) => historyOf(state, area)}
              onSelect={select}
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
