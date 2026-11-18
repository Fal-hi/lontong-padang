import type { ReactNode } from 'react';
import AppHeader from '../components/AppHeader';
import BottomNavbar from '../components/BottomNavbar';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex flex-col items-center">
      <div className="w-full max-w-md min-h-screen bg-gray-50 dark:bg-gray-900 shadow-xl relative flex flex-col">
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
          <AppHeader />
        </header>

        <main className="flex-1 min-h-0">
          {children}
        </main>

        <BottomNavbar />
      </div>
    </div>
  );
}
