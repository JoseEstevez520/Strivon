import { createLibrary, defineComponent } from '@openuidev/react-lang'
import { Footprints, Info } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { z } from 'zod'
import { AreaCrop } from '@/components/AreaCrop'
import { CameraTile } from '@/components/CameraTile'
import { DataTable } from '@/components/charts/DataTable'
import { StackBar } from '@/components/charts/StackBar'
import { TrendChart } from '@/components/charts/TrendChart'
import { VBars } from '@/components/charts/VBars'
import { DayMap } from '@/components/day/DayMap'
import { RankedBars } from '@/components/day/RankedBars'
import { Chips } from '@/components/StopList'
import { GROUP_COLOR, GROUP_ICON } from '@/components/groupStyle'
import { useI18n } from '@/lib/i18n'
import { breakdown, rows, trend, type Scope } from '@/lib/insights'
import { storeStats } from '@/lib/stats'
import { useStore } from '@/lib/store'
import { suggest } from '@/lib/suggest'
import { cardsOf } from '@/lib/tasks'
import { clock } from '@/lib/time'

/**
 * The parts a model may answer with. Every part takes references (a product key, a camera, a
 * group) and never a figure: each one works its numbers out here from the store. So the model
 * chooses and arranges, and cannot make a value up.
 */

function useData() {
  const { t, family } = useI18n()
  const store = useStore()
  const stats = useMemo(() => storeStats(store.state), [store.state])
  const known = useMemo(() => new Set(Object.values(store.state.areas).map((a) => a.product_id)), [store.state])
  /** A scope from what the model gave, ignoring a key that does not exist rather than showing nothing. */
  const scope = (product?: string, camera?: string): Scope => ({
    product: product && known.has(product) ? product : undefined,
    camera: camera && store.state.images[camera] ? camera : undefined,
  })
  const nameOf = (s: Scope) =>
    [s.product ? family(s.product) : '', s.camera ? store.gondolaFull(s.camera) : ''].filter(Boolean).join(' · ') || t.wholeStore
  return { t, family, ...store, stats, scope, nameOf }
}

const gondolaTo = (camera: string) => `/gondolas/${camera}`
const scopeTo = (s: { product?: string; camera?: string }) => (s.camera ? gondolaTo(s.camera) : s.product ? productTo(s.product) : undefined)
const productTo = (product: string) => `/products?product=${encodeURIComponent(product)}`

/** A titled block. With `to`, the title leads to the page that holds what the block is about. */
const Block = ({ title, to, children }: { title?: string; to?: string; children: React.ReactNode }) => (
  <div>
    {title &&
      (to ? (
        <Link to={to} className="mb-2 inline-block px-1 text-label text-fg-muted transition-colors hover:text-fg">
          {title}
        </Link>
      ) : (
        <p className="mb-2 px-1 text-label text-fg-muted">{title}</p>
      ))}
    {children}
  </div>
)

const Text = defineComponent({
  name: 'Text',
  description: 'One or two plain sentences to introduce or read a part. Never write a digit or a percentage in it: figures come from the other parts.',
  props: z.object({ text: z.string() }),
  component: ({ props }) => <p className="text-ui text-fg-secondary">{props.text}</p>,
})

const Callout = defineComponent({
  name: 'Callout',
  description: 'A short note that stands apart: a caveat, or the one thing to take from the answer. No digits.',
  props: z.object({ text: z.string() }),
  component: ({ props }) => (
    <div className="flex items-start gap-2.5 rounded-lg bg-surface px-3 py-2.5 text-ui text-fg-secondary">
      <Info className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden />
      {props.text}
    </div>
  ),
})

