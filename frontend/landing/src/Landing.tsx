import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Apple,
  Camera,
  ChartNoAxesColumn,
  ClipboardCheck,
  Languages,
  LayoutGrid,
  ListChecks,
  Maximize2,
  X,
  Play,
  ScanSearch,
  type LucideIcon,
} from 'lucide-react'
import { LANGS, useI18n, type Lang } from '@/lib/i18n'
import { landingText, type LandingStrings } from './landingText'

const STEP_ICONS: LucideIcon[] = [Camera, ScanSearch, ClipboardCheck]
const TODAY_ICONS: LucideIcon[] = [ListChecks, LayoutGrid, Apple, Play, ChartNoAxesColumn, Languages]

/** The strings of the language in use. */
const useText = (): LandingStrings => landingText[useI18n().lang]

const REPO = 'https://github.com/JoseEstevez520/Strivon'
/** The full app, with the chat, for whoever wants to try it. */
const APP_URL = 'https://strivon-app.vercel.app'

/** The GitHub mark, from Simple Icons (CC0). */
const GithubMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
)

/** True on a phone-sized screen. */
function useNarrow() {
  const query = '(max-width: 767px)'
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const update = () => setNarrow(m.matches)
    update()
    m.addEventListener('change', update)
    return () => m.removeEventListener('change', update)
  }, [])
  return narrow
}

type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }

/**
 * The chat clip, small beside its text, with a button that opens it large. On a phone the clip is too small to
 * read where it sits, so a tap takes it full screen, and sideways where the browser allows it, which gives it
 * the whole width of the phone. Elsewhere it opens in a dialog.
 */
function ChatClip() {
  const text = useText()
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const narrow = useNarrow()
  // The large video exists only while the dialog is open, so a closed dialog does not download it.
  const [open, setOpen] = useState(false)
  const enlarge = () => {
    const v = video.current as FullscreenVideo | null
    if (narrow && v) {
      // Back out of full screen the clip stops and goes back to its picture, so the page is not left with a video playing.
      const stop = () => {
        if (document.fullscreenElement) return
        v.pause()
        v.currentTime = 0
        document.removeEventListener('fullscreenchange', stop)
        v.removeEventListener('webkitendfullscreen', stop)
      }
      document.addEventListener('fullscreenchange', stop)
      v.addEventListener('webkitendfullscreen', stop)
      v.play().catch(() => {})
      const done = v.requestFullscreen ? v.requestFullscreen() : v.webkitEnterFullscreen?.()
      Promise.resolve(done)
        .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'))
        .catch(() => {})
      return
    }
    setOpen(true)
    dialog.current?.showModal()
  }
  return (
    <>
      <div className="relative">
        <WhenNear height="16rem">
          <video
                onClick={narrow ? enlarge : undefined}
            className={`w-full rounded-2xl bg-bg ${narrow ? 'cursor-pointer' : ''}`}
            src="./video/chat-walk.mp4"
            poster="./video/chat-walk-poster.jpg"
            autoPlay={!narrow}
            loop
            muted
            playsInline
            preload={narrow ? 'none' : 'metadata'}
            aria-label={text.clipLabel}
          />
        </WhenNear>
        <button
          type="button"
          onClick={enlarge}
          aria-label={text.enlarge}
          className="absolute top-2 right-2 grid size-11 cursor-pointer place-items-center rounded-full bg-surface/90 text-fg-secondary transition-colors hover:bg-sunk hover:text-fg md:top-3 md:right-3 md:size-9"
        >
          <Maximize2 className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
        <p className="mt-2 text-center text-meta text-fg-muted md:hidden">{text.clipHint}</p>
      </div>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        onClose={() => setOpen(false)}
        className="m-auto w-[min(92vw,1400px)] rounded-2xl bg-bg p-2 text-fg backdrop:bg-black/60"
      >
        <div className="relative">
          {open && <video className="w-full rounded-xl bg-bg" src="./video/chat-walk.mp4" controls autoPlay loop muted playsInline aria-label={text.clipLabel} />}
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label={text.close}
            className="absolute top-2 right-2 grid size-11 cursor-pointer place-items-center rounded-full bg-surface/90 text-fg-secondary transition-colors hover:bg-sunk hover:text-fg md:top-3 md:right-3 md:size-9"
          >
            <X className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </dialog>
    </>
  )
}

const TEAM = ['Jose', 'Miguel', 'André', 'Leonor']

