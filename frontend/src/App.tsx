import { Navigate, Route, Routes } from 'react-router'
import { Layout } from '@/components/Layout'
import { I18nProvider } from '@/lib/i18n'
import { StoreProvider } from '@/lib/store'
import { CalibrationPage } from '@/pages/CalibrationPage'
import { GondolaPage } from '@/pages/GondolaPage'
import { InsightsPage } from '@/pages/InsightsPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { RoundPage } from '@/pages/RoundPage'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SetsPage } from '@/pages/SetsPage'
import { TasksPage } from '@/pages/TasksPage'
import { ValidatePage } from '@/pages/ValidatePage'

export default function App() {
  return (
    <I18nProvider>
      <StoreProvider>
        <ErrorBoundary>
        <Routes>
          {/* The round fills the phone screen, so it has no header or tab bar around it. */}
          <Route path="round" element={<RoundPage />} />
          <Route element={<Layout />}>
            <Route index element={<TasksPage />} />
            <Route path="gondolas/:camera" element={<GondolaPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="calibration" element={<CalibrationPage />} />
            <Route path="insights" element={<InsightsPage />} />
            {/* staff tool for the validation day, reachable by URL only */}
            <Route path="validate" element={<ValidatePage />} />
            <Route path="sets" element={<SetsPage />} />
            {/* the plan and the list of gondolas now live on the first page */}
            <Route path="map" element={<Navigate to="/" replace />} />
            <Route path="gondolas" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </ErrorBoundary>
      </StoreProvider>
    </I18nProvider>
  )
}
