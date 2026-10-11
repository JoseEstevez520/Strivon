import { Route, Routes } from 'react-router'
import { Layout } from '@/components/Layout'
import { I18nProvider } from '@/lib/i18n'
import { StoreProvider } from '@/lib/store'
import { InsightsPage } from '@/pages/InsightsPage'
import { GondolaPage } from '@/pages/GondolaPage'
import { GondolasPage } from '@/pages/GondolasPage'
import { MapStorePage } from '@/pages/MapStorePage'
import { ProductsPage } from '@/pages/ProductsPage'
import { TasksPage } from '@/pages/TasksPage'

export default function App() {
  return (
    <I18nProvider>
      <StoreProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<TasksPage />} />
            <Route path="map" element={<MapStorePage />} />
            <Route path="gondolas" element={<GondolasPage />} />
            <Route path="gondolas/:camera" element={<GondolaPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="insights" element={<InsightsPage />} />
          </Route>
        </Routes>
      </StoreProvider>
    </I18nProvider>
  )
}
