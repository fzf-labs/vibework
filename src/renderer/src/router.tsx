import { createHashRouter, Navigate } from 'react-router-dom';
import {
  HomePage,
  SetupPage,
  TaskDetailPage,
  DashboardPage,
  BoardPage,
  SkillsPage,
  McpPage,
  ProjectsPage,
  PipelineTemplatesPage,
  TasksPage,
} from '@/pages';

import { SetupGuard } from '@/components/shared/SetupGuard';
import { MainLayout } from '@/components/layout';

export const router = createHashRouter([
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
        path: 'tasks',
        element: <TasksPage />,
      },
      {
        path: 'pipeline-templates',
        element: <PipelineTemplatesPage />,
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
        path: 'projects',
        element: <ProjectsPage />,
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
    path: '/setup',
    element: (
      <SetupGuard>
        <SetupPage />
      </SetupGuard>
    ),
  },
]);
