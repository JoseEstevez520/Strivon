import { useMemo } from 'react'
import { Chat } from '@/components/chat/Chat'
import { DayMap } from '@/components/day/DayMap'
import { RankedBars } from '@/components/day/RankedBars'
import { StatLine } from '@/components/day/StatLine'
import { useI18n } from '@/lib/i18n'
import { dayStats } from '@/lib/stats'
import { useStore } from '@/lib/store'

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="flex h-9 items-center px-1 text-label text-fg-muted">{children}</h2>
)

/** How the day went, for whoever runs the store: one number, when it happened and where it hurt. */
export function DayPage() {
  const { t, family } = useI18n()
  const { state, gondola, simulated } = useStore()
  const stats = useMemo(() => dayStats(state), [state])

  const note = simulated ? `${t.dayEstimate} ${t.daySimulated}` : t.dayEstimate

  return (
    <>
      <div className="mb-10">
        <StatLine note={note}>{t.dayHeadline(Math.round(stats.emptyShare * 100))}</StatLine>
      </div>

      <section className="mb-10">
        <Heading>{t.mapTitle}</Heading>
        <DayMap rows={stats.map} hours={stats.hours} />
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

      <div className="max-w-2xl">
        <Chat />
      </div>
    </>
  )
}
