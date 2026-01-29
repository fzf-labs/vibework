import type { ReactNode } from 'react';
import { ProjectGuard } from './ProjectGuard';

interface SetupGuardProps {
  children: ReactNode;
}

export function SetupGuard({ children }: SetupGuardProps) {
  return <ProjectGuard>{children}</ProjectGuard>;
}
