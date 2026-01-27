import { createBrowserRouter } from 'react-router-dom';
import { HomePage, LibraryPage, SetupPage, TaskDetailPage } from '@/pages';

import { SetupGuard } from '@/components/shared/SetupGuard';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <SetupGuard>
        <HomePage />
      </SetupGuard>
    ),
  },
  {
    path: '/task/:taskId',
    element: (
      <SetupGuard>
        <TaskDetailPage />
      </SetupGuard>
    ),
  },
  {
    path: '/library',
    element: (
      <SetupGuard>
        <LibraryPage />
      </SetupGuard>
    ),
  },
  {
    path: '/setup',
    element: <SetupPage />,
  },
]);
