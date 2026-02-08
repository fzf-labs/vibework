import type Database from 'better-sqlite3'
import { getAppPaths } from '../app/AppPaths'
import { newUlid } from '../utils/ids'
import { TaskExecutionService } from './TaskExecutionService'
import { DatabaseConnection } from './database/DatabaseConnection'
import { TaskRepository } from './database/TaskRepository'
import { ProjectRepository } from './database/ProjectRepository'
import { WorkflowRepository } from './database/WorkflowRepository'
import { TaskNodeRepository } from './database/TaskNodeRepository'
import { AgentToolConfigRepository } from './database/AgentToolConfigRepository'
import type { CreateProjectInput, Project, UpdateProjectInput } from '../types/project'
import type {
  CreateTaskInput,
  Task,
  TaskNode,
  TaskNodeStatus,
  UpdateTaskInput
} from '../types/task'
import type {
  CreateWorkflowTemplateInput,
  UpdateWorkflowTemplateInput,
  WorkflowTemplate
} from '../types/workflow'

export class DatabaseService {
  private db: Database.Database
  private connection: DatabaseConnection
  private taskRepo: TaskRepository
  private taskNodeRepo: TaskNodeRepository
  private projectRepo: ProjectRepository
  private workflowRepo: WorkflowRepository
  private agentToolConfigRepo: AgentToolConfigRepository
  private taskExecutionService: TaskExecutionService
  private taskNodeStatusListeners: Array<(node: TaskNode) => void> = []
  private dbPath: string

  constructor() {
    const appPaths = getAppPaths()
    this.dbPath = appPaths.getDatabaseFile()
    console.log('[DatabaseService] Initializing database at:', this.dbPath)

    this.connection = new DatabaseConnection(this.dbPath)
    this.db = this.connection.open()
    this.connection.initTables()

    this.taskRepo = new TaskRepository(this.db)
    this.taskNodeRepo = new TaskNodeRepository(this.db)
    this.projectRepo = new ProjectRepository(this.db)
    this.workflowRepo = new WorkflowRepository(this.db)
    this.agentToolConfigRepo = new AgentToolConfigRepository(this.db)
    this.taskExecutionService = new TaskExecutionService(this.taskRepo, this.taskNodeRepo)
  }

  onTaskNodeStatusChange(listener: (node: TaskNode) => void): () => void {
    this.taskNodeStatusListeners.push(listener)
    return () => {
      this.taskNodeStatusListeners = this.taskNodeStatusListeners.filter(
        (registered) => registered !== listener
      )
    }
  }

  // ============ Task 操作 ============
  createTask(input: CreateTaskInput): Task {
    const task = this.taskRepo.createTask(input)

    const existingNodes = this.taskNodeRepo.getTaskNodes(task.id)
    if (existingNodes.length === 0 && task.task_mode === 'conversation') {
      this.taskNodeRepo.createConversationNode({
        task_id: task.id,
        prompt: task.prompt
      })

      this.taskExecutionService.syncTaskStatus(task.id)
    }

    return this.taskRepo.getTask(task.id)!
  }

  getTask(id: string): Task | null {
    return this.taskRepo.getTask(id)
  }

  getAllTasks(): Task[] {
    return this.taskRepo.getAllTasks()
  }

  getTasksByProjectId(projectId: string): Task[] {
    return this.taskRepo.getTasksByProjectId(projectId)
  }

  updateTask(id: string, updates: UpdateTaskInput): Task | null {
    return this.taskRepo.updateTask(id, updates)
  }

  deleteTask(id: string): boolean {
    return this.taskRepo.deleteTask(id)
  }

  // ============ Task Node 操作 ============
  createConversationNode(
    taskId: string,
    prompt: string,
    cliToolId?: string | null,
    agentToolConfigId?: string | null
  ): TaskNode {
    const node = this.taskNodeRepo.createConversationNode({
      task_id: taskId,
      prompt,
      cli_tool_id: cliToolId ?? null,
      agent_tool_config_id: agentToolConfigId ?? null
    })
    this.taskExecutionService.syncTaskStatus(taskId)
    this.notifyTaskNodeStatusChange(node)
    return node
  }

