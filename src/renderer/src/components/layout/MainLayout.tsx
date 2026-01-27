import { Outlet } from 'react-router-dom';
import { LeftSidebar, SidebarProvider } from '@/components/layout';

export function MainLayout() {
  return (
    <SidebarProvider>
      <div className="bg-sidebar flex h-screen overflow-hidden">
        <LeftSidebar />
        <div className="bg-background my-2 mr-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl shadow-sm">
          <Outlet />
        </div>
      </div>
    </SidebarProvider>
  );
}
