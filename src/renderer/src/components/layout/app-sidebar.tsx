import { useNavigate } from 'react-router-dom';
import { PanelLeft } from 'lucide-react';
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
  const navigate = useNavigate();
  const { leftOpen, toggleLeft } = useSidebar();

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'bg-sidebar border-sidebar-border flex h-full shrink-0 flex-col border-r transition-all duration-300 ease-in-out',
          leftOpen ? 'w-64' : 'w-24'
        )}
      >
        <div className="border-sidebar-border flex h-12 items-stretch border-b">
          <button
            onClick={() => navigate('/dashboard')}
            className="border-sidebar-border hover:bg-sidebar-accent flex w-12 shrink-0 items-center justify-center border-r transition-colors"
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
              <div className="relative flex w-full items-center justify-center pr-8">
                <span className="text-sidebar-foreground font-mono text-base font-medium">
                  VibeWork
                </span>
                <button
                  onClick={toggleLeft}
                  aria-label="折叠侧边栏"
                  className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground absolute right-0 flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors"
                >
                  <PanelLeft className="size-4" />
                </button>
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={toggleLeft}
                    aria-label="展开侧边栏"
                    className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors"
                  >
                    <PanelLeft className="size-4" />
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
