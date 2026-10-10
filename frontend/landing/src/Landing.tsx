import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowRight,
  Apple,
  Camera,
  ChartNoAxesColumn,
  ClipboardCheck,
  Languages,
  LayoutGrid,
  ListChecks,
  Play,
  ScanSearch,
  type LucideIcon,
} from 'lucide-react'
import { AreaCrop } from '@/components/AreaCrop'
import { GROUP_COLOR, GROUP_ICON } from '@/components/groupStyle'
import { useI18n } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { cardsOf, snapshot } from '@/lib/tasks'
import { clock } from '@/lib/time'

const STEPS: [LucideIcon, string, string][] = [
  [Camera, 'A camera looks', 'Each gondola has a ceiling camera that takes a photo about once an hour.'],
  [ScanSearch, 'Each shelf area is checked', 'Against the planogram: is it holding the right product, and how full is it?'],
  [ClipboardCheck, 'Staff get the work', 'What is empty, what is in the wrong place, and what can wait.'],
]

const TODAY: [LucideIcon, string, string][] = [
  [ListChecks, 'One list for the whole store', 'Grouped by what to do: restock, move back, leave alone. The product that has been gone the longest comes first.'],
  [LayoutGrid, 'Every gondola with its photo', 'Each camera with what it needs, and the shelf areas drawn on the photo so the proof is in view.'],
  [Apple, 'Stock by product', 'A product’s stock summed over every shelf area it sits on, whatever the gondola.'],
  [Play, 'The day, replayed', 'Move through the photos of the day and watch each area change, or open a card to see its day as a strip.'],
  [ChartNoAxesColumn, 'How the store is doing', 'How much of the time shelves were empty, when and where, marked as an estimate because photos come an hour apart.'],
  [Languages, 'English, Portuguese and Spanish', 'The whole app, in the language of whoever is on shift.'],
]

const TEAM = ['Jose', 'Miguel', 'André', 'Leonor']

