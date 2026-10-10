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
import { TaskBoard } from '@/components/TaskBoard'
import { useStore } from '@/lib/store'

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
const W = 1600
const H = 900

/** One red hue in three steps, by how much of a slot is gone, as on the day map. */
const tone = (step: number) => `color-mix(in oklab, var(--danger) ${[28, 52, 84][step]}%, var(--sunk))`

/**
 * A scatter of slots like the day map's, kept away from the centre so the name reads. It is the
 * same few cells every time: a fixed seed, so the page never shifts between visits.
 */
function slots() {
  let seed = 11
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const cols = Math.ceil(W / (CELL.w + CELL.gap)) + 1
  const rows = Math.ceil(H / (CELL.h + CELL.gap)) + 1
  const out: { x: number; y: number; fill: string }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * (CELL.w + CELL.gap) - 30
      const y = r * (CELL.h + CELL.gap) - 10
      const far = Math.hypot(((x + CELL.w / 2 - W / 2) / W) * 1.1, ((y + CELL.h / 2 - H / 2) / H) * 2) > 0.55
      if (!far || rnd() < 0.55) continue
      const pick = rnd()
      out.push({ x, y, fill: pick < 0.25 ? tone(2) : pick < 0.5 ? tone(1) : pick < 0.75 ? tone(0) : 'var(--sunk)' })
    }
  }
  return out
}
const SLOTS = slots()

/**
 * The first screen, the height of the window: the name and what it does in the middle, and around
 * them a scatter of slots like the day map's, some of them gone. Nothing literal, and nothing to
 * press.
 */
function Hero() {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-5">
      <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        {SLOTS.map((c) => (
          <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={CELL.w} height={CELL.h} rx={7} style={{ fill: c.fill }} opacity={0.8} />
        ))}
      </svg>

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

/**
 * The presentation page, laid out like the project landings: a centred first screen, then one
 * section per idea at the page's one width. It is the app itself, not pictures of it: the task
 * list can be opened and the day map is drawn from the same figures. It stands outside the app's
 * layout so it reads as one page.
 */
export function WelcomePage() {
  const { tasks } = useStore()

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

        <Section title="See it" lead="This is the app, not a picture of it. Open any card to see its day, its shelf and the photo.">
          <div className="scrollbar-subtle h-[40rem] overflow-y-auto border-y border-border py-4">
            <TaskBoard tasks={tasks} />
          </div>
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