const Metrics = defineComponent({
  name: 'Metrics',
  description:
    'A row of headline figures about the whole store. "empty": share of shelf time areas were empty. "compliance": share of time the right product was in place. "restock": how many products need restocking now. "moveBack": how many are in the wrong place now.',
  props: z.object({ items: z.array(z.enum(['empty', 'compliance', 'restock', 'moveBack'])) }),
  component: function Metrics({ props }) {
    const { t, stats, tasks } = useData()
    const cards = {
      restock: cardsOf(tasks.filter((x) => x.group === 'restock')).length,
      moveBack: cardsOf(tasks.filter((x) => x.group === 'moveBack')).length,
    }
    const value = {
      empty: `~${Math.round(stats.emptyShare * 100)}%`,
      compliance: `${Math.round(stats.compliance * 100)}%`,
      restock: String(cards.restock),
      moveBack: String(cards.moveBack),
    }
    return (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        {props.items.map((m) => (
          <li key={m}>
            <Link to={m === 'restock' || m === 'moveBack' ? '/' : '/insights'} className="block rounded-xl bg-surface px-4 py-3 transition-colors hover:bg-sunk">
              <p className="text-title tabular-nums">{value[m]}</p>
              <p className="mt-0.5 text-meta text-fg-muted">{t.metrics[m]}</p>
            </Link>
          </li>
        ))}
      </ul>
    )
  },
})

const Ranked = defineComponent({
  name: 'Ranked',
  description: 'A ranking by how long things were empty, worst first, as bars with a percentage: "products" or "gondolas".',
  props: z.object({ by: z.enum(['products', 'gondolas']), top: z.number().int().min(1).max(10).optional() }),
  component: function Ranked({ props }) {
    const { t, family, gondolaFull: gondola, stats } = useData()
    const top = props.top ?? 5
    const items =
      props.by === 'products'
        ? stats.map.slice(0, top).map((r) => ({ key: r.product, label: family(r.product), share: r.share, to: productTo(r.product) }))
        : stats.byGondola.slice(0, top).map((g) => ({ key: g.camera, label: gondola(g.camera), share: g.share, to: gondolaTo(g.camera) }))
    return (
      <Block title={props.by === 'products' ? t.worstProducts : t.worstGondolas}>
        <RankedBars items={items} />
      </Block>
    )
  },
})

const Bars = defineComponent({
  name: 'Bars',
  description:
    'Columns comparing how much time several things were empty, on one scale. Give "ids" (product keys or camera ids) to compare those, or leave them out for the worst ones.',
  props: z.object({
    by: z.enum(['products', 'gondolas']),
    ids: z.array(z.string()).optional(),
    top: z.number().int().min(2).max(8).optional(),
  }),
  component: function Bars({ props }) {
    const { t, family, gondola, state } = useData()
    const all = rows(state, props.by)
    const picked = props.ids?.length ? all.filter((r) => props.ids!.includes(r.key)) : []
    const shown = (picked.length >= 2 ? picked : all).slice(0, props.top ?? 6)
    return (
      <Block title={t.colEmpty}>
        <VBars items={shown.map((r) => ({ key: r.key, label: props.by === 'products' ? family(r.key) : gondola(r.key), value: r.empty, to: props.by === 'products' ? productTo(r.key) : gondolaTo(r.key) }))} />
      </Block>
    )
  },
})

const Table = defineComponent({
  name: 'Table',
  description:
    'A table of products or gondolas with how long each was empty, half full and holding the wrong product, worst first. Use it when several figures per item are asked for.',
  props: z.object({ by: z.enum(['products', 'gondolas']), top: z.number().int().min(2).max(12).optional() }),
  component: function Table({ props }) {
    const { t, family, gondolaFull: gondola, state } = useData()
    const pct = (v: number) => `${Math.round(v * 100)}%`
    const data = rows(state, props.by)
      .slice(0, props.top ?? 6)
      .map((r) => ({
        name: (
          <Link to={props.by === 'products' ? productTo(r.key) : gondolaTo(r.key)} className="transition-colors hover:underline">
            {props.by === 'products' ? family(r.key) : gondola(r.key)}
          </Link>
        ),
        empty: pct(r.empty),
        half: pct(r.half),
        wrong: pct(r.wrong),
      }))
    return (
      <DataTable
        columns={[
          { key: 'name', label: t.colName },
          { key: 'empty', label: t.colEmpty, numeric: true },
          { key: 'half', label: t.colHalf, numeric: true },
          { key: 'wrong', label: t.colWrong, numeric: true },
        ]}
        rows={data}
      />
    )
  },
})

