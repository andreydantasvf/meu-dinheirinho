import { Outlet } from 'react-router-dom';
import { BottomTabBar } from '../components/BottomTabBar';
import { AppHeader } from '../components/AppHeader';

export default function TabsLayout() {
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col bg-background text-foreground shadow-2xl border-x border-border">
      <AppHeader />
      <main className="flex-1 pb-28">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}
