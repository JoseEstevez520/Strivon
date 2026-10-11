import { useMemo } from 'react'
import { ChatBubble } from '@/components/chat/ChatBubble'
import { DayMap } from '@/components/day/DayMap'
import { RankedBars } from '@/components/day/RankedBars'
import { useI18n } from '@/lib/i18n'
import { storeStats } from '@/lib/stats'
import { useStore } from '@/lib/store'
import { clock } from '@/lib/time'

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="flex h-9 items-center px-1 text-label text-fg-muted">{children}</h2>
)

/** How the store is doing, for whoever runs it: one number, when it happened and where it hurts. */
export function InsightsPage() {
  const { t, lang, family } = useI18n()
  const { state, gondola: gondolaName, gondolaFull: gondola, simulated } = useStore()
  const stats = useMemo(() => storeStats(state), [state])

  // What the photos cover is written from the data, so the page never claims a period it does not have.
  const { from, to } = stats.period
  const date = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Lisbon' }).format(
    new Date(from * 1000),
  )
  const period = [t.insightsPeriod(date, clock(from), clock(to)), simulated ? t.insightsSimulatedShort : ''].filter(Boolean).join(' · ')

  return (
    <>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        {/* The "~" says it is an estimate, and the detail is on hover, so the page carries no standing disclaimer. */}
        <h1 className="text-display tabular-nums" title={t.insightsEstimate}>
          {t.insightsHeadline(Math.round(stats.emptyShare * 100))}
        </h1>
        <p className="text-meta tabular-nums text-fg-muted">{period}</p>
      </div>

      <section className="mb-10">
        <Heading>{t.gondolaMapTitle}</Heading>
        <DayMap
          rows={stats.gondolaMap}
          hours={stats.hours}
          limit={stats.gondolaMap.length}
          label={gondolaName}
          title={t.gondolaMapTitle}
          linkTo={(camera) => `/gondolas/${camera}`}
        />
      </section>

      <div className="mb-10 grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-8 lg:grid-cols-2">
        <section>
          <Heading>{t.worstProducts}</Heading>
          <RankedBars
            items={stats.map.slice(0, 5).map((r) => ({ key: r.product, label: family(r.product), share: r.share }))}
          />
        </section>
        <section>
          <Heading>{t.worstGondolas}</Heading>
          <RankedBars
            items={stats.byGondola.slice(0, 5).map((g) => ({
              key: g.camera,
              label: gondola(g.camera),
              share: g.share,
              to: `/gondolas/${g.camera}`,
            }))}
          />
        </section>
      </div>

      <p className="mb-12 px-1 text-ui text-fg-secondary tabular-nums">{t.complianceLine(Math.round(stats.compliance * 100))}</p>

      <ChatBubble />
    </>
  )
}
