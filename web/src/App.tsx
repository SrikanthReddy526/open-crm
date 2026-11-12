import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/RequireAuth'
import { AppLayout } from './components/AppLayout'
import { DevicesPage } from './features/admin/DevicesPage'
import { UsersPage } from './features/admin/UsersPage'
import { LoginPage } from './features/auth/LoginPage'
import { CustomerDetailPage } from './features/customers/CustomerDetailPage'
import { CustomerFormPage } from './features/customers/CustomerFormPage'
import { CustomerListPage } from './features/customers/CustomerListPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { DealFormPage } from './features/deals/DealFormPage'
import { DealListPage } from './features/deals/DealListPage'
import { LeadDetailPage } from './features/leads/LeadDetailPage'
import { LeadFormPage } from './features/leads/LeadFormPage'
import { LeadListPage } from './features/leads/LeadListPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { ReminderListPage } from './features/reminders/ReminderList'
import { SyncPage } from './features/sync/SyncPage'
import { TicketDetailPage } from './features/tickets/TicketDetailPage'
import { TicketFormPage } from './features/tickets/TicketFormPage'
import { TicketListPage } from './features/tickets/TicketListPage'
import { VisitFormPage } from './features/visits/VisitFormPage'
import { VisitListPage } from './features/visits/VisitList'

// Leaflet is ~150 kB: load the map only when it is opened.
const MapPage = lazy(() => import('./features/map/MapPage').then((m) => ({ default: m.MapPage })))

function Loading() {
  const { t } = useTranslation()
  return <p className="muted">{t('common.loading')}</p>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomerListPage />} />
        <Route path="customers/new" element={<CustomerFormPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="customers/:id/edit" element={<CustomerFormPage />} />
        <Route
          path="map"
          element={
            <Suspense fallback={<Loading />}>
              <MapPage />
            </Suspense>
          }
        />
        <Route path="visits" element={<VisitListPage />} />
        <Route path="visits/new" element={<VisitFormPage />} />
        <Route path="reminders" element={<ReminderListPage />} />
        <Route path="tickets" element={<TicketListPage />} />
        <Route path="tickets/new" element={<TicketFormPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="tickets/:id/edit" element={<TicketFormPage />} />
        <Route path="leads" element={<LeadListPage />} />
        <Route path="leads/new" element={<LeadFormPage />} />
        <Route path="leads/:id" element={<LeadDetailPage />} />
        <Route path="leads/:id/edit" element={<LeadFormPage />} />
        <Route path="deals" element={<DealListPage />} />
        <Route path="deals/new" element={<DealFormPage />} />
        <Route path="deals/:id" element={<DealFormPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="sync" element={<SyncPage />} />
        <Route
          path="admin/users"
          element={
            <RequireAuth roles={['ADMIN']}>
              <UsersPage />
            </RequireAuth>
          }
        />
        <Route
          path="admin/devices"
          element={
            <RequireAuth roles={['ADMIN']}>
              <DevicesPage />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
