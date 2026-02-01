import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db, type Task, type TaskStatus } from '@/data';
import { useLogStream } from '@/hooks/useLogStream';
import { getSessionsDir } from '@/lib/paths';
import { useLanguage } from '@/providers/language-provider';
import { SidebarProvider } from '@/components/layout';
import { LeftSidebar } from '@/components/layout';
import { TaskMetadataPanel } from '@/components/task/TaskMetadataPanel';
import { WorkflowProgressBar } from '@/components/task/WorkflowProgressBar';
import { WorkNodeReviewPanel } from '@/components/task/WorkNodeReviewPanel';
import { CLISession } from '@/components/cli';
import { TerminalOutput } from '@/components/cli/TerminalOutput';
import { NormalizedLogView } from '@/components/cli/NormalizedLogView';
import { Button } from '@/components/ui/button';

interface Workflow {
  id: string;
  task_id: string;
  current_node_index: number;
  status: 'todo' | 'in_progress' | 'done';
}

interface WorkNode {
  id: string;
  workflow_id: string;
  node_order: number;
  name: string;
  prompt: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  requires_approval: boolean;
  continue_on_error: boolean;
}

interface AgentExecution {
  id: string;
  execution_index: number;
  status: 'idle' | 'running' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  cost: number | null;
  duration: number | null;
}

export function TaskDetailPage() {
  return (
    <SidebarProvider>
      <TaskDetailContent />
    </SidebarProvider>
  );
}

function TaskDetailContent() {
  const { t } = useLanguage();
  const { taskId } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [workNodes, setWorkNodes] = useState<WorkNode[]>([]);
  const [reviewExecutions, setReviewExecutions] = useState<AgentExecution[]>([]);
  const [sessionsDir, setSessionsDir] = useState<string>('');

  const sessionId = task?.session_id || null;
  const { rawLogs, normalizedLogs } = useLogStream(sessionId);

  useEffect(() => {
    let cancelled = false;
    const loadTask = async () => {
      if (!taskId) return;
      try {
        const data = await db.getTask(taskId);
        if (!cancelled) {
          setTask(data);
        }
      } catch (error) {
        console.error('[TaskDetail] Failed to load task:', error);
      }
    };
    loadTask();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    let cancelled = false;
    const loadWorkflow = async () => {
      if (!task?.id) return;
      try {
        const wf = (await db.getWorkflowByTaskId(task.id)) as Workflow | null;
        if (cancelled) return;
        setWorkflow(wf);
        if (!wf) {
          setWorkNodes([]);
          return;
        }
        const nodes = (await db.getWorkNodesByWorkflowId(wf.id)) as WorkNode[];
        if (!cancelled) {
          setWorkNodes(nodes || []);
        }
      } catch (error) {
        console.error('[TaskDetail] Failed to load workflow:', error);
      }
    };

    loadWorkflow();
    const timer = setInterval(loadWorkflow, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [task?.id]);

  useEffect(() => {
    if (!sessionId) return;
    getSessionsDir()
      .then((dir) => setSessionsDir(dir))
      .catch((error) => {
        console.error('[TaskDetail] Failed to resolve sessions dir:', error);
      });
  }, [sessionId]);

  const reviewNode = useMemo(
    () => workNodes.find((node) => node.status === 'in_review') || null,
    [workNodes]
  );

  useEffect(() => {
    let cancelled = false;
    const loadExecutions = async () => {
      if (!reviewNode) {
        setReviewExecutions([]);
        return;
      }
      try {
        const executions = (await db.getAgentExecutionsByWorkNodeId(
          reviewNode.id
        )) as AgentExecution[];
        if (!cancelled) {
          setReviewExecutions(executions || []);
        }
      } catch (error) {
        console.error('[TaskDetail] Failed to load executions:', error);
      }
    };
    loadExecutions();
    return () => {
      cancelled = true;
    };
  }, [reviewNode]);

  const terminalLines = useMemo(() => {
    return rawLogs
      .filter((log) => log.type === 'stdout' || log.type === 'stderr')
      .map((log) => ({
        type: log.type,
        content: log.content || '',
        timestamp: new Date(log.created_at || log.timestamp || Date.now())
      }));
  }, [rawLogs]);

  const workdir = useMemo(() => {
    if (!task) return '';
    return (
      task.workspace_path ||
      task.worktree_path ||
      (sessionId && sessionsDir ? `${sessionsDir}/${sessionId}` : '')
    );
  }, [sessionId, sessionsDir, task]);

  const handleStatusChange = async (status: TaskStatus) => {
    if (!task?.id) return;
    try {
      const updated = await db.updateTask(task.id, { status });
      if (updated) {
        setTask(updated as Task);
      }
    } catch (error) {
      console.error('[TaskDetail] Failed to update task status:', error);
    }
  };

  const handleApproveNode = async () => {
    if (!reviewNode) return;
    try {
      await db.approveWorkNode(reviewNode.id);
    } catch (error) {
      console.error('[TaskDetail] Failed to approve node:', error);
    }
  };

  const handleRejectNode = async () => {
    if (!reviewNode) return;
    try {
      await db.rejectWorkNode(reviewNode.id);
    } catch (error) {
      console.error('[TaskDetail] Failed to reject node:', error);
    }
  };

  const allNodesDone = workNodes.length > 0 && workNodes.every((n) => n.status === 'done');

  return (
    <div className="flex h-screen">
      <LeftSidebar />
      <main className="flex-1 overflow-hidden">
        <div className="flex h-full flex-col gap-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-foreground text-xl font-semibold">
                {task?.title || task?.prompt || t.task?.detailTitle || 'Task'}
              </h1>
              {task?.prompt && (
                <p className="text-muted-foreground text-sm mt-1 max-w-3xl">
                  {task.prompt}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {task?.status === 'in_review' && (
                <Button size="sm" onClick={() => handleStatusChange('done')}>
                  {t.task?.confirmComplete || 'Mark done'}
                </Button>
              )}
              {task?.status === 'in_progress' && allNodesDone && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatusChange('in_review')}
                >
                  {t.task?.pendingApproval || 'Mark in review'}
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="space-y-4">
              <TaskMetadataPanel task={task} />
              {workflow && workNodes.length > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Workflow</p>
                  <WorkflowProgressBar
                    nodes={workNodes}
                    currentNodeIndex={workflow.current_node_index}
                  />
                </div>
              )}
              {reviewNode && (
                <WorkNodeReviewPanel
                  node={reviewNode}
                  executions={reviewExecutions}
                  onApprove={handleApproveNode}
                  onReject={handleRejectNode}
                />
              )}
            </div>

            <div className="flex flex-col gap-4">
              {task?.cli_tool_id && workdir && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-muted-foreground">CLI Session</p>
                    <span className="text-xs text-muted-foreground">{task.cli_tool_id}</span>
                  </div>
                  <CLISession
                    sessionId={task.session_id}
                    toolId={task.cli_tool_id}
                    workdir={workdir}
                    prompt={task.prompt}
                    compact
                    allowStart
                  />
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Raw Output</p>
                  <div className="h-64">
                    <TerminalOutput
                      lines={terminalLines}
                      className="h-full"
                      autoScroll
                      virtualized
                    />
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Normalized Logs</p>
                  <div className="h-64 overflow-auto">
                    <NormalizedLogView entries={normalizedLogs} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
