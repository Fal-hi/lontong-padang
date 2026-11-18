import { useState, useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { useNavStore } from './stores/navStore';
import SplashScreen from './features/auth/SplashScreen';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './features/dashboard/DashboardPage';
import OrdersPage from './features/orders/OrdersPage';
import NewOrderPage from './features/orders/NewOrderPage';
import OrderDetailPage from './features/orders/OrderDetailPage';
import MenuPage from './features/menu/MenuPage';
import CalculatorPage from './features/calculator/CalculatorPage';
import ReportsPage from './features/reports/ReportsPage';
import SettingsPage from './features/settings/SettingsPage';
import AppLayout from './layout/AppLayout';
import { SPLASH_DURATION_MS } from './constants';
import type { NavPage } from './types';

const pageMap: Record<NavPage, React.ComponentType> = {
  dashboard: DashboardPage,
  orders: OrdersPage,
  menu: MenuPage,
  calculator: CalculatorPage,
  reports: ReportsPage,
  settings: SettingsPage,
};

export default function App() {
  const [showingSplash, setShowingSplash] = useState(true);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentPage = useNavStore((s) => s.currentPage);
  const orderDetailId = useNavStore((s) => s.orderDetailId);
  const isNewOrderOpen = useNavStore((s) => s.isNewOrderOpen);

  useEffect(() => {
    const timer = setTimeout(() => setShowingSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (showingSplash) {
    return <SplashScreen />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (currentPage === 'orders' && isNewOrderOpen) {
    return (
      <AppLayout>
        <NewOrderPage />
      </AppLayout>
    );
  }

  if (currentPage === 'orders' && orderDetailId) {
    return (
      <AppLayout>
        <OrderDetailPage />
      </AppLayout>
    );
  }

  const Page = pageMap[currentPage] ?? DashboardPage;

  return (
    <AppLayout>
      <Page />
    </AppLayout>
  );
}
