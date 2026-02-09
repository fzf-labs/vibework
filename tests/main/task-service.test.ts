import { describe, expect, it, vi } from 'vitest'
import { TaskService } from '../../src/main/services/TaskService'

type MockDbTaskInput = {
  id: string
  title: string
  prompt: string
  task_mode: 'conversation' | 'workflow'
  project_id?: string
  worktree_path?: string
  branch_name?: string
  base_branch?: string
  workspace_path?: string
}

const makeDbTask = (input: MockDbTaskInput) => ({
  id: input.id,
  title: input.title,
  prompt: input.prompt,
  status: 'todo',
  task_mode: input.task_mode,
  project_id: input.project_id ?? null,
  worktree_path: input.worktree_path ?? null,
  branch_name: input.branch_name ?? null,
  base_branch: input.base_branch ?? null,
  workspace_path: input.workspace_path ?? null,
  started_at: null,
  completed_at: null,
  cost: null,
  duration: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
})

const createTaskServiceDeps = () => {
  const createTask = vi.fn((input: MockDbTaskInput) => makeDbTask(input))
  const getTask = vi.fn((taskId: string) =>
    makeDbTask({
      id: taskId,
      title: 'Task',
      prompt: 'Prompt',
      task_mode: 'workflow'
    })
  )

  const db = {
    getDefaultAgentToolConfig: vi.fn(() => ({ id: 'cfg-default' })),
    createTask,
    updateCurrentTaskNodeRuntime: vi.fn(),
    createTaskNodesFromTemplate: vi.fn(),
    getTask
  }

  const git = {
    addWorktree: vi.fn()
  }

  return { db, git }
}

describe('TaskService workflow runtime fallback', () => {
  it('passes CLI runtime fallback when creating workflow task', async () => {
    const { db, git } = createTaskServiceDeps()
    const service = new TaskService(db as any, git as any)

    await service.createTask({
      title: 'Workflow task',
      prompt: 'Task prompt',
      taskMode: 'workflow',
      workflowTemplateId: 'tpl-1',
      cliToolId: 'codex'
    })

    expect(db.createTask).toHaveBeenCalledTimes(1)
    const createdTaskId = db.createTask.mock.calls[0][0].id

    expect(db.createTaskNodesFromTemplate).toHaveBeenCalledWith(
      createdTaskId,
      'tpl-1',
      {
        cliToolId: 'codex',
        agentToolConfigId: 'cfg-default'
      }
    )
  })

  it('uses explicit agent config for workflow fallback', async () => {
    const { db, git } = createTaskServiceDeps()
    const service = new TaskService(db as any, git as any)

    await service.createTask({
      title: 'Workflow task',
      prompt: 'Task prompt',
      taskMode: 'workflow',
      workflowTemplateId: 'tpl-1',
      cliToolId: 'codex',
      agentToolConfigId: 'cfg-custom'
    })

    expect(db.getDefaultAgentToolConfig).not.toHaveBeenCalled()
    const createdTaskId = db.createTask.mock.calls[0][0].id
    expect(db.createTaskNodesFromTemplate).toHaveBeenCalledWith(
      createdTaskId,
      'tpl-1',
      {
        cliToolId: 'codex',
        agentToolConfigId: 'cfg-custom'
      }
    )
  })

  it('rejects unsupported task status updates', () => {
    const { db, git } = createTaskServiceDeps()
    const service = new TaskService(db as any, git as any)

    expect(() => service.updateTaskStatus('task-1', 'cancelled' as any)).toThrow(
      'Unsupported task status: cancelled'
    )
  })
})