const Section = ({ title, lead, className = '', children }: { title: string; lead?: string; className?: string; children: React.ReactNode }) => (
  <section className={`py-10 sm:py-16 ${className}`}>
    <h2 className="text-display">{title}</h2>
    {lead && <p className="mt-3 text-copy text-fg-secondary">{lead}</p>}
    <div className="mt-6 sm:mt-8">{children}</div>
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
/** How far the slots run on below the first screen, fading out, in px. */
const SPILL = 208
/** How much further they run down at the left and right edges, so they trail down the corners. */
const SPILL_EDGE = 260

/** Measures how many whole slots fit in the element, and keeps it up to date. */
function useGrid(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ cols: 0, rows: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () =>
      setSize({
        cols: Math.max(1, Math.floor((el.clientWidth + CELL.gap) / (CELL.w + CELL.gap))),
        rows: Math.max(1, Math.floor((el.clientHeight + CELL.gap) / (CELL.h + CELL.gap))),
        height: el.clientHeight,
      })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}

function Slots() {
  const ref = useRef<HTMLDivElement>(null)
  const size = useGrid(ref)

  const cells = []
  for (let r = 0; r < size.rows; r++) {
    for (let c = 0; c < size.cols; c++) {
      // The first screen is the top part of the grid; the rest runs on below it.
      const total = size.height
      const screen = Math.max(1, total - SPILL - SPILL_EDGE)
      const y = ((r + 0.5) / size.rows) * total
      const dx = (c + 0.5) / size.cols - 0.5
      const dy = y / screen - 0.5
      // Nothing close to the text, then more and more of the slots as they get further from it, so
      // the scatter fades in instead of stopping at an edge. Below the first screen it fades out.
      const near = Math.max(0, Math.min(1, (Math.hypot(dx * 1.1, dy * 2) - 0.45) / 0.3))
      const edge = Math.min(1, Math.abs(dx) * 2)
      const run = SPILL + SPILL_EDGE * Math.pow(edge, 1.6)
      const below = y <= screen ? 1 : Math.max(0, 1 - (y - screen) / run)
      const fade = near * below
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
      className="pointer-events-none absolute inset-x-0 top-0 -bottom-[468px] grid gap-2"
      style={{ gridTemplateColumns: `repeat(${size.cols || 1}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${size.rows || 1}, minmax(0, 1fr))` }}
    >
      {cells}
    </div>
  )
}

/**
 * The same slots closing the page, behind the footer and taking no room of their own: none at the top
 * of the band, more and more toward the bottom, so the page ends the way it began.
 */
function SlotsBand() {
  const ref = useRef<HTMLDivElement>(null)
  const size = useGrid(ref)
  const cells = []
  for (let r = 0; r < size.rows; r++) {
    for (let c = 0; c < size.cols; c++) {
      const dy = (r + 0.5) / size.rows
      const dx = (c + 0.5) / size.cols - 0.5
      // Fewer toward the centre, where the logos and the line of text are, as the first screen keeps
      // the slots away from its text.
      const near = Math.max(0, Math.min(1, (Math.hypot(dx * 1.2, (dy - 0.72) * 1.5) - 0.2) / 0.3))
      // The band is tall so the slots can climb the sides, like they rise out of the corners.
      const edge = Math.min(1, Math.abs(dx) * 2)
      const rise = Math.max(0, Math.min(1, (dy - 0.35) / 0.65 + 0.75 * Math.pow(edge, 1.7)))
      const fade = Math.pow(rise, 1.6) * near
      const shown = hash(c, r) > 0.35
      cells.push(
        <span key={`${r}-${c}`} className="rounded-[7px]" style={{ background: shown ? slotFill(hash(r, c)) : 'transparent', opacity: 0.6 * fade }} />,
      )
    }
  }
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 grid h-[24rem] gap-2"
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
/** Three small buttons, EN PT ES, in the corner of the first screen. The choice is kept, and it wins over the browser. */
function LanguagePicker() {
  const { lang, setLang } = useI18n()
  const text = useText()
  const names: Record<Lang, string> = { en: 'English', pt: 'Português', es: 'Español' }
  return (
    <div role="group" aria-label={text.language} className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-10 flex gap-0.5 rounded-full bg-bg/85 p-1 backdrop-blur-sm md:top-5 md:right-5 md:gap-1 md:rounded-none md:bg-transparent md:p-0 md:backdrop-blur-none">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          title={names[l]}
          aria-label={names[l]}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className="h-11 min-w-11 cursor-pointer rounded-full px-3 text-label md:h-9 md:min-w-10 md:rounded-lg md:px-2.5 text-fg-secondary uppercase transition-colors hover:bg-surface aria-pressed:bg-surface aria-pressed:text-fg"
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function Hero() {
  const text = useText()
  return (
    <div className="relative mb-24 grid min-h-dvh place-items-center px-5 py-24 sm:mb-52 md:py-0">
      <Slots />
      <LanguagePicker />

      <div className="relative flex max-w-3xl flex-col items-center gap-6 text-center">
        <h1 className="text-[clamp(3.5rem,9vw,7rem)] leading-none font-semibold tracking-[-0.045em]">Strivon</h1>
        <p className="text-[clamp(1.125rem,1.8vw,1.5rem)] leading-relaxed text-fg-secondary">{text.hero}</p>
        <div className="mt-2 flex w-full max-w-md flex-col gap-4 md:hidden">
          <MobileActions />
        </div>
        <a href="./deck/" className="hidden h-12 items-center justify-center rounded-xl bg-surface px-5 text-label text-fg transition-colors hover:bg-raised md:inline-flex">
          {text.seeDeck}
        </a>
      </div>
    </div>
  )
}

/** The ad, 18 seconds with sound, as a section of its own on a phone. It loads only when played. */
function MobileFilm() {
  const text = useText()
  return (
    <div className="relative overflow-hidden rounded-2xl bg-surface shadow-[0_10px_30px_-14px_rgba(0,0,0,0.3)]">
      <video
        className="aspect-video w-full object-cover"
        src="./video/ad.mp4"
        poster="./video/ad-poster.jpg"
        controls
        playsInline
        preload="none"
        aria-label={text.filmLabel}
      />
    </div>
  )
}

/** The two things to do after reading the first lines: try the app, or open the presentation. */
function MobileActions() {
  const text = useText()
  return (
    <div className="flex w-full flex-col gap-3">
      <a href={APP_URL} target="_blank" rel="noreferrer" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-fg px-5 text-label text-bg transition-opacity active:opacity-85">
        {text.tryApp}
        <ArrowUpRight className="size-4" aria-hidden />
      </a>
      <a href="./deck/" className="inline-flex h-12 items-center justify-center rounded-xl bg-surface px-5 text-label text-fg transition-colors active:bg-sunk">
        {text.seeDeck}
      </a>
    </div>
  )
}

const QUICK_IMAGES = ['./img/what-the-model-sees.webp', './img/round-route.webp', './img/store-3d.webp']

/** For a phone: the numbers, then four pictures to swipe through, made from what the project already has. */
function MobileShowcase() {
  const text = useText()
  return (
    <section className="order-1 py-8 md:hidden">
      <h2 className="text-display">{text.filmTitle}</h2>
      <div className="mt-5"><MobileFilm /></div>
      <h2 className="mt-10 text-display">{text.quickTitle}</h2>
      <ul className="mt-5 grid grid-cols-3 gap-2 text-center">
        {text.stats.map((stat) => (
          <li key={stat.label} className="rounded-xl bg-surface px-2 py-3">
            <p className="text-title leading-none">{stat.value}</p>
            <p className="mt-2 text-meta text-fg-muted">{stat.label}</p>
          </li>
        ))}
      </ul>
      <div className="-mx-5 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {text.quick.map((item, i) => (
          <article key={item.title} className="w-[82%] shrink-0 snap-center rounded-2xl bg-surface p-3">
            <div className="aspect-[16/10] overflow-hidden rounded-xl bg-bg">
              {i < QUICK_IMAGES.length ? (
                <img src={QUICK_IMAGES[i]} alt="" loading="lazy" className="size-full object-contain" />
              ) : (
                <WhenNear height="10rem">
                  <video className="size-full object-cover" src="./video/phone-round.mp4" autoPlay loop muted playsInline preload="metadata" />
                </WhenNear>
              )}
            </div>
            <h3 className="mt-3 text-label text-fg">{item.title}</h3>
            <p className="mt-1 text-ui text-fg-secondary">{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

const Demo = lazy(() => import('./DemoWindow'))

/** Mounts its children only when they are about to be seen, so what is far down the page costs nothing until then. */
function WhenNear({ children, height }: { children: React.ReactNode; height: string }) {
  const ref = useRef<HTMLDivElement>(null)
  // Without IntersectionObserver there is no way to know, so it is shown at once.
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const seen = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { root: el.closest('.overflow-y-auto'), rootMargin: '600px 0px' })
    seen.observe(el)
    return () => seen.disconnect()
  }, [near])
  return (
    <div ref={ref} style={near ? undefined : { minHeight: height }}>
      {near ? children : null}
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
  const text = useText()
  const { lang } = useI18n()
  // The page follows the language in its own tags too: html lang, the title and the description.
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = text.docTitle
    document.querySelector('meta[name="description"]')?.setAttribute('content', text.docDescription)
  }, [lang, text])
  return (
    <div className="scrollbar-subtle h-dvh overflow-x-clip overflow-y-auto [scrollbar-gutter:stable]">
      <Hero />
      <div className="relative">
        <SlotsBand />
        <main className="relative mx-auto flex max-w-6xl flex-col px-5 pb-[max(4rem,env(safe-area-inset-bottom))]">
          <MobileShowcase />
          <Section title={text.whatTitle} className="order-4 md:order-none">
            <div className="flex flex-col gap-4 text-copy text-fg-secondary">
              <p>{text.whatFirst}</p>
              <p>{text.whatSecond}</p>
            </div>
          </Section>

          <Section title={text.howTitle} className="order-5 md:order-none">
            <ol className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
              {text.steps.flatMap((step, i) => {
                const Icon = STEP_ICONS[i]
                return [
                <li key={step.title} className="rounded-2xl bg-surface p-5">
                  <Icon className="size-5 text-fg-secondary" strokeWidth={1.5} aria-hidden />
                  <p className="mt-3 text-label text-fg">{step.title}</p>
                  <p className="mt-1 text-ui text-fg-secondary">{step.text}</p>
                </li>,
                i < text.steps.length - 1 && (
                  <li key={`a${i}`} aria-hidden className="hidden items-center text-fg-muted md:flex">
                    <ArrowRight className="size-5" strokeWidth={1.5} />
                  </li>
                ),
                ]
              })}
            </ol>
          </Section>

          <Section title={text.todayTitle} className="hidden md:block">
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {text.today.map((item, i) => (
                <Card key={item.title} icon={TODAY_ICONS[i]} title={item.title} text={item.text} />
              ))}
            </ul>
          </Section>

          <Section title={text.seeTitle} lead={text.seeLead} className="order-2 md:order-none">
            <WhenNear height="40rem">
              <Suspense fallback={<div className="h-[40rem] rounded-2xl bg-surface" />}>
                <Demo label={text.demo} />
              </Suspense>
            </WhenNear>
          </Section>

          <section className="order-3 grid items-center gap-6 py-10 sm:gap-8 sm:py-16 md:order-none md:grid-cols-[2fr_3fr]">
            <div>
              <h2 className="text-title">{text.askTitle}</h2>
              <p className="mt-3 text-copy text-fg-secondary">{text.askText}</p>
            </div>
            <ChatClip />
          </section>

          <Section title={text.codeTitle} className="order-6 md:order-none">
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="group flex flex-col gap-6 rounded-2xl bg-surface p-6 transition-colors hover:bg-raised sm:flex-row sm:items-center sm:gap-8 sm:p-8"
            >
              <span className="grid size-20 shrink-0 place-items-center rounded-2xl bg-fg text-bg">
                <GithubMark className="size-10" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-meta text-fg-muted">github.com</span>
                <span className="mt-1 block text-display">Strivon</span>
                <span className="mt-2 block text-copy text-fg-secondary">{text.repoDescription}</span>
              </span>
              <span className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-xl bg-fg px-5 text-label text-bg transition-opacity group-hover:opacity-85 sm:self-center">
                {text.openRepo}
                <ArrowUpRight className="size-4" aria-hidden />
              </span>
            </a>
          </Section>

          <Section title={text.teamTitle} className="order-7 md:order-none">
            <ul className="flex flex-wrap gap-x-8 gap-y-3 text-copy sm:gap-x-10 sm:gap-y-2">
              {TEAM.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </Section>

          <footer className="order-8 pt-12 md:order-none">
            <div className="mb-6 flex items-center justify-center gap-6 sm:gap-8">
              <img src="partners/junctionx.png" alt="JunctionX Lisbon" className="h-10 w-auto sm:h-14" />
              <img src="partners/sensei.png" alt="Sensei" className="h-10 w-auto sm:h-14" />
            </div>
            <p className="relative mx-auto max-w-xs rounded-lg bg-bg/75 px-3 py-1.5 text-center text-meta text-fg-muted backdrop-blur-sm sm:max-w-none sm:bg-transparent sm:p-0 sm:backdrop-blur-none">{text.footer}</p>
          </footer>
        </main>
      </div>
    </div>
  )
}
