import { useState } from 'react';
import ImageLogo from '@/assets/logo.png';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { LeftSidebar } from './left-sidebar';
import { ProjectRail } from './project-rail';
import { useSidebar } from './sidebar-context';

export function AppSidebar() {
  const { leftOpen, toggleLeft } = useSidebar();
  const [logoPulse, setLogoPulse] = useState(false);

  const handleLogoClick = () => {
    setLogoPulse(false);
    window.requestAnimationFrame(() => setLogoPulse(true));
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'bg-sidebar border-sidebar-border flex h-full shrink-0 flex-col border-r transition-all duration-300 ease-in-out',
          leftOpen ? 'w-52' : 'w-24'
        )}
      >
        <div className="border-sidebar-border flex h-12 items-stretch border-b">
          <button
            type="button"
            onClick={handleLogoClick}
            onAnimationEnd={() => setLogoPulse(false)}
            aria-label="VibeWork"
            className={cn(
              'border-sidebar-border flex w-12 shrink-0 items-center justify-center border-r',
              logoPulse && 'logo-click-effect'
            )}
          >
            <img src={ImageLogo} alt="VibeWork" className="size-7" />
          </button>
          <div
            className={cn(
              'flex items-center overflow-hidden transition-all duration-300 ease-in-out',
              leftOpen ? 'min-w-0 flex-1 px-3' : 'w-12 justify-center'
            )}
          >
            {leftOpen ? (
              <button
                onClick={toggleLeft}
                aria-label="折叠侧边栏"
                className="text-sidebar-foreground hover:bg-sidebar-accent flex h-8 w-full items-center justify-center rounded-md px-2 font-mono text-base font-medium transition-colors"
              >
                <span className="truncate">VibeWork</span>
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleLeft}
                    aria-label="展开侧边栏"
                    className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground flex h-8 w-10 items-center justify-center rounded-md font-mono text-sm font-semibold tracking-wide transition-colors"
                  >
                    VW
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">展开侧边栏</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <ProjectRail />
          <LeftSidebar collapsed={!leftOpen} />
        </div>
      </aside>
    </TooltipProvider>
  );
}
