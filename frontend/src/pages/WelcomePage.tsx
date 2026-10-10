import { useMemo } from 'react'
import { DayMap } from '@/components/day/DayMap'
import { RankedBars } from '@/components/day/RankedBars'
import { TaskBoard } from '@/components/TaskBoard'
import { useI18n } from '@/lib/i18n'
import { storeStats } from '@/lib/stats'
import { useStore } from '@/lib/store'

const STEPS = [
  ['A camera looks', 'Each gondola has a ceiling camera that takes a photo about once an hour.'],
  ['Each shelf area is checked', 'Against the planogram: is it holding the right product, and how full is it?'],
  ['Staff get the work', 'What is empty, what is in the wrong place, and what can wait.'],
]

const TEAM = [
  ['José', 'The web app and the integration'],
  ['Miguel', 'The AI pipeline'],
  ['André', 'Evaluation and data'],
  ['Leonor', 'Labelling, design and the pitch'],
]

const Section = ({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) => (
  <section className="py-12">
    <h2 className="text-title">{title}</h2>
    {lead && <p className="mt-2 max-w-xl text-copy text-fg-secondary">{lead}</p>}
    <div className="mt-6">{children}</div>
  </section>
)

/**
 * The presentation page. It is the app itself, not pictures of it: the task list is the real one
 * and can be opened, and the day map and rankings are drawn from the same figures. It stands
 * outside the app's layout so it reads as one page.
 */
export function WelcomePage() {
  const { t, family } = useI18n()
  const { state, tasks, gondola } = useStore()
  const stats = useMemo(() => storeStats(state), [state])

  return (
    <div className="scrollbar-subtle h-dvh overflow-y-auto [scrollbar-gutter:stable]">
      <main className="mx-auto max-w-6xl px-5 pb-16">
        <header className="pt-6 text-title tracking-tight">strivon</header>

        <div className="py-20">
          <h1 className="max-w-[18ch] text-[clamp(2.5rem,7vw,4.5rem)] leading-[1.05] font-semibold tracking-[-0.04em]">
            Every shelf tells you what it needs before it runs empty.
          </h1>
          <p className="mt-6 max-w-xl text-title font-normal text-fg-secondary">
            Ceiling cameras watch the fruit and vegetable shelves. Strivon compares what they see with the planogram and
            tells the staff what to restock and what to put back.
          </p>
        </div>

        <Section
          title="What staff see"
          lead="One list for the whole store, grouped by what to do and ordered by what has been gone the longest. Open any card."
        >
          <div className="scrollbar-subtle h-[38rem] overflow-y-auto border-y border-border py-4">
            <TaskBoard tasks={tasks} />
          </div>
        </Section>

        <Section title="How it works">
          <ol className="grid gap-4 sm:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="rounded-2xl bg-surface p-5">
                <span className="text-label text-fg-muted">{i + 1}</span>
                <p className="mt-2 text-label text-fg">{title}</p>
                <p className="mt-1 text-ui text-fg-secondary">{text}</p>
              </li>
            ))}
          </ol>
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