const Trend = defineComponent({
  name: 'Trend',
  description:
    'A line over the hours of the day: how much of the store, one product or one gondola was empty at each hour. Give a product key and/or a camera id, or neither for the whole store.',
  props: z.object({ product: z.string().optional(), camera: z.string().optional() }),
  component: function Trend({ props }) {
    const { t, state, scope, nameOf } = useData()
    const s = scope(props.product, props.camera)
    const data = useMemo(() => trend(state, s), [state, s.product, s.camera]) // oxlint-disable-line
    return (
      <Block title={t.trendTitle(nameOf(s))} to={scopeTo(s)}>
        <TrendChart hours={data.hours} values={data.values} label={t.trendTitle(nameOf(s))} />
      </Block>
    )
  },
})

const Mix = defineComponent({
  name: 'Mix',
  description:
    'One bar showing how the time split between empty, half full and full, and how much held the wrong product. Give a product key and/or a camera id, or neither for the whole store.',
  props: z.object({ product: z.string().optional(), camera: z.string().optional() }),
  component: function Mix({ props }) {
    const { t, state, scope, nameOf } = useData()
    const s = scope(props.product, props.camera)
    const b = useMemo(() => breakdown(state, s), [state, s.product, s.camera]) // oxlint-disable-line
    return (
      <Block title={t.mixTitle(nameOf(s))} to={scopeTo(s)}>
        <StackBar
          parts={[
            { key: 'empty', label: t.level.empty, share: b.empty, color: 'var(--danger)' },
            { key: 'half', label: t.level.half, share: b.half, color: 'color-mix(in oklab, var(--fg) 35%, transparent)' },
            { key: 'full', label: t.level.full, share: b.full, color: 'var(--sunk)' },
          ]}
        />
        <p className="mt-2 px-1 text-meta text-fg-muted">
          {t.wrongProduct}: <span className="tabular-nums text-fg-secondary">{Math.round(b.wrong * 100)}%</span>
        </p>
      </Block>
    )
  },
})

const Heat = defineComponent({
  name: 'DayMap',
  description:
    'Products as rows and hours as columns, shaded by how much of the product was empty. Give product keys to show only those, or leave them out for the worst ones.',
  props: z.object({ products: z.array(z.string()).optional() }),
  component: function Heat({ props }) {
    const { stats } = useData()
    const picked = stats.map.filter((r) => props.products?.includes(r.product))
    return <DayMap rows={picked.length ? picked : stats.map} hours={stats.hours} limit={picked.length || 8} linkTo={productTo} />
  },
})

