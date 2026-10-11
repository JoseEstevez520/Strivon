import { Apple, ChartNoAxesColumn, Globe, ListChecks, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { ES, GB, PT } from 'country-flag-icons/react/3x2'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Logo } from './Logo'
import { PickerButton } from './PickerButton'
import { LANGS, useI18n } from '@/lib/i18n'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { showValidation, validationOn } from '@/model/source'

const flag = 'flag block h-3.5 w-[21px] shrink-0 rounded-[3px]'
const LANG_OPTIONS = {
  en: { label: 'English', icon: <GB className={flag} /> },
  pt: { label: 'Português', icon: <PT className={flag} /> },
  es: { label: 'Español', icon: <ES className={flag} /> },
} as const

interface Page {
  to: string
  end?: boolean
  icon: LucideIcon
  label: 'navTasks' | 'navProducts' | 'navInsights' | 'navCalibration'
}

const PAGES: Page[] = [
  { to: '/', end: true, icon: ListChecks, label: 'navTasks' },
  { to: '/products', icon: Apple, label: 'navProducts' },
  { to: '/insights', icon: ChartNoAxesColumn, label: 'navInsights' },
  { to: '/calibration', icon: SlidersHorizontal, label: 'navCalibration' },
]

/**
 * The window does not scroll. The bar is on top across the whole width, and what is under it
 * scrolls in its own container, so the scrollbar starts below the bar and never cuts it. The
 * name is on the left, the pages in the middle and the language on the right, and the page you
 * are on is the one in the text colour, with no shape or line. A line under the bar shows only
 * once the content has moved. On a phone the pages move to a bar at the bottom.
 */
export function Layout() {
  const { t, lang, setLang } = useI18n()
  const [scrolled, setScrolled] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useDocumentTitle()

  // A new page starts at the top, as a browser would with a new document.
  useEffect(() => {
    scroller.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex h-dvh flex-col">
      <header className={`shrink-0 border-b bg-bg transition-colors ${scrolled ? 'border-border' : 'border-transparent'}`}>
        <div className="mx-auto grid h-12 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-5">
          <Link to="/" className="flex items-center gap-2 justify-self-start rounded-sm text-title tracking-tight">
            <Logo className="size-5" />
            strivon
          </Link>
          <nav className="col-start-2 hidden h-full gap-2 md:flex" aria-label={t.navLabel}>
            {PAGES.map(({ to, end, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className="flex h-full items-center gap-2 px-3 text-label text-fg-muted transition-colors hover:text-fg aria-[current=page]:text-fg"
              >
                <Icon className="size-4" />
                {t[label]}
              </NavLink>
            ))}
          </nav>
          <div className="col-start-3 justify-self-end">
            <PickerButton
              icon={<Globe />}
              label={t.language}
              value={lang}
              iconOnly
              onChange={(v) => setLang(v as typeof lang)}
              options={LANGS.map((l) => ({ value: l, ...LANG_OPTIONS[l] }))}
            />
          </div>
        </div>
      </header>

      {validationOn() && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-border bg-raised px-5 py-1.5 text-meta text-fg-secondary">
          <span>{t.viewBanner}</span>
          <button type="button" onClick={() => showValidation(false)} className="cursor-pointer text-fg underline underline-offset-2">
            {t.viewBack}
          </button>
        </div>
      )}

      <div
        ref={scroller}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop >= 1)}
        className="min-h-0 flex-1 overflow-y-auto scrollbar-subtle [scrollbar-gutter:stable]"
      >
        <main className="mx-auto max-w-7xl px-5 pt-8 pb-14">
          <Outlet />
        </main>
      </div>

      <nav
        className="grid shrink-0 grid-cols-4 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label={t.navLabel}
      >
        {PAGES.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex min-h-16 flex-col items-center justify-center gap-1 text-meta text-fg-muted transition-colors aria-[current=page]:text-fg"
          >
            <Icon className="size-5" />
            {t[label]}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
