import type { ReactNode } from 'react';

interface SetupGuardProps {
  children: ReactNode;
}

export function SetupGuard({ children }: SetupGuardProps) {
  return <>{children}</>;
}
