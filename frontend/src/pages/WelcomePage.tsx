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
import { useMemo } from 'react'
import { DayMap } from '@/components/day/DayMap'
import { RankedBars } from '@/components/day/RankedBars'
import { CameraTile } from '@/components/CameraTile'
import { TaskBoard } from '@/components/TaskBoard'
import { TaskCard } from '@/components/TaskCard'
import { useI18n } from '@/lib/i18n'
import { storeStats } from '@/lib/stats'
import { useStore } from '@/lib/store'
import { cardsOf } from '@/lib/tasks'

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

const TEAM = [
  ['José', 'The web app and the integration'],
  ['Miguel', 'The AI pipeline'],
  ['André', 'Evaluation and data'],
  ['Leonor', 'Labelling, design and the pitch'],
]

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

const nothing = () => {}

/**
 * The first screen. The headline sets what a camera sees against what Strivon does, and around it
 * float the app's own parts (tasks, a gondola, a card to move back), so the product is in view
 * from the first second. They are for looking at: the live ones are further down.
 */
function Hero() {
  const { tasks, gondola, where, historyOf } = useStore()
  const restock = cardsOf(tasks.filter((x) => x.group === 'restock'))
  const moveBack = cardsOf(tasks.filter((x) => x.group === 'moveBack'))
  const card = (c?: (typeof restock)[number]) =>
    c && (
      <TaskCard
        key={c.key}
        card={c}
        selected={null}
        gondola={gondola}
        where={where}
        historyOf={historyOf}
        onSelect={nothing}
        onJump={nothing}
      />
    )
  const left = [card(restock[0]), restock[2] && <CameraTile key="tile" camera={restock[2].tasks[0].area.camera} />]
  const right = [card(moveBack[0]), card(restock[1]), card(moveBack[1])]
  const floaters = 'pointer-events-none flex flex-col gap-3 select-none'

  return (
    <div className="relative left-1/2 grid w-[min(92vw,88rem)] -translate-x-1/2 grid-cols-[minmax(0,1fr)] items-center gap-10 px-5 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14 lg:py-20">
      <div aria-hidden className={`${floaters} order-2 lg:order-1 lg:-translate-y-4 lg:-rotate-1`}>
        {left}
      </div>

      <div className="order-1 flex flex-col items-center gap-6 text-center lg:order-2">
        <p className="font-mono text-meta tracking-[0.14em] text-fg-muted uppercase">Shelf monitoring for fresh produce</p>
        <h1 className="text-[clamp(2.25rem,4.6vw,4rem)] leading-[1.06] text-balance font-semibold tracking-[-0.04em]">
          <span className="block text-fg-muted">A camera sees the shelf.</span>
          <span className="block">Strivon tells you what to do.</span>
        </h1>
        <p className="text-[clamp(1.0625rem,1.6vw,1.25rem)] leading-relaxed text-fg-secondary">
          Ceiling cameras watch the fruit and vegetable shelves. Strivon compares what they see with the planogram and tells the staff
          what to restock and what to put back, before anyone has to go looking.
        </p>
      </div>

      <div aria-hidden className={`${floaters} order-3 lg:translate-y-6 lg:rotate-1`}>
        {right}
      </div>
    </div>
  )
}

/**
 * The presentation page, laid out like the project landings: a centred first screen, then one
 * section per idea at the page's one width. It is the app itself, not pictures of it: the task
 * list can be opened and the day map is drawn from the same figures. It stands outside the app's
 * layout so it reads as one page.
 */
export function WelcomePage() {
  const { t, family } = useI18n()
  const { state, tasks, gondola } = useStore()
  const stats = useMemo(() => storeStats(state), [state])

  return (
    <div className="scrollbar-subtle h-dvh overflow-x-clip overflow-y-auto [scrollbar-gutter:stable]">
      <main className="mx-auto max-w-6xl px-5 pb-16">
        <Hero />

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

        <Section title="See it" lead="This is the app, not a picture of it. Open any card to see its day, its shelf and the photo.">
          <div className="scrollbar-subtle h-[40rem] overflow-y-auto border-y border-border py-4">
            <TaskBoard tasks={tasks} />
          </div>
        </Section>

        <Section
          title="How the store is doing"
          lead="How much of the time shelves were empty, when it happened and where. Figures from photos taken an hour apart are estimates."
        >
          <DayMap rows={stats.map} hours={stats.hours} />
          <div className="mt-10 grid gap-x-10 gap-y-8 lg:grid-cols-2">
            <div>
              <p className="mb-1 px-1 text-label text-fg-muted">{t.worstProducts}</p>
              <RankedBars items={stats.map.slice(0, 5).map((r) => ({ key: r.product, label: family(r.product), share: r.share }))} />
            </div>
            <div>
              <p className="mb-1 px-1 text-label text-fg-muted">{t.worstGondolas}</p>
              <RankedBars items={stats.byGondola.slice(0, 5).map((g) => ({ key: g.camera, label: gondola(g.camera), share: g.share }))} />
            </div>
          </div>
        </Section>

        <Section title="Team">
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map(([name, role]) => (
              <div key={name}>
                <dt className="text-label">{name}</dt>
                <dd className="text-ui text-fg-secondary">{role}</dd>
              </div>
            ))}
          </dl>
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
