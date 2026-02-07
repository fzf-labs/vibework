import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, FileText, Gamepad2, ListTodo, Sparkles } from 'lucide-react';
import type { MessageAttachment } from '@/hooks/useAgent';
import { getSettings } from '@/data/settings';
import { useProjects } from '@/hooks/useProjects';
import { ChatInput } from '@/components/shared/ChatInput';
import { cn } from '@/lib/utils';

type QuickPrompt = {
  icon: React.ReactNode;
  title: string;
  prompt: string;
};

export function TasksPage() {
  const navigate = useNavigate();
  const { projects, currentProject, currentProjectId, setCurrentProjectId } = useProjects();

  const quickPrompts = useMemo<QuickPrompt[]>(
    () => [
      {
        icon: <Gamepad2 className="size-4" />,
        title: '在当前仓库实现一个经典贪吃蛇小游戏',
        prompt: '请在当前项目里实现一个经典贪吃蛇小游戏，并给出运行方式。',
      },
      {
        icon: <FileText className="size-4" />,
        title: '生成一页产品方案摘要 PDF',
        prompt: '请基于当前项目生成一页产品方案摘要，并导出为 PDF。',
      },
      {
        icon: <ListTodo className="size-4" />,
        title: '总结上周 PR 的主题和待办',
        prompt: '请总结上周 PR 的主要主题、风险点和下一步待办清单。',
      },
    ],
    []
  );

  const handleSubmit = async (text: string, attachments?: MessageAttachment[]) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return;

    const prompt = text.trim();
    try {
      const settings = getSettings();
      const result = await window.api.task.create({
        title: prompt,
        prompt,
        taskMode: 'conversation',
        projectId: currentProject?.id,
        projectPath: currentProject?.path,
        cliToolId: settings.defaultCliToolId || undefined,
      });
      if (result.success && result.data) {
        navigate(`/task/${result.data.id}`, {
          state: { prompt, attachments },
        });
      }
    } catch (error) {
      console.error('[TasksPage] Failed to create task:', error);
    }
  };

  const handleQuickPrompt = async (prompt: string) => {
    await handleSubmit(prompt);
  };

  return (
    <div className="flex h-full flex-col overflow-auto px-6 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="bg-muted flex size-11 items-center justify-center rounded-full">
            <Sparkles className="size-5" />
          </div>
          <h1 className="text-foreground text-4xl font-semibold tracking-tight">Let's build</h1>

          <div className="relative">
            <select
              value={currentProjectId || ''}
              onChange={(event) => setCurrentProjectId(event.target.value || null)}
              className="text-muted-foreground hover:text-foreground bg-transparent pr-5 text-2xl font-medium outline-none"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
              {projects.length === 0 && <option value="">未选择项目</option>}
            </select>
            <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-0 size-4 -translate-y-1/2" />
          </div>
        </div>

        <div className="mb-5 grid w-full grid-cols-1 gap-3 md:grid-cols-3">
          {quickPrompts.map((item) => (
            <button
              key={item.title}
              type="button"
              onClick={() => handleQuickPrompt(item.prompt)}
              className={cn(
                'border-border bg-background hover:bg-accent/60 rounded-2xl border px-4 py-4 text-left transition-colors',
                'flex flex-col gap-2'
              )}
            >
              <span className="text-muted-foreground">{item.icon}</span>
              <span className="text-foreground text-sm leading-6">{item.title}</span>
            </button>
          ))}
        </div>

        <div className="w-full max-w-3xl">
          <ChatInput
            variant="home"
            placeholder="Ask Vibework anything, @ 添加文件, / 执行命令"
            onSubmit={handleSubmit}
            className="w-full"
            autoFocus
          />
        </div>

        {currentProject && (
          <p className="text-muted-foreground mt-3 text-xs">任务将创建在项目：{currentProject.name}</p>
        )}
      </div>
    </div>
  );
}
