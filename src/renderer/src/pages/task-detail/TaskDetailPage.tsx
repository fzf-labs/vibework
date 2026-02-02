import { SidebarProvider } from '@/components/layout';

import { TaskDetailContainer } from './TaskDetailContainer';

export function TaskDetailPage() {
  return (
    <SidebarProvider>
      <TaskDetailContainer />
    </SidebarProvider>
  );
}
