import { useState, useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { useNavStore } from './stores/navStore';
import { useOrderStore } from './stores/orderStore';
import { useMenuStore } from './stores/menuStore';
import { useStoreStore } from './stores/storeStore';
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
import ToastContainer from './components/ToastContainer';
import { SPLASH_DURATION_MS } from './constants';
import type { NavPage } from './types';
import { isBlockingConfigError } from './lib/supabase';
import Logo from './components/Logo';

const pageMap: Record<NavPage, React.ComponentType> = {
  dashboard: DashboardPage,
  orders: OrdersPage,
  menu: MenuPage,
  calculator: CalculatorPage,
  reports: ReportsPage,
  settings: SettingsPage,
};

export default function App() {
  const [showingSplash, setShowingSplash] = useState(!import.meta.env.DEV);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const checkSession = useAuthStore((s) => s.checkSession);
  const syncOrders = useOrderStore((s) => s.syncOrdersFromSupabase);
  const syncMenu = useMenuStore((s) => s.syncMenuFromSupabase);
  const syncStore = useStoreStore((s) => s.syncStoreFromSupabase);
  const currentPage = useNavStore((s) => s.currentPage);
  const orderDetailId = useNavStore((s) => s.orderDetailId);
  const isNewOrderOpen = useNavStore((s) => s.isNewOrderOpen);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (isAuthenticated) {
      void syncOrders();
      void syncMenu();
      void syncStore();
    }
  }, [isAuthenticated, syncOrders, syncMenu, syncStore]);

  useEffect(() => {
    const timer = setTimeout(() => setShowingSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (isBlockingConfigError) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl p-6 sm:p-8 shadow-xl border border-danger-200 dark:border-danger-900/40 flex flex-col items-center gap-4 text-center">
          <Logo size="md" />
          <div className="w-12 h-12 rounded-full bg-danger-100 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400 flex items-center justify-center text-xl font-bold">
            ⚠️
          </div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">
            Konfigurasi Supabase Diperlukan
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
            Variabel lingkungan <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-danger-600 dark:text-danger-400 font-mono">VITE_SUPABASE_URL</code> dan <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-danger-600 dark:text-danger-400 font-mono">VITE_SUPABASE_ANON_KEY</code> belum diatur pada file <code className="font-mono">.env</code>.
          </p>
          <div className="w-full bg-gray-50 dark:bg-gray-750 p-3 rounded-xl border border-gray-200 dark:border-gray-700 text-left text-xs text-gray-500 dark:text-gray-400">
            <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Panduan Pengembang:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Salin <code className="font-mono">.env.example</code> ke <code className="font-mono">.env</code></li>
              <li>Isi URL dan anon key dari Supabase</li>
              <li>Atau aktifkan mode demo: <code className="font-mono">VITE_USE_MOCK=true</code> di development</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  let content: React.ReactNode;

  if (showingSplash) {
    content = <SplashScreen />;
  } else if (!isAuthenticated) {
    content = <LoginPage />;
  } else if (currentPage === 'orders' && isNewOrderOpen) {
    content = (
      <AppLayout>
        <NewOrderPage />
      </AppLayout>
    );
  } else if (currentPage === 'orders' && orderDetailId) {
    content = (
      <AppLayout>
        <OrderDetailPage />
      </AppLayout>
    );
  } else {
    const Page = pageMap[currentPage] ?? DashboardPage;
    content = (
      <AppLayout>
        <Page />
      </AppLayout>
    );
  }

  return (
    <>
      <ToastContainer />
      {content}
    </>
  );
}
