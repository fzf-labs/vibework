import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar, SidebarProvider } from '@/components/layout';

export function MainLayout() {
  const location = useLocation();
  const isProjectsRoute = location.pathname === '/projects';

  if (isProjectsRoute) {
    return (
      <div className="bg-background h-screen">
        <Outlet />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="bg-sidebar flex h-screen overflow-hidden">
        <AppSidebar />
        <div className="bg-background my-2 mr-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl shadow-sm">
          <Outlet />
        </div>
      </div>
    </SidebarProvider>
  );
}