const Tasks = defineComponent({
  name: 'Tasks',
  description: 'What to do now, as rows with the product, where it is and since when: "restock" (empty) or "moveBack" (wrong product in its place).',
  props: z.object({ group: z.enum(['restock', 'moveBack']), top: z.number().int().min(1).max(8).optional() }),
  component: function Tasks({ props }) {
    const { t, family, tasks, where } = useData()
    const cards = cardsOf(tasks.filter((x) => x.group === props.group)).slice(0, props.top ?? 4)
    const Icon = GROUP_ICON[props.group]
    return (
      <Block title={t[props.group]}>
        <ul className="flex flex-col gap-2">
          {cards.map((c) => {
            const first = c.tasks[0]
            const place = c.tasks.length > 1 ? t.areasCount(c.tasks.length) : where(first.area, first.obs.observed_family)
            return (
              <li key={c.key}>
                <Link
                  to={`${gondolaTo(first.area.camera)}?area=${first.area.area_id}`}
                  style={{ '--c': GROUP_COLOR[props.group] } as React.CSSProperties}
                  className="flex items-center gap-3 rounded-lg bg-[color-mix(in_oklab,var(--c)_13%,transparent)] p-2 pr-3 transition-colors hover:bg-[color-mix(in_oklab,var(--c)_19%,transparent)]"
                >
                  <AreaCrop area={first.area} image={first.record.image} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-label">{family(first.area.family)}</span>
                    <span className="block truncate text-meta text-fg-secondary">{place}</span>
                  </span>
                  <span className="text-meta tabular-nums text-fg-secondary">{clock(first.since ?? first.record.ts)}</span>
                  <Icon className="size-4 text-[var(--c)]" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      </Block>
    )
  },
})

const Walk = defineComponent({
  name: 'Walk',
  description:
    'The round to walk now: the first gondolas to go to, in order, each with what to carry, and a button that starts the round on the phone. Use it when asked what to restock first, where to start or what to do now.',
  props: z.object({ stops: z.number().int().min(1).max(5).optional() }),
  component: function Walk({ props }) {
    const { t, tasks, gondola } = useData()
    const stops = suggest(tasks)
      .filter((s) => s.empty + s.wrong > 0)
      .slice(0, props.stops ?? 3)
    if (!stops.length) return null
    return (
      <Block title={t.roundStart}>
        <ul className="flex flex-col gap-2">
          {stops.map((s, i) => (
            <li key={s.camera}>
              <Link to={gondolaTo(s.camera)} className="flex items-center gap-3 rounded-lg bg-surface p-3 transition-colors hover:bg-sunk">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sunk text-meta tabular-nums text-fg-secondary">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="mb-1.5 block text-label">{gondola(s.camera)}</span>
                  <Chips tasks={tasks.filter((x) => x.area.camera === s.camera)} />
                </span>
                {s.emptySince !== null && <span className="text-meta tabular-nums text-fg-secondary">{clock(s.emptySince)}</span>}
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/round" className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-surface text-ui font-medium transition-colors hover:bg-sunk">
          <Footprints className="size-4" aria-hidden />
          {t.roundStart}
        </Link>
      </Block>
    )
  },
})

const Where = defineComponent({
  name: 'Where',
  description: 'The gondolas that hold a product, with their photos, the one where it was empty the longest first. Give the product key.',
  props: z.object({ product: z.string() }),
  component: function Where({ props }) {
    const { state, scope, nameOf, t } = useData()
    const s = scope(props.product)
    const cameras = useMemo(() => {
      if (!s.product) return []
      const own = [...new Set(Object.values(state.areas).filter((a) => a.product_id === s.product).map((a) => a.camera))]
      return own.sort((a, b) => breakdown(state, { product: s.product, camera: b }).empty - breakdown(state, { product: s.product, camera: a }).empty).slice(0, 4)
    }, [state, s.product])
    if (!cameras.length) return null
    return (
      <Block title={`${nameOf(s)} · ${t.navGondolas}`} to={scopeTo(s)}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {cameras.map((c) => (
            <CameraTile key={c} camera={c} />
          ))}
        </div>
      </Block>
    )
  },
})

const Gondola = defineComponent({
  name: 'Gondola',
  description: 'The photo tile of one gondola, with what it needs. The camera is its id.',
  props: z.object({ camera: z.string() }),
  component: ({ props }) => (
    <div className="max-w-xs">
      <CameraTile camera={props.camera} />
    </div>
  ),
})

const parts = [Text.ref, Callout.ref, Metrics.ref, Ranked.ref, Bars.ref, Table.ref, Trend.ref, Mix.ref, Heat.ref, Tasks.ref, Walk.ref, Where.ref, Gondola.ref] as const

const Answer = defineComponent({
  name: 'Answer',
  description: 'The whole answer: its parts in the order they are read.',
  props: z.object({ parts: z.array(z.union(parts)) }),
  component: ({ props, renderNode }) => (
    <div className="flex flex-col gap-5">
      {props.parts.map((p, i) => (
        <div key={i}>{renderNode(p)}</div>
      ))}
    </div>
  ),
})

export const library = createLibrary({
  components: [Answer, Text, Callout, Metrics, Ranked, Bars, Table, Trend, Mix, Heat, Tasks, Walk, Where, Gondola],
  root: 'Answer',
})

const EXAMPLES = [
  `User: How is the store doing?
root = Answer([Text("Here is how the store did, and when it was worst."), Metrics(["empty", "compliance", "restock", "moveBack"]), Trend()])`,
  `User: Which gondolas need attention?
root = Answer([Text("These gondolas spent the most time with empty shelves."), Ranked("gondolas", 5), Tasks("restock", 3)])`,
  `User: How are the bananas doing through the day?
root = Answer([Text("Bananas hour by hour, and how their time split."), Trend("banana"), Mix("banana")])`,
  `User: What should I restock first?
root = Answer([Text("This is the order to walk, starting where it hurts most."), Walk(3), Callout("These come from about one photo an hour, so treat them as estimates.")])`,
  `User: Give me the report of the day.
root = Answer([Text("Here is how the day went, when it was worst and what to watch tomorrow."), Metrics(["empty", "compliance", "restock", "moveBack"]), Trend(), Ranked("products", 4), Callout("Estimated from about one photo an hour. Start tomorrow with the products that ran out first.")])`,
  `User: Compare avocado and onion.
root = Answer([Text("Side by side, avocado and onion."), Bars("products", ["avocado", "onion"]), Table("products", 4)])`,
]

/** What the model is told. `context` names the products and gondolas it can refer to. */
export const systemPromptFor = (context: {
  products: { key: string; label: string }[]
  gondolas: { key: string; label: string }[]
  worstProducts: string[]
  worstGondolas: string[]
  /** For each product key, the camera ids of the gondolas that hold it. */
  placements: Record<string, string[]>
}) =>
  library.prompt({
    preamble: [
      "You answer a supermarket manager's questions about the fruit and vegetable shelves, watched by ceiling cameras that took a photo of each gondola about once an hour through one day.",
      'You answer only by choosing and arranging the parts below, written as OpenUI Lang. The app works out every number inside the parts, so you never write one.',
    ].join(' '),
    additionalRules: [
      'Answer in the language of the question. Do not mention OpenUI, parts or the app: write as a colleague who has looked at the data.',
      'Write no digit and no percentage anywhere, not even in Text or Callout. Say "the worst", "most of the day", "early", never a figure.',
      'Pick the part that fits the question: Metrics for a summary, Trend for how something changed over the day, Mix for how time split, Ranked or Bars for comparing, Table when several figures per item are needed, DayMap for the whole day by product, Tasks for a plain list of what is empty or in the wrong place, Walk (not Tasks) when the question is what to restock or do first, where to start or in what order to walk, Where for the gondolas that hold a product, Gondola to show one shelf.',
      'Whenever an answer shows figures, charts or a ranking, end it with a Callout saying in the language of the question that it is estimated from about one photo an hour. Never write the figures themselves.',
      'Use 2 to 4 parts. Start with one Text sentence and, if it helps, end with a Callout that gives the one thing to act on.',
      'Refer to products by their key and gondolas by their camera id, exactly as listed. If the question names something not listed, answer with a Text and a Callout saying you do not have it, and offer what you do have.',
      'If the question is not about the store, say so in one Text and suggest a question you can answer.',
      `Product keys, as key (name): ${context.products.map((p) => `${p.key} (${p.label})`).join(', ')}.`,
      `Gondola camera ids, as id (what is on it): ${context.gondolas.map((g) => `${g.key} (${g.label})`).join(', ')}.`,
      `Where each product is, as key: camera ids: ${Object.entries(context.placements).map(([k, c]) => `${k}: ${c.join(' ')}`).join('; ')}.`,
      'Every product in the key list is in the data and sits in at least one gondola: never say one is missing unless it is not in the list.',
      `Products empty the longest, worst first: ${context.worstProducts.join(', ')}. Gondolas empty the longest, worst first: ${context.worstGondolas.join(', ')}.`,
    ],
    examples: EXAMPLES,
  })

