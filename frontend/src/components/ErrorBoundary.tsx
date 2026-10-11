import { Component, type ReactNode } from 'react'
import { useI18n } from '@/lib/i18n'

function Fallback() {
  const { t } = useI18n()
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-5 py-24 text-center">
      <p className="text-copy text-fg-secondary">{t.somethingWrong}</p>
      <button type="button" onClick={() => location.reload()} className="h-11 cursor-pointer rounded-xl bg-fg px-5 text-label text-bg">
        {t.reload}
      </button>
    </div>
  )
}

/** Keeps one page's crash from leaving a blank screen: the rest of the app stays, and the page can be reloaded. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <Fallback /> : this.props.children
  }
}
