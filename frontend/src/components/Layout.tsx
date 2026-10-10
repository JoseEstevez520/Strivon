import { Globe } from 'lucide-react'
import { ES, GB, PT } from 'country-flag-icons/react/3x2'
import { NavLink, Outlet } from 'react-router'
import { PickerButton } from './PickerButton'
import { LANGS, useI18n } from '@/lib/i18n'

const flag = 'flag block h-3.5 w-[21px] shrink-0 rounded-[3px]'
const LANG_OPTIONS = {
  en: { label: 'English', icon: <GB className={flag} /> },
  pt: { label: 'Português', icon: <PT className={flag} /> },
  es: { label: 'Español', icon: <ES className={flag} /> },
} as const

const link =
  'rounded-md px-3 py-1.5 text-label text-fg-secondary transition-colors hover:bg-surface aria-[current=page]:bg-surface aria-[current=page]:text-fg'

/** The bar every page shares: where you are, what time the store is shown at, and the language. */
export function Layout() {
  const { t, lang, setLang } = useI18n()

  return (
    <>
      <div>
        <div className="mx-auto max-w-6xl px-5 pt-4">
          <header className="flex items-center gap-4">
            <span className="text-title tracking-tight">strivon</span>
            <nav className="flex gap-1" aria-label="Pages">
              <NavLink to="/" end className={link}>
                {t.navTasks}
              </NavLink>
              <NavLink to="/gondolas" className={link}>
                {t.navGondolas}
              </NavLink>
              <NavLink to="/products" className={link}>
                {t.navProducts}
              </NavLink>
            </nav>
            <div className="ml-auto">
              <PickerButton
                icon={<Globe />}
                label={t.language}
                value={lang}
                iconOnly
                onChange={(v) => setLang(v as typeof lang)}
                options={LANGS.map((l) => ({ value: l, ...LANG_OPTIONS[l] }))}
              />
            </div>
          </header>
        </div>
      </div>
      <main className="mx-auto max-w-6xl px-5 pt-8 pb-14">
        <Outlet />
      </main>
    </>
  )
}