  createTaskNodesFromTemplate(taskId: string, templateId: string): TaskNode[] {
    const template = this.getWorkflowTemplate(templateId)
    if (!template) {
      throw new Error(`Workflow template not found: ${templateId}`)
    }

    const nodes = template.nodes
      .slice()
      .sort((left, right) => left.node_order - right.node_order)
      .map((node, index) => ({
        id: newUlid(),
        task_id: taskId,
        node_order: Number.isFinite(node.node_order) ? node.node_order : index + 1,
        name: node.name,
        prompt: node.prompt,
        cli_tool_id: node.cli_tool_id ?? null,
        agent_tool_config_id: node.agent_tool_config_id ?? null,
        requires_approval: Boolean(node.requires_approval),
        continue_on_error: Boolean(node.continue_on_error)
      }))

    const createdNodes = this.taskNodeRepo.createNodesFromTemplate(taskId, nodes)
    this.taskExecutionService.syncTaskStatus(taskId)
    return createdNodes
  }

  getTaskNodes(taskId: string): TaskNode[] {
    return this.taskNodeRepo.getTaskNodes(taskId)
  }

  getTaskNode(nodeId: string): TaskNode | null {
    return this.taskNodeRepo.getTaskNode(nodeId)
  }

  getCurrentTaskNode(taskId: string): TaskNode | null {
    return this.taskNodeRepo.getCurrentTaskNode(taskId)
  }

  updateCurrentTaskNodeRuntime(
    taskId: string,
    updates: {
      session_id?: string | null
      cli_tool_id?: string | null
      agent_tool_config_id?: string | null
    }
  ): TaskNode | null {
    const updated = this.taskNodeRepo.updateTaskNodeRuntime(taskId, updates)
    if (updated) {
      this.taskExecutionService.syncTaskStatus(updated.task_id)
      this.notifyTaskNodeStatusChange(updated)
    }
    return updated
  }

  getTaskNodesByStatus(taskId: string, status: TaskNodeStatus): TaskNode[] {
    return this.taskNodeRepo.getTaskNodesByStatus(taskId, status)
  }

  updateTaskNodeSession(nodeId: string, sessionId: string | null): TaskNode | null {
    const updated = this.taskNodeRepo.setNodeSessionId(nodeId, sessionId)
    if (updated) {
      this.taskExecutionService.syncTaskStatus(updated.task_id)
      this.notifyTaskNodeStatusChange(updated)
    }
    return updated
  }

