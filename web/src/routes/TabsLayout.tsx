import { Outlet } from 'react-router-dom';
import { BottomTabBar } from '../components/BottomTabBar';

export default function TabsLayout() {
  return (
    <div className="min-h-dvh">
      <main className="pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}
