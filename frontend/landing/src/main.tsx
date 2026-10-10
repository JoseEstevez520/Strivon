import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './landing.css'
import { Landing } from './Landing'
import { I18nProvider } from '@/lib/i18n'
import { StoreProvider } from '@/lib/store'

// The landing is its own page, not a screen of the app: no router, and nothing on it leads into the app.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <StoreProvider>
        <Landing />
      </StoreProvider>
    </I18nProvider>
  </StrictMode>,
)
