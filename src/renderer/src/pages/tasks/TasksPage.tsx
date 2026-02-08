import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, GitBranch, Settings2, Sparkles, Workflow, Wrench } from 'lucide-react';
import type { MessageAttachment } from '@/hooks/useAgent';
import { db, type AgentToolConfig } from '@/data';
import { getSettings } from '@/data/settings';
import { useProjects } from '@/hooks/useProjects';
import { cn } from '@/lib/utils';
import { ChatInput } from '@/components/shared/ChatInput';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type CLIToolInfo = {
  id: string;
  displayName?: string;
  name?: string;
  installed?: boolean;
};

type WorkflowTemplate = {
  id: string;
  name: string;
};

export function TasksPage() {
  const navigate = useNavigate();
  const { currentProject } = useProjects();
  const [taskTitle, setTaskTitle] = useState('');
  const [cliTools, setCliTools] = useState<CLIToolInfo[]>([]);
  const [selectedCliToolId, setSelectedCliToolId] = useState('');
  const [cliConfigs, setCliConfigs] = useState<AgentToolConfig[]>([]);
  const [selectedCliConfigId, setSelectedCliConfigId] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBaseBranch, setSelectedBaseBranch] = useState('');
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedWorkflowTemplateId, setSelectedWorkflowTemplateId] = useState('');

  const isGitProject = currentProject?.projectType === 'git';

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const detected = await window.api?.cliTools?.detectAll?.();
        const tools = (Array.isArray(detected) ? detected : []) as CLIToolInfo[];
        const installedTools = tools.filter((tool) => tool.installed !== false);
        setCliTools(installedTools);

        const settings = getSettings();
        if (settings.defaultCliToolId) {
          const hasDefault = installedTools.some((tool) => tool.id === settings.defaultCliToolId);
          if (hasDefault) {
            setSelectedCliToolId(settings.defaultCliToolId);
          }
        }
      } catch (error) {
        console.error('[TasksPage] Failed to load CLI tools:', error);
        setCliTools([]);
      }
    };

    void loadInitial();
  }, []);

  useEffect(() => {
    if (!selectedCliToolId) {
      setCliConfigs([]);
      setSelectedCliConfigId('');
      return;
    }

    const loadConfigs = async () => {
      try {
        const result = await db.listAgentToolConfigs(selectedCliToolId);
        const list = Array.isArray(result) ? (result as AgentToolConfig[]) : [];
        setCliConfigs(list);
        const defaultConfig = list.find((cfg) => cfg.is_default);
        setSelectedCliConfigId(defaultConfig?.id || '');
      } catch (error) {
        console.error('[TasksPage] Failed to load CLI configs:', error);
        setCliConfigs([]);
        setSelectedCliConfigId('');
      }
    };

    void loadConfigs();
  }, [selectedCliToolId]);

  useEffect(() => {
    if (!currentProject?.id) {
      setWorkflowTemplates([]);
      setSelectedWorkflowTemplateId('');
      return;
    }

    const loadTemplates = async () => {
      try {
        const templates = await db.getWorkflowTemplatesByProject(currentProject.id);
        const list = Array.isArray(templates) ? (templates as WorkflowTemplate[]) : [];
        setWorkflowTemplates(list);
        if (selectedWorkflowTemplateId && !list.some((tpl) => tpl.id === selectedWorkflowTemplateId)) {
          setSelectedWorkflowTemplateId('');
        }
      } catch (error) {
        console.error('[TasksPage] Failed to load workflow templates:', error);
        setWorkflowTemplates([]);
      }
    };

    void loadTemplates();
  }, [currentProject?.id, selectedWorkflowTemplateId]);

  useEffect(() => {
    if (!isGitProject || !currentProject?.path) {
      setBranches([]);
      setSelectedBaseBranch('');
      return;
    }

    const loadBranches = async () => {
      try {
        const [branchesResult, currentResult] = await Promise.all([
          window.api?.git?.getBranches?.(currentProject.path),
          window.api?.git?.getCurrentBranch?.(currentProject.path),
        ]);

        const branchList = Array.isArray(branchesResult)
          ? (branchesResult as string[])
          : Array.isArray((branchesResult as { data?: unknown[] })?.data)
            ? ((branchesResult as { data: string[] }).data as string[])
            : [];
        const currentBranch =
          typeof currentResult === 'string'
            ? currentResult
            : ((currentResult as { data?: string })?.data as string | undefined);

        setBranches(branchList);
        if (currentBranch && branchList.includes(currentBranch)) {
          setSelectedBaseBranch(currentBranch);
        } else if (branchList.length > 0) {
          setSelectedBaseBranch(branchList[0]);
        } else {
          setSelectedBaseBranch('');
        }
      } catch (error) {
        console.error('[TasksPage] Failed to load branches:', error);
        setBranches([]);
        setSelectedBaseBranch('');
      }
    };

    void loadBranches();
  }, [currentProject?.path, isGitProject]);

  const selectedCliToolName = useMemo(() => {
    if (!selectedCliToolId) return 'CLI 工具';
    const tool = cliTools.find((item) => item.id === selectedCliToolId);
    return tool?.displayName || tool?.name || selectedCliToolId;
  }, [cliTools, selectedCliToolId]);

  const selectedCliConfigName = useMemo(() => {
    if (!selectedCliConfigId) return 'CLI 配置项';
    return cliConfigs.find((item) => item.id === selectedCliConfigId)?.name || 'CLI 配置项';
  }, [cliConfigs, selectedCliConfigId]);

  const selectedWorkflowTemplateName = useMemo(() => {
    if (!selectedWorkflowTemplateId) return '工作流';
    return (
      workflowTemplates.find((item) => item.id === selectedWorkflowTemplateId)?.name ||
      '工作流'
    );
  }, [selectedWorkflowTemplateId, workflowTemplates]);

  const handleSubmit = async (text: string, attachments?: MessageAttachment[]) => {
    const trimmedTitle = taskTitle.trim();
    if (!trimmedTitle) return;
    if (!text.trim() && (!attachments || attachments.length === 0)) return;

    const prompt = text.trim();
    try {
      const settings = getSettings();
      const taskMode = selectedWorkflowTemplateId ? 'workflow' : 'conversation';
      const worktreeBranchPrefix = settings.gitWorktreeBranchPrefix || 'VW-';
      const worktreeRootPath = settings.gitWorktreeDir || '~/.vibework/worktrees';
      const cliToolId = taskMode === 'conversation' ? selectedCliToolId || settings.defaultCliToolId || undefined : undefined;
      const agentToolConfigId = taskMode === 'conversation' ? selectedCliConfigId || undefined : undefined;
      const result = await window.api.task.create({
        title: trimmedTitle,
        prompt,
        taskMode,
        projectId: currentProject?.id,
        projectPath: currentProject?.path,
        createWorktree: !!(isGitProject && currentProject?.path),
        baseBranch: isGitProject ? selectedBaseBranch || undefined : undefined,
        worktreeBranchPrefix,
        worktreeRootPath,
        cliToolId,
        agentToolConfigId,
        workflowTemplateId: taskMode === 'workflow' ? selectedWorkflowTemplateId : undefined,
      });
      if (result.success && result.data) {
        setTaskTitle('');
        navigate(`/task/${result.data.id}`, {
          state: { prompt, attachments },
        });
      }
    } catch (error) {
      console.error('[TasksPage] Failed to create task:', error);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-auto px-6 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="bg-muted flex size-11 items-center justify-center rounded-full">
            <Sparkles className="size-5" />
          </div>
          <h1 className="text-foreground text-4xl font-semibold tracking-tight">我能为你做什么？</h1>
        </div>

        <div className="w-full max-w-3xl">
          <ChatInput
            variant="home"
            titleValue={taskTitle}
            onTitleChange={setTaskTitle}
            titlePlaceholder="标题"
            requireTitle
            placeholder="提示词"
            onSubmit={handleSubmit}
            className="w-full"
            autoFocus
            operationBar={
              <div className="flex flex-wrap items-center gap-2">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="border-border bg-background hover:bg-accent/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors">
                    <Wrench className="size-3.5" />
                    <span className="max-w-[140px] truncate">{selectedCliToolName}</span>
                    <ChevronDown className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8} className="max-h-64 w-56 overflow-auto">
                    {cliTools.map((tool) => (
                      <DropdownMenuItem
                        key={tool.id}
                        onSelect={() => setSelectedCliToolId(tool.id)}
                        className="cursor-pointer"
                      >
                        {tool.displayName || tool.name || tool.id}
                      </DropdownMenuItem>
                    ))}
                    {cliTools.length === 0 && (
                      <DropdownMenuItem disabled>暂无可用 CLI 工具</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    disabled={!selectedCliToolId || cliConfigs.length === 0}
                    className="border-border bg-background hover:bg-accent/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Settings2 className="size-3.5" />
                    <span className="max-w-[140px] truncate">{selectedCliConfigName}</span>
                    <ChevronDown className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8} className="max-h-64 w-56 overflow-auto">
                    {cliConfigs.map((config) => (
                      <DropdownMenuItem
                        key={config.id}
                        onSelect={() => setSelectedCliConfigId(config.id)}
                        className="cursor-pointer"
                      >
                        {config.name}
                      </DropdownMenuItem>
                    ))}
                    {cliConfigs.length === 0 && (
                      <DropdownMenuItem disabled>请先选择 CLI 工具</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    disabled={!isGitProject || branches.length === 0}
                    className="border-border bg-background hover:bg-accent/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <GitBranch className="size-3.5" />
                    <span className="max-w-[140px] truncate">
                      {selectedBaseBranch || '工作流基础分支'}
                    </span>
                    <ChevronDown className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8} className="max-h-64 w-56 overflow-auto">
                    {branches.map((branch) => (
                      <DropdownMenuItem
                        key={branch}
                        onSelect={() => setSelectedBaseBranch(branch)}
                        className="cursor-pointer"
                      >
                        {branch}
                      </DropdownMenuItem>
                    ))}
                    {!isGitProject && <DropdownMenuItem disabled>当前项目不是 Git 仓库</DropdownMenuItem>}
                    {isGitProject && branches.length === 0 && (
                      <DropdownMenuItem disabled>暂无可用分支</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    className={cn(
                      'border-border bg-background hover:bg-accent/60 inline-flex size-8 items-center justify-center rounded-full border transition-colors',
                      selectedWorkflowTemplateId
                        ? 'text-foreground bg-accent/40'
                        : 'text-muted-foreground'
                    )}
                    title={
                      selectedWorkflowTemplateId
                        ? `工作流：${selectedWorkflowTemplateName}`
                        : '不使用工作流'
                    }
                    aria-label={
                      selectedWorkflowTemplateId
                        ? `工作流：${selectedWorkflowTemplateName}`
                        : '选择工作流'
                    }
                  >
                    <Workflow className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={6} className="max-h-64 w-56 overflow-auto">
                    {workflowTemplates.map((template) => (
                      <DropdownMenuItem
                        key={template.id}
                        onSelect={() => setSelectedWorkflowTemplateId(template.id)}
                        className="cursor-pointer"
                      >
                        {template.name}
                      </DropdownMenuItem>
                    ))}
                    {workflowTemplates.length === 0 && (
                      <DropdownMenuItem disabled>暂无可用工作流</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            }
          />
        </div>

      </div>
    </div>
  );
}
