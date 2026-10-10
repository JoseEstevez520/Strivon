import { Apple, Globe, LayoutGrid, ListChecks, type LucideIcon } from 'lucide-react'
import { ES, GB, PT } from 'country-flag-icons/react/3x2'
import { Link, NavLink, Outlet } from 'react-router'
import { PickerButton } from './PickerButton'
import { LANGS, useI18n } from '@/lib/i18n'
import { useScrolled } from '@/lib/useScrolled'

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
  label: 'navTasks' | 'navGondolas' | 'navProducts'
}

const PAGES: Page[] = [
  { to: '/', end: true, icon: ListChecks, label: 'navTasks' },
  { to: '/gondolas', icon: LayoutGrid, label: 'navGondolas' },
  { to: '/products', icon: Apple, label: 'navProducts' },
]

/**
 * A fixed, opaque bar: the name on the left, the pages in the middle and the language on the
 * right. The page you are on is the one in the text colour, with no shape or line. A line under
 * the bar shows only once the page has moved. On a phone the pages move to a bar at the bottom.
 */
export function Layout() {
  const { t, lang, setLang } = useI18n()
  const scrolled = useScrolled()

  return (
    <>
      <header
        className={`sticky top-0 z-30 border-b bg-bg transition-colors ${scrolled ? 'border-border' : 'border-transparent'}`}
      >
        <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-5">
          <Link to="/" className="justify-self-start rounded-sm text-title tracking-tight">
            strivon
          </Link>
          <nav className="col-start-2 hidden h-full gap-2 md:flex" aria-label="Pages">
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

      <main className="mx-auto max-w-7xl px-5 pt-8 pb-24 md:pb-14">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Pages"
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
    </>
  )
}
