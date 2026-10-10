import { createLibrary, defineComponent } from '@openuidev/react-lang'
import { useMemo } from 'react'
import { z } from 'zod'
import { CameraTile } from '@/components/CameraTile'
import { DayMap } from '@/components/day/DayMap'
import { RankedBars } from '@/components/day/RankedBars'
import { StatLine } from '@/components/day/StatLine'
import { useI18n } from '@/lib/i18n'
import { storeStats } from '@/lib/stats'
import { useStore } from '@/lib/store'

/** The figures of the store, worked out here by code. The parts below only say which one to show. */
function useStats() {
  const { state } = useStore()
  return useMemo(() => storeStats(state), [state])
}

const Text = defineComponent({
  name: 'Text',
  description: 'One plain sentence. Use it for words, never for figures: figures come from the other parts.',
  props: z.object({ text: z.string() }),
  component: ({ props }) => <p className="text-ui text-fg-secondary">{props.text}</p>,
})

const Stat = defineComponent({
  name: 'Stat',
  description:
    'A headline figure about the whole store, worked out by the app: "empty" is the share of shelf time areas were empty, "compliance" the share of time areas held the right product.',
  props: z.object({ metric: z.enum(['empty', 'compliance']) }),
  component: function Stat({ props }) {
    const { t } = useI18n()
    const stats = useStats()
    return props.metric === 'empty' ? (
      <StatLine note={t.insightsEstimate}>{t.insightsHeadline(Math.round(stats.emptyShare * 100))}</StatLine>
    ) : (
      <StatLine>{t.complianceLine(Math.round(stats.compliance * 100))}</StatLine>
    )
  },
})

const Ranked = defineComponent({
  name: 'Ranked',
  description: 'A ranking of what was empty the longest, worst first: either "products" or "gondolas". The app fills in the values.',
  props: z.object({ by: z.enum(['products', 'gondolas']), top: z.number().int().min(1).max(10).optional() }),
  component: function Ranked({ props }) {
    const { family, t } = useI18n()
    const { gondola } = useStore()
    const stats = useStats()
    const top = props.top ?? 5
    const items =
      props.by === 'products'
        ? stats.map.slice(0, top).map((r) => ({ key: r.product, label: family(r.product), share: r.share }))
        : stats.byGondola.slice(0, top).map((g) => ({ key: g.camera, label: gondola(g.camera), share: g.share, to: `/gondolas/${g.camera}` }))
    return (
      <div>
        <p className="mb-1 px-1 text-label text-fg-muted">{props.by === 'products' ? t.worstProducts : t.worstGondolas}</p>
        <RankedBars items={items} />
      </div>
    )
  },
})

const Heat = defineComponent({
  name: 'DayMap',
  description:
    'Products as rows and hours as columns, shaded by how much of the product was empty. Give product keys to show only those, or leave them out for the worst ones.',
  props: z.object({ products: z.array(z.string()).optional() }),
  component: function Heat({ props }) {
    const stats = useStats()
    const rows = props.products?.length ? stats.map.filter((r) => props.products!.includes(r.product)) : stats.map
    return <DayMap rows={rows} hours={stats.hours} limit={props.products?.length ? rows.length : 10} />
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

const parts = [Text.ref, Stat.ref, Ranked.ref, Heat.ref, Gondola.ref] as const

const Answer = defineComponent({
  name: 'Answer',
  description: 'The whole answer: its parts in the order they are read.',
  props: z.object({ parts: z.array(z.union(parts)) }),
  component: ({ props, renderNode }) => <div className="flex flex-col gap-4">{props.parts.map((p, i) => <div key={i}>{renderNode(p)}</div>)}</div>,
})

export const library = createLibrary({ components: [Answer, Text, Stat, Ranked, Heat, Gondola], root: 'Answer' })

/** What the model is told. The figures never come from it: every part computes its own. */
export const systemPrompt = library.prompt({
  preamble:
    'You answer a store manager\'s questions about how the store is doing, using only the parts below. Never write a figure yourself: choose the part that shows it.',
  additionalRules: ['Answer in the language of the question.', 'Keep it short: one to three parts.'],
})
