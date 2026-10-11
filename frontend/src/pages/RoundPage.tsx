import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AreaCrop } from '@/components/AreaCrop'
import { ProductIcon } from '@/components/ProductIcon'
import { useI18n } from '@/lib/i18n'
import { buildRound, type Carry, type Move } from '@/lib/round'
import { useStore } from '@/lib/store'
import { clock } from '@/lib/time'

const KEY = 'strivon.round.step'

/** Keeps the screen on while the round is open, since the phone is in a hand and not touched for a while. */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const ask = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null
      } catch {
        /* the screen may dim; nothing else breaks */
      }
    }
    void ask()
    const back = () => document.visibilityState === 'visible' && void ask()
    document.addEventListener('visibilitychange', back)
    return () => {
      document.removeEventListener('visibilitychange', back)
      void lock?.release()
    }
  }, [])
}

/** One thing to carry: a crop of the spot it is for (or its icon), its name and a line under it. */
function Row({ lead, name, line, count }: { lead: ReactNode; name: string; line: string; count?: number }) {
  return (
    <li className="flex items-center gap-4 rounded-2xl bg-surface p-3">
      <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-sunk text-fg-secondary">{lead}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-copy font-medium">{name}</span>
        <span className="block text-ui text-fg-secondary">{line}</span>
      </span>
      {count !== undefined && <span className="text-title tabular-nums">×{count}</span>}
    </li>
  )
}

/**
 * The round for the phone: one step per screen, with big type and the buttons at the bottom where
 * the thumb is. Step 0 is what to load, then one gondola per step, then the end. The step only
 * moves the view; nothing is marked as done, because the next hourly photo clears what was fixed.
 */
export function RoundPage() {
  const { t, family } = useI18n()
  const { tasks, gondola } = useStore()
  const round = useMemo(() => buildRound(tasks), [tasks])
  const total = round.stops.length
  const last = total + 1
  const [step, setStep] = useState(() => {
    try {
      return Math.max(0, Number(localStorage.getItem(KEY)) || 0)
    } catch {
      return 0
    }
  })
  const at = Math.min(step, last)
  const body = useRef<HTMLDivElement>(null)
  useWakeLock()

  const go = (n: number) => {
    const next = Math.max(0, Math.min(last, n))
    setStep(next)
    try {
      localStorage.setItem(KEY, String(next))
    } catch {
      /* the place is just not remembered */
    }
    body.current?.scrollTo({ top: 0 })
  }
  const where = (cameras: string[]) =>
    cameras.length === 1 ? gondola(cameras[0]) : `${t.navGondolas} ${cameras.map((c) => gondola(c).match(/\d+$/)?.[0] ?? c).join(' · ')}`

  const carry = (c: Carry) => (
    <Row
      key={`${c.family}${c.from ?? ''}`}
      lead={<AreaCrop area={c.task.area} image={c.task.record.image} size={64} />}
      name={family(c.family)}
      line={c.from ? t.fromGondola(gondola(c.from)) : t.areasCount(c.n)}
      count={c.n}
    />
  )
  const move = (m: Move) => (
    <Row
      key={`${m.family}${m.task.area.area_id}`}
      lead={<AreaCrop area={m.task.area} image={m.task.record.image} size={64} />}
      name={m.unknown ? t.wrongProduct : family(m.family)}
      line={m.unknown ? t.inPlaceOf(family(m.family)) : m.to ? t.takeTo(gondola(m.to)) : t.takeBack}
    />
  )

  let content: ReactNode
  let label = ''
  if (at === 0) {
    label = t.roundLoad
    content = (
      <>
        <h1 className="text-display">{t.roundLoad}</h1>
        <p className="mt-1 mb-4 text-copy text-fg-secondary">{t.roundLoadNote}</p>
        {round.load.length === 0 ? (
          <p className="text-copy text-fg-secondary">{t.plan.nothingToDo}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {round.load.map((l) => (
              <Row key={l.family} lead={<ProductIcon family={l.family} label={family(l.family)} className="size-10" />} name={family(l.family)} line={where(l.cameras)} count={l.n} />
            ))}
          </ul>
        )}
      </>
    )
  } else if (at <= total) {
    const s = round.stops[at - 1]
    label = t.roundStop(at, total)
    content = (
      <>
        <h1 className="text-display">{gondola(s.camera)}</h1>
        {s.since !== null && <p className="mt-1 text-ui tabular-nums text-fg-secondary">{t.emptySince(clock(s.since))}</p>}
        {s.leave.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 px-1 text-label text-fg-muted">{t.leaveHere}</h2>
            <ul className="flex flex-col gap-2">{s.leave.map(carry)}</ul>
          </section>
        )}
        {s.pick.length > 0 && (
          <section className="mt-5">
            <h2 className="mb-2 px-1 text-label text-fg-muted">{t.pickUp}</h2>
            <ul className="flex flex-col gap-2">{s.pick.map(move)}</ul>
          </section>
        )}
      </>
    )
  } else {
    content = (
      <div className="grid h-full place-items-center text-center">
        <div>
          <Check className="mx-auto mb-4 size-12" style={{ color: 'var(--success)' }} strokeWidth={3} aria-hidden />
          <h1 className="text-display">{t.roundDone}</h1>
          <p className="mt-2 text-copy text-fg-secondary">{t.roundDoneNote}</p>
          <Link to="/" className="mt-6 inline-flex h-12 items-center rounded-xl bg-surface px-6 text-ui transition-colors hover:bg-raised">
            {t.navTasks}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-bg">
      <header className="px-4 pt-3 pb-2">
        <div className="flex h-10 items-center justify-between">
          <Link to="/" className="-ml-2 flex h-10 items-center gap-1 rounded-lg px-2 text-ui text-fg-secondary transition-colors hover:bg-surface">
            <ChevronLeft className="size-4" aria-hidden />
            {t.navTasks}
          </Link>
          <span className="text-ui tabular-nums text-fg-secondary">{label}</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-sunk" aria-hidden>
          <div className="h-full rounded-full bg-fg-muted transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${(at / last) * 100}%` }} />
        </div>
      </header>
      <div ref={body} className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {content}
      </div>
      <footer className="grid grid-cols-[1fr_2fr] gap-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => go(at - 1)}
          disabled={at === 0}
          className="flex h-14 cursor-pointer items-center justify-center gap-1 rounded-2xl text-ui text-fg-secondary transition-colors hover:bg-surface disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="size-5" aria-hidden />
          {t.previous}
        </button>
        <button
          type="button"
          onClick={() => go(at + 1)}
          disabled={at === last}
          className="flex h-14 cursor-pointer items-center justify-center gap-1 rounded-2xl bg-surface text-copy font-medium transition-colors hover:bg-raised disabled:pointer-events-none disabled:opacity-40"
        >
          {t.next}
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </footer>
    </div>
  )
}
