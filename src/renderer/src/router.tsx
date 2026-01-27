import { createBrowserRouter, Navigate } from 'react-router-dom';
import {
  HomePage,
  LibraryPage,
  SetupPage,
  TaskDetailPage,
  DashboardPage,
  BoardPage,
  SkillsPage,
  McpPage,
} from '@/pages';

import { SetupGuard } from '@/components/shared/SetupGuard';
import { MainLayout } from '@/components/layout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <SetupGuard>
        <MainLayout />
      </SetupGuard>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'board',
        element: <BoardPage />,
      },
      {
        path: 'skills',
        element: <SkillsPage />,
      },
      {
        path: 'mcp',
        element: <McpPage />,
      },
      {
        path: 'home',
        element: <HomePage />,
      },
    ],
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
