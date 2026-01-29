import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';

interface ProjectGuardProps {
  children: ReactNode;
}

export function ProjectGuard({ children }: ProjectGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, loading } = useProjects();

  useEffect(() => {
    if (loading) return;
    if (projects.length === 0 && location.pathname !== '/projects') {
      navigate('/projects', { replace: true });
    }
  }, [loading, projects.length, location.pathname, navigate]);

  if (loading) {
    return null;
  }

  if (projects.length === 0 && location.pathname !== '/projects') {
    return null;
  }

  return <>{children}</>;
}
