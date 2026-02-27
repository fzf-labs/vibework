import {
  notifyTaskCompleted,
  notifyTaskNeedsReview,
  playTaskReviewSound
} from '@/lib/notifications'
import type { CreateTaskInput, Task, TaskNode, UpdateTaskInput } from './types'
import type { Automation, AutomationRun } from './types'

export const db = {
  createTask: (input: CreateTaskInput): Promise<Task> => {
    return window.api.database.createTask(input) as Promise<Task>
  },

  getTask: (id: string): Promise<Task | null> => {
    return window.api.database.getTask(id) as Promise<Task | null>
  },

  getAllTasks: (): Promise<Task[]> => {
    return window.api.database.getAllTasks() as Promise<Task[]>
  },

  updateTask: async (id: string, updates: UpdateTaskInput): Promise<Task | null> => {
    const updatedTask = (await window.api.database.updateTask(id, updates)) as Task | null
    console.info('[NotifyDebug][renderer] db.updateTask result', {
      taskId: id,
      requestedStatus: updates.status,
      updatedStatus: updatedTask?.status
    })

    if (updates.status === 'done' && updatedTask?.status === 'done') {
      const taskTitle = updatedTask.title || updatedTask.prompt || undefined
      console.info('[NotifyDebug][renderer] Trigger task-complete notification', {
        taskId: id,
        taskTitle
      })
      void notifyTaskCompleted(taskTitle)
    }

    if (updates.status === 'in_review' && updatedTask?.status === 'in_review') {
      const taskTitle = updatedTask.title || updatedTask.prompt || undefined
      console.info('[NotifyDebug][renderer] Trigger task-review notification and sound', {
        taskId: id,
        taskTitle
      })
      void notifyTaskNeedsReview(taskTitle)
      void playTaskReviewSound()
    }

    return updatedTask
  },

  deleteTask: (id: string, removeWorktree: boolean = true): Promise<boolean> => {
    return window.api.task.delete(id, removeWorktree)
  },

  listAgentToolConfigs: (toolId?: string): Promise<unknown[]> => {
    return window.api.database.listAgentToolConfigs(toolId) as Promise<unknown[]>
  },

  getAgentToolConfig: (id: string): Promise<unknown> => {
    return window.api.database.getAgentToolConfig(id) as Promise<unknown>
  },

  createAgentToolConfig: (input: unknown): Promise<unknown> => {
    return window.api.database.createAgentToolConfig(input) as Promise<unknown>
  },

  updateAgentToolConfig: (id: string, updates: unknown): Promise<unknown> => {
    return window.api.database.updateAgentToolConfig(id, updates) as Promise<unknown>
  },

  deleteAgentToolConfig: (id: string): Promise<unknown> => {
    return window.api.database.deleteAgentToolConfig(id) as Promise<unknown>
  },

  setDefaultAgentToolConfig: (id: string): Promise<unknown> => {
    return window.api.database.setDefaultAgentToolConfig(id) as Promise<unknown>
  },

  getGlobalWorkflowTemplates: (): Promise<unknown[]> => {
    return window.api.database.getGlobalWorkflowTemplates() as Promise<unknown[]>
  },

  getWorkflowTemplatesByProject: (projectId: string): Promise<unknown[]> => {
    return window.api.database.getWorkflowTemplatesByProject(projectId) as Promise<unknown[]>
  },

  getWorkflowTemplate: (templateId: string): Promise<unknown> => {
    return window.api.database.getWorkflowTemplate(templateId) as Promise<unknown>
  },

  createWorkflowTemplate: (input: unknown): Promise<unknown> => {
    return window.api.database.createWorkflowTemplate(input) as Promise<unknown>
  },

  updateWorkflowTemplate: (input: unknown): Promise<unknown> => {
    return window.api.database.updateWorkflowTemplate(input) as Promise<unknown>
  },

  deleteWorkflowTemplate: (templateId: string, scope: string): Promise<boolean> => {
    return window.api.database.deleteWorkflowTemplate(templateId, scope) as Promise<boolean>
  },

  copyGlobalWorkflowToProject: (globalTemplateId: string, projectId: string): Promise<unknown> => {
    return window.api.database.copyGlobalWorkflowToProject(globalTemplateId, projectId) as Promise<unknown>
  },

  getTaskNodes: (taskId: string): Promise<TaskNode[]> => {
    return window.api.database.getTaskNodes(taskId) as Promise<TaskNode[]>
  },

  getTaskNode: (nodeId: string): Promise<TaskNode | null> => {
    return window.api.database.getTaskNode(nodeId) as Promise<TaskNode | null>
  },

  getCurrentTaskNode: (taskId: string): Promise<TaskNode | null> => {
    return window.api.database.getCurrentTaskNode(taskId) as Promise<TaskNode | null>
  },

  updateCurrentTaskNodeRuntime: (
    taskId: string,
    updates: {
      session_id?: string | null
      resume_session_id?: string | null
      cli_tool_id?: string | null
      agent_tool_config_id?: string | null
    }
  ): Promise<TaskNode | null> => {
    return window.api.database.updateCurrentTaskNodeRuntime(taskId, updates) as Promise<TaskNode | null>
  },

  getTaskNodesByStatus: (taskId: string, status: string): Promise<TaskNode[]> => {
    return window.api.database.getTaskNodesByStatus(taskId, status) as Promise<TaskNode[]>
  },

  completeTaskNode: (
    nodeId: string,
    result?: {
      resultSummary?: string | null
      cost?: number | null
      duration?: number | null
      sessionId?: string | null
    }
  ): Promise<unknown> => {
    return window.api.database.completeTaskNode(nodeId, result) as Promise<unknown>
  },

  markTaskNodeErrorReview: (nodeId: string, error: string): Promise<unknown> => {
    return window.api.database.markTaskNodeErrorReview(nodeId, error) as Promise<unknown>
  },

  approveTaskNode: (nodeId: string): Promise<unknown> => {
    return window.api.database.approveTaskNode(nodeId) as Promise<unknown>
  },

  rerunTaskNode: (nodeId: string): Promise<unknown> => {
    return window.api.database.rerunTaskNode(nodeId) as Promise<unknown>
  },

  stopTaskNodeExecution: (nodeId: string, reason?: string): Promise<unknown> => {
    return window.api.database.stopTaskNodeExecution(nodeId, reason) as Promise<unknown>
  },

  startTaskExecution: (taskId: string): Promise<unknown> => {
    return window.api.task.startExecution(taskId) as Promise<unknown>
  },

  stopTaskExecution: (taskId: string): Promise<unknown> => {
    return window.api.task.stopExecution(taskId) as Promise<unknown>
  },

  createAutomation: (input: Record<string, unknown>): Promise<Automation> => {
    return window.api.automation.create(input) as Promise<Automation>
  },

  updateAutomation: (id: string, updates: Record<string, unknown>): Promise<Automation | null> => {
    return window.api.automation.update(id, updates) as Promise<Automation | null>
  },

  deleteAutomation: (id: string): Promise<boolean> => {
    return window.api.automation.delete(id)
  },

  getAutomation: (id: string): Promise<Automation | null> => {
    return window.api.automation.get(id) as Promise<Automation | null>
  },

  listAutomations: (): Promise<Automation[]> => {
    return window.api.automation.list() as Promise<Automation[]>
  },

  setAutomationEnabled: (id: string, enabled: boolean): Promise<Automation | null> => {
    return window.api.automation.setEnabled(id, enabled) as Promise<Automation | null>
  },

  runAutomationNow: (id: string): Promise<{ runId: string; status: string }> => {
    return window.api.automation.runNow(id) as Promise<{ runId: string; status: string }>
  },

  listAutomationRuns: (automationId: string, limit = 100): Promise<AutomationRun[]> => {
    return window.api.automation.listRuns(automationId, limit) as Promise<AutomationRun[]>
  }
}
