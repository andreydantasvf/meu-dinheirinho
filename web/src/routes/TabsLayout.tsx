import { Outlet } from 'react-router-dom';
import { BottomTabBar } from '../components/BottomTabBar';
import { AppHeader } from '../components/AppHeader';
import { DesktopSidebar } from '../components/desktop-sidebar';
import { DesktopFab } from '../components/desktop-fab';

export default function TabsLayout() {
  return (
    <div className="flex min-h-dvh w-full bg-background text-foreground">
      <DesktopSidebar />
      <div className="flex flex-1 flex-col relative max-w-full md:max-w-5xl mx-auto shadow-2xl md:shadow-none border-x border-border md:border-none">
        <div className="md:hidden">
          <AppHeader />
        </div>
        <main className="flex-1 pb-28 md:pb-8 md:pt-8 px-4 relative">
          <Outlet />
        </main>
        <div className="md:hidden">
          <BottomTabBar />
        </div>
      </div>
      <DesktopFab />
    </div>
  );
}
