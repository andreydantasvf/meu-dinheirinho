import { Outlet } from 'react-router-dom';
import { BottomTabBar } from '../components/BottomTabBar';
import { AppHeader } from '../components/AppHeader';

export default function TabsLayout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <AppHeader />
      <main className="pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}
