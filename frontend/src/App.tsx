import { Route, Routes } from 'react-router'
import { Layout } from '@/components/Layout'
import { I18nProvider } from '@/lib/i18n'
import { StoreProvider } from '@/lib/store'
import { DayPage } from '@/pages/DayPage'
import { GondolaPage } from '@/pages/GondolaPage'
import { GondolasPage } from '@/pages/GondolasPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { TasksPage } from '@/pages/TasksPage'

export default function App() {
  return (
    <I18nProvider>
      <StoreProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<TasksPage />} />
            <Route path="gondolas" element={<GondolasPage />} />
            <Route path="gondolas/:camera" element={<GondolaPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="day" element={<DayPage />} />
          </Route>
        </Routes>
      </StoreProvider>
    </I18nProvider>
  )
}
