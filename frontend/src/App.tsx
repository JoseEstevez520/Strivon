import { Navigate, Route, Routes } from 'react-router'
import { Layout } from '@/components/Layout'
import { I18nProvider } from '@/lib/i18n'
import { StoreProvider } from '@/lib/store'
import { GondolaPage } from '@/pages/GondolaPage'
import { InsightsPage } from '@/pages/InsightsPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { TasksPage } from '@/pages/TasksPage'

export default function App() {
  return (
    <I18nProvider>
      <StoreProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<TasksPage />} />
            <Route path="gondolas/:camera" element={<GondolaPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="insights" element={<InsightsPage />} />
            {/* the plan and the list of gondolas now live on the first page */}
            <Route path="map" element={<Navigate to="/" replace />} />
            <Route path="gondolas" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </StoreProvider>
    </I18nProvider>
  )
}