const Section = ({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) => (
  <section className="py-12 sm:py-16">
    <h2 className="text-display">{title}</h2>
    {lead && <p className="mt-3 text-copy text-fg-secondary">{lead}</p>}
    <div className="mt-8">{children}</div>
  </section>
)

const Card = ({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) => (
  <li className="rounded-2xl bg-surface p-5">
    <Icon className="size-5 text-fg-secondary" strokeWidth={1.5} aria-hidden />
    <p className="mt-3 text-label text-fg">{title}</p>
    <p className="mt-1 text-ui text-fg-secondary">{text}</p>
  </li>
)

const CELL = { w: 76, h: 44, gap: 8 }
const tone = (pct: number) => `color-mix(in oklab, var(--danger) ${pct}%, var(--sunk))`

/** A fixed pseudo-random value for a slot, so it keeps its state when the window is resized. */
const hash = (r: number, c: number) => {
  const x = Math.sin(r * 127.1 + c * 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** One red hue in three steps, by how much of a slot is gone, as on the day map. */
const slotFill = (v: number) => (v < 0.25 ? tone(84) : v < 0.5 ? tone(52) : v < 0.75 ? tone(28) : 'var(--sunk)')

/**
 * A scatter of slots like the day map's, made of real elements in a grid that is sized to hold
 * whole slots, so none is cut at the edge. They fade out toward the centre so the name reads.
 */
function Slots() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ cols: 0, rows: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () =>
      setSize({
        cols: Math.max(1, Math.floor((el.clientWidth + CELL.gap) / (CELL.w + CELL.gap))),
        rows: Math.max(1, Math.floor((el.clientHeight + CELL.gap) / (CELL.h + CELL.gap))),
      })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const cells = []
  for (let r = 0; r < size.rows; r++) {
    for (let c = 0; c < size.cols; c++) {
      const dx = (c + 0.5) / size.cols - 0.5
      const dy = (r + 0.5) / size.rows - 0.5
      // Nothing close to the text, then more and more of the slots as they get further from it, so
      // the scatter fades in instead of stopping at an edge.
      const fade = Math.max(0, Math.min(1, (Math.hypot(dx * 1.1, dy * 2) - 0.45) / 0.3))
      const shown = hash(c, r) > 0.4 && fade > 0
      cells.push(
        <span
          key={`${r}-${c}`}
          className="rounded-[7px]"
          style={{ background: shown ? slotFill(hash(r, c)) : 'transparent', opacity: 0.85 * fade * fade }}
        />,
      )
    }
  }

  return (
    <div
      ref={ref}
      aria-hidden
      className="absolute inset-0 grid gap-2"
      style={{ gridTemplateColumns: `repeat(${size.cols || 1}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${size.rows || 1}, minmax(0, 1fr))` }}
    >
      {cells}
    </div>
  )
}

/**
 * The first screen, the height of the window: the name and what it does in the middle, and around
 * them a scatter of slots like the day map's, some of them gone. Nothing literal, and nothing to
 * press.
 */
function Hero() {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-5">
      <Slots />

      <div className="relative flex max-w-3xl flex-col items-center gap-6 text-center">
        <h1 className="text-[clamp(3.5rem,9vw,7rem)] leading-none font-semibold tracking-[-0.045em]">Strivon</h1>
        <p className="text-[clamp(1.125rem,1.8vw,1.5rem)] leading-relaxed text-fg-secondary">
          Ceiling cameras watch the fruit and vegetable shelves. Strivon compares what they see with the planogram and tells the staff
          what to restock and what to put back.
        </p>
      </div>
    </div>
  )
}

/** A gondola as in the app's grid, but only to look at: it leads nowhere. */
function Tile({ camera, on }: { camera: string; on: boolean }) {
  const { t } = useI18n()
  const { state, at, tasks, gondola, photoUrl } = useStore()
  const own = tasks.filter((x) => x.area.camera === camera)
  const counts = (['restock', 'moveBack', 'later'] as const).map((g) => [g, own.filter((x) => x.group === g).length] as const).filter(([, n]) => n > 0)
  const src = photoUrl?.(camera, snapshot(state, camera, at).image)

  return (
    <div data-on={on} className="flex flex-col gap-2 rounded-2xl bg-surface p-2 transition-colors data-[on=true]:bg-sunk">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[#d6d8d0]">
        {src && <img src={src} alt="" decoding="async" className="absolute inset-0 size-full object-cover" />}
      </div>
      <div className="flex items-center justify-between gap-2.5 px-1 pb-1">
        <span className="line-clamp-1 min-w-0 text-label">{gondola(camera)}</span>
        <span className="flex shrink-0 gap-2.5 text-meta font-medium tabular-nums text-fg-secondary">
          {counts.map(([group, n]) => {
            const Icon = GROUP_ICON[group]
            return (
              <span key={group} className="flex items-center gap-1">
                <Icon className="size-3.5" style={{ color: GROUP_COLOR[group] }} aria-hidden />
                {n}
                <span className="sr-only">{t[group]}</span>
              </span>
            )
          })}
        </span>
      </div>
    </div>
  )
}

/**
 * A small, fixed-size demo built from the app's look: a few things to do on one side and the
 * gondolas they are in on the other. Pick a task and its gondola lights up. Unlike the app,
 * nothing opens in place, nothing folds and nothing leads away, so it never changes size.
 */
function Demo() {
  const { family } = useI18n()
  const { tasks, gondola, where } = useStore()
  const cards = useMemo(
    () => [
      ...cardsOf(tasks.filter((x) => x.group === 'restock')).slice(0, 3),
      ...cardsOf(tasks.filter((x) => x.group === 'moveBack')).slice(0, 1),
    ],
    [tasks],
  )
  const [picked, setPicked] = useState<string | null>(null)
  const card = cards.find((c) => c.key === picked) ?? cards[0]
  if (!card) return null
  const cameras = [...new Set(cards.map((c) => c.tasks[0].area.camera))].slice(0, 4)

  return (
    <div className="rounded-2xl bg-surface p-2">
      <div className="flex h-9 items-center gap-1.5 px-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2.5 rounded-full bg-sunk" />
        ))}
        <span className="ml-3 text-meta text-fg-muted">Demo</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 rounded-xl bg-bg p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ul className="flex flex-col gap-2">
          {cards.map((c) => {
            const first = c.tasks[0]
            return (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => setPicked(c.key)}
                  style={{ '--c': GROUP_COLOR[c.group] } as CSSProperties}
                  data-on={c.key === card.key}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg bg-[color-mix(in_oklab,var(--c)_13%,transparent)] p-2 pr-3 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--c)_19%,transparent)] data-[on=true]:bg-[color-mix(in_oklab,var(--c)_22%,transparent)]"
                >
                  <AreaCrop area={first.area} image={first.record.image} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-label">{family(first.area.family)}</span>
                    <span className="block truncate text-meta text-fg-secondary">{where(first.area, first.obs.observed_family)}</span>
                  </span>
                  <span className="text-meta tabular-nums text-fg-secondary">{clock(first.since ?? first.record.ts)}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="grid grid-cols-2 content-start gap-3">
          {cameras.map((camera) => (
            <Tile key={camera} camera={camera} on={camera === card.tasks[0].area.camera} />
          ))}
        </div>
      </div>
      <span className="sr-only">{gondola(card.tasks[0].area.camera)}</span>
    </div>
  )
}