  startTaskExecution(taskId: string): TaskNode | null {
    const updated = this.taskExecutionService.startTaskExecution(taskId)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  stopTaskExecution(taskId: string): TaskNode | null {
    const updated = this.taskExecutionService.stopTaskExecution(taskId)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  completeTaskNode(
    nodeId: string,
    result: {
      resultSummary?: string | null
      cost?: number | null
      duration?: number | null
      sessionId?: string | null
      manualConversationStop?: boolean
      allowConversationCompletion?: boolean
    } = {}
  ): TaskNode | null {
    const updated = this.taskExecutionService.completeTaskNode(nodeId, result)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  markTaskNodeErrorReview(nodeId: string, error: string): TaskNode | null {
    const updated = this.taskExecutionService.markTaskNodeErrorReview(nodeId, error)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  approveTaskNode(nodeId: string): TaskNode | null {
    const updated = this.taskExecutionService.approveTaskNode(nodeId)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  rejectTaskNode(nodeId: string, reason?: string): TaskNode | null {
    const updated = this.taskExecutionService.rejectTaskNode(nodeId, reason)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  retryTaskNode(nodeId: string): TaskNode | null {
    const updated = this.taskExecutionService.retryTaskNode(nodeId)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  cancelTaskNode(nodeId: string): TaskNode | null {
    const updated = this.taskExecutionService.cancelTaskNode(nodeId)
    if (updated) this.notifyTaskNodeStatusChange(updated)
    return updated
  }

  getTaskIdBySessionId(sessionId: string): string | null {
    return this.taskNodeRepo.getTaskIdBySessionId(sessionId)
  }

  getCombinedPromptForTaskNode(taskNodeId: string): string | null {
    const node = this.getTaskNode(taskNodeId)
    if (!node) return null

    const task = this.getTask(node.task_id)
    if (!task) return null

    const nodePrompt = node.prompt || ''
    if (nodePrompt) {
      return `${task.prompt}\n\n${nodePrompt}`
    }
    return task.prompt
  }

  // ============ Agent Tool Config 操作 ============
  listAgentToolConfigs(toolId?: string) {
    return this.agentToolConfigRepo.list(toolId)
  }

  getAgentToolConfig(id: string) {
    return this.agentToolConfigRepo.get(id)
  }

  getDefaultAgentToolConfig(toolId: string) {
    return this.agentToolConfigRepo.getDefault(toolId)
  }

  createAgentToolConfig(input: {
    id: string
    tool_id: string
    name: string
    description?: string | null
    config_json: string
    is_default?: number
  }) {
    return this.agentToolConfigRepo.create(input)
  }

  updateAgentToolConfig(
    id: string,
    updates: {
      name?: string
      description?: string | null
      config_json?: string
      is_default?: number
    }
  ) {
    return this.agentToolConfigRepo.update(id, updates)
  }

  deleteAgentToolConfig(id: string) {
    return this.agentToolConfigRepo.delete(id)
  }

  setDefaultAgentToolConfig(id: string) {
    return this.agentToolConfigRepo.setDefault(id)
  }

  // ============ Project 操作 ============
  createProject(input: CreateProjectInput): Project {
    return this.projectRepo.createProject(input)
  }

  getProject(id: string): Project | null {
    return this.projectRepo.getProject(id)
  }

  getProjectByPath(path: string): Project | null {
    return this.projectRepo.getProjectByPath(path)
  }

  getAllProjects(): Project[] {
    return this.projectRepo.getAllProjects()
  }

  updateProject(id: string, updates: UpdateProjectInput): Project | null {
    return this.projectRepo.updateProject(id, updates)
  }

  deleteProject(id: string): boolean {
    const project = this.projectRepo.getProject(id)
    if (!project) return false

    this.taskRepo.deleteTasksByProjectId(id)
    this.workflowRepo.deleteWorkflowTemplatesByProject(id)

    return this.projectRepo.deleteProject(id)
  }

  // ============ Workflow Template 操作 ============
  createWorkflowTemplate(input: CreateWorkflowTemplateInput): WorkflowTemplate {
    return this.workflowRepo.createWorkflowTemplate(input)
  }

  getGlobalWorkflowTemplates(): WorkflowTemplate[] {
    return this.workflowRepo.getGlobalWorkflowTemplates()
  }

  getWorkflowTemplatesByProject(projectId: string): WorkflowTemplate[] {
    return this.workflowRepo.getWorkflowTemplatesByProject(projectId)
  }

  getWorkflowTemplate(id: string): WorkflowTemplate | null {
    return this.workflowRepo.getWorkflowTemplate(id)
  }

  updateWorkflowTemplate(input: UpdateWorkflowTemplateInput): WorkflowTemplate {
    return this.workflowRepo.updateWorkflowTemplate(input)
  }

  deleteWorkflowTemplate(id: string, scope: 'global' | 'project'): boolean {
    return this.workflowRepo.deleteWorkflowTemplate(id, scope)
  }

  copyGlobalWorkflowToProject(globalTemplateId: string, projectId: string): WorkflowTemplate {
    return this.workflowRepo.copyGlobalWorkflowToProject(globalTemplateId, projectId)
  }


  // ============ 清理和关闭 ============
  close(): void {
    console.log('[DatabaseService] Closing database connection')
    this.connection.close()
  }

  dispose(): void {
    this.close()
  }

  private notifyTaskNodeStatusChange(node: TaskNode): void {
    this.taskNodeStatusListeners.forEach((listener) => {
      try {
        listener(node)
      } catch (error) {
        console.error('[DatabaseService] Task node status listener failed:', error)
      }
    })
  }

}
