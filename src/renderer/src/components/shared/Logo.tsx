import ImageLogo from '@/assets/logo.png';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <img src={ImageLogo} alt="VibeWork" className="text-primary size-7" />
    </div>
  );
}