/**
 * The landing, laid out like the project landings: a centred first screen, then one
 * section per idea at the page's one width. It is the app itself, not pictures of it: the task
 * list can be opened and the day map is drawn from the same figures. It stands outside the app's
 * layout so it reads as one page.
 */
export function Landing() {
  return (
    <div className="scrollbar-subtle h-dvh overflow-x-clip overflow-y-auto [scrollbar-gutter:stable]">
      <Hero />
      <main className="mx-auto max-w-6xl px-5 pb-16">
        <Section title="What is Strivon?">
          <div className="flex flex-col gap-4 text-copy text-fg-secondary">
            <p>
              In a store, nobody can look at every shelf all day. A shelf runs empty, a product ends up in another one’s place,
              and the staff find out when a customer asks.
            </p>
            <p>
              Strivon looks for them. From a ceiling-camera photo and the store planogram it checks each shelf area: is it
              holding the product it should, and how full is it? What comes out is a list of work, not a report.
            </p>
          </div>
        </Section>

        <Section title="How it works">
          <ol className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {STEPS.flatMap(([Icon, title, text], i) => [
              <li key={title} className="rounded-2xl bg-surface p-5">
                <Icon className="size-5 text-fg-secondary" strokeWidth={1.5} aria-hidden />
                <p className="mt-3 text-label text-fg">{title}</p>
                <p className="mt-1 text-ui text-fg-secondary">{text}</p>
              </li>,
              i < STEPS.length - 1 && (
                <li key={`a${i}`} aria-hidden className="hidden items-center text-fg-muted md:flex">
                  <ArrowRight className="size-5" strokeWidth={1.5} />
                </li>
              ),
            ])}
          </ol>
        </Section>

        <Section title="What it does today">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TODAY.map(([icon, title, text]) => (
              <Card key={title} icon={icon} title={title} text={text} />
            ))}
          </ul>
        </Section>

        <Section title="See it" lead="A few things to do, and the gondolas they are in.">
          <Demo />
        </Section>

        <Section title="Team">
          <ul className="flex flex-wrap gap-x-10 gap-y-2 text-copy">
            {TEAM.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </Section>

        <footer className="pt-12">
          <div className="mb-6 flex items-center justify-center gap-8">
            <img src="partners/junctionx.png" alt="JunctionX Lisbon" className="h-14 w-auto" />
            <img src="partners/sensei.png" alt="Sensei" className="h-14 w-auto" />
          </div>
          <p className="text-meta text-fg-muted">Built at JunctionX Lisbon 2026, for the Sensei challenge. The logos belong to their owners.</p>
        </footer>
      </main>
    </div>
  )
}
