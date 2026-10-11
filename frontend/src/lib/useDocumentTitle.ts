import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useI18n } from '@/lib/i18n'

/** "Calibration · strivon": the tab names the page you are on, in the chosen language. */
export function useDocumentTitle(): void {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const key = pathname.startsWith('/gondolas')
    ? 'gondola'
    : pathname.startsWith('/products')
      ? 'products'
      : pathname.startsWith('/calibration')
        ? 'calibration'
        : pathname.startsWith('/insights')
          ? 'insights'
          : pathname.startsWith('/validate')
            ? 'validate'
            : 'tasks'
  const page = t.docTitle[key]
  useEffect(() => {
    document.title = `${page} · strivon`
  }, [page])
}
