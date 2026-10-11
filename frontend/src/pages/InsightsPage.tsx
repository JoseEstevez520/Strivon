import { useMemo } from 'react'
import { ChatBubble } from '@/components/chat/ChatBubble'
import { DayMap } from '@/components/day/DayMap'
import { RankedBars } from '@/components/day/RankedBars'
import { useI18n } from '@/lib/i18n'
import { storeStats } from '@/lib/stats'
import { useStore } from '@/lib/store'
import { clock } from '@/lib/time'

/** Hours as "4.5 h"; under half an hour it says so in minutes, since "0.3 h" reads badly. */
const hoursOf = (h: number) => (h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : `${h.toFixed(1)} h`)
/** The clock hour a column starts at, as "06:00". */
const hourOf = (start: number) => clock(start + 1800).slice(0, 2) + ':00'

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="flex h-9 items-center px-1 text-label text-fg-muted">{children}</h2>
)

/** How the store is doing, for whoever runs it: one number, when it happened and where it hurts. */
export function InsightsPage() {
  const { t, lang, family } = useI18n()
  const { state, gondolaFull: gondola, simulated } = useStore()
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
        <div>
          <h1 className="text-display tabular-nums">
            {t.insightsHeadline(Math.round(stats.emptyShare * 100))}
          </h1>
          <p className="mt-1 text-meta text-fg-muted">{t.insightsAbout}</p>
          {stats.peak && (
            <p className="mt-2 px-0.5 text-ui text-fg-secondary tabular-nums">
              {t.insightsPeak(hourOf(stats.peak.hour), Math.round(stats.peak.share * 100))}
            </p>
          )}
        </div>
        <p className="text-meta tabular-nums text-fg-muted">{period}</p>
      </div>

      <section className="mb-10">
        <Heading>{t.mapTitle}</Heading>
        <DayMap rows={stats.map} hours={stats.hours} />
      </section>

      <div className="mb-10 grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-8 lg:grid-cols-2">
        <section>
          <Heading>{t.worstProducts}</Heading>
          <RankedBars
            items={stats.map.slice(0, 5).map((r) => ({
              key: r.product,
              label: family(r.product),
              share: r.share,
              detail: hoursOf(r.emptyHours),
              note: r.worst.length ? t.worstAt(r.worst.map((h) => hourOf(h)).join(', ')) : undefined,
            }))}
          />
        </section>
        <section>
          <Heading>{t.worstGondolas}</Heading>
          <RankedBars
            items={stats.byGondola.slice(0, 5).map((g) => ({
              key: g.camera,
              label: gondola(g.camera),
              share: g.share,
              detail: hoursOf(g.emptyHours),
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
