import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { CustomerRefundPage } from '../pages/CustomerRefundPage';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AppShell>
        <CustomerRefundPage />
      </AppShell>
    ),
  },
  {
    path: '/admin',
    element: (
      <AppShell>
        <AdminDashboardPage />
      </AppShell>
    ),
  },
  {
    path: '*',
    element: (
      <AppShell>
        <NotFoundPage />
      </AppShell>
    ),
  },
]);
