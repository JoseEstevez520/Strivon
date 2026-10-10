import { Route, Routes } from 'react-router'
import { Layout } from '@/components/Layout'
import { I18nProvider } from '@/lib/i18n'
import { StoreProvider } from '@/lib/store'
import { InsightsPage } from '@/pages/InsightsPage'
import { GondolaPage } from '@/pages/GondolaPage'
import { GondolasPage } from '@/pages/GondolasPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { TasksPage } from '@/pages/TasksPage'
import { WelcomePage } from '@/pages/WelcomePage'

export default function App() {
  return (
    <I18nProvider>
      <StoreProvider>
        <Routes>
          <Route path="welcome" element={<WelcomePage />} />
          <Route element={<Layout />}>
            <Route index element={<TasksPage />} />
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
