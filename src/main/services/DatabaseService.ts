import type Database from 'better-sqlite3'
import { dialog } from 'electron'
import { getAppPaths } from '../app/AppPaths'
import { DatabaseConnection } from './database/DatabaseConnection'
import { DatabaseMaintenance } from './database/DatabaseMaintenance'
import { TaskRepository } from './database/TaskRepository'
import { ProjectRepository } from './database/ProjectRepository'
import { WorkflowRepository } from './database/WorkflowRepository'
import { AgentRepository } from './database/AgentRepository'
import type { CreateProjectInput, Project, UpdateProjectInput } from '../types/project'
import type { CreateTaskInput, Task, UpdateTaskInput } from '../types/task'
import type { AgentExecution } from '../types/agent'
import type {
  CreateWorkflowTemplateInput,
  UpdateWorkflowTemplateInput,
  Workflow,
  WorkflowTemplate,
  WorkNode,
  WorkNodeTemplate
} from '../types/workflow'

export class DatabaseService {
  private db: Database.Database
  private connection: DatabaseConnection
  private maintenance: DatabaseMaintenance
  private taskRepo: TaskRepository
  private projectRepo: ProjectRepository
  private workflowRepo: WorkflowRepository
  private agentRepo: AgentRepository
  private workNodeStatusListeners: Array<(node: WorkNode) => void> = []
  private dbPath: string

  constructor() {
    const appPaths = getAppPaths()
    this.dbPath = appPaths.getDatabaseFile()
    this.maintenance = new DatabaseMaintenance(appPaths)
    this.maintenance.handleLegacyDatabase(this.dbPath)
    console.log('[DatabaseService] Initializing database at:', this.dbPath)

    this.connection = new DatabaseConnection(this.dbPath)
    try {
      this.db = this.connection.open()
    } catch (error) {
      if (this.maintenance.hasBackup()) {
        console.error('[DatabaseService] Failed to open database, restoring backup:', error)
        this.maintenance.restoreBackup()
        dialog.showErrorBox(
          'Database Open Failed',
          'Failed to open the database after migration. The backup has been restored.'
        )
      }
      throw error
    }

    try {
      this.connection.initTables()
    } catch (error) {
      if (this.maintenance.hasBackup()) {
        console.error('[DatabaseService] Failed to initialize tables, restoring backup:', error)
        this.maintenance.restoreBackup()
        dialog.showErrorBox(
          'Database Initialization Failed',
          'Failed to initialize the database. The backup has been restored.'
        )
      }
      throw error
    }

    this.taskRepo = new TaskRepository(this.db)
    this.projectRepo = new ProjectRepository(this.db)
    this.workflowRepo = new WorkflowRepository(this.db)
    this.agentRepo = new AgentRepository(this.db)
  }

  onWorkNodeStatusChange(listener: (node: WorkNode) => void): () => void {
    this.workNodeStatusListeners.push(listener)
    return () => {
      this.workNodeStatusListeners = this.workNodeStatusListeners.filter(
        (registered) => registered !== listener
      )
    }
  }

  // ============ Task 操作 ============
  createTask(input: CreateTaskInput): Task {
    return this.taskRepo.createTask(input)
  }

  getTask(id: string): Task | null {
    return this.taskRepo.getTask(id)
  }

  getTaskBySessionId(sessionId: string): Task | null {
    return this.taskRepo.getTaskBySessionId(sessionId)
  }

  getAllTasks(): Task[] {
    return this.taskRepo.getAllTasks()
  }

  getTasksByProjectId(projectId: string): Task[] {
    return this.taskRepo.getTasksByProjectId(projectId)
  }

  updateTask(id: string, updates: UpdateTaskInput): Task | null {
    const currentTask = this.taskRepo.getTask(id)
    if (!currentTask) return null

    const oldStatus = currentTask.status
    const newStatus = updates.status

    const updated = this.taskRepo.updateTask(id, updates)

    // 状态变更触发：todo → in_progress 时自动实例化工作流
    if (oldStatus === 'todo' && newStatus === 'in_progress') {
      this.onTaskStarted(id, currentTask)
    }

    return updated
  }

  deleteTask(id: string): boolean {
    return this.taskRepo.deleteTask(id)
  }

  // ============ 任务状态变更触发 ============
  private onTaskStarted(taskId: string, task: Task): void {
    const templateId = task.workflow_template_id
    if (!templateId) return

    const existing = this.getWorkflowByTaskId(taskId)
    const workflow = existing ?? this.ensureWorkflowFromTemplate(taskId, templateId)
    if (!workflow) return

    // 启动第一个节点
    this.updateWorkflowStatus(workflow.id, 'in_progress')
    const nodes = this.getWorkNodesByWorkflowId(workflow.id)
    if (nodes.length > 0) {
      this.startWorkNode(nodes[0].id)
    }
  }

  private ensureWorkflowFromTemplate(taskId: string, templateId: string): Workflow | null {
    const template = this.getWorkflowTemplate(templateId)
    if (!template) return null

    const workflow = this.createWorkflow(taskId)
    for (const nodeTemplate of template.nodes) {
      this.createWorkNodeFromTemplate(workflow.id, nodeTemplate)
    }

    return this.getWorkflow(workflow.id)
  }

  seedWorkflowForTask(taskId: string, templateId: string): Workflow | null {
    const existing = this.getWorkflowByTaskId(taskId)
    if (existing) return existing
    return this.ensureWorkflowFromTemplate(taskId, templateId)
  }

  private startWorkNode(workNodeId: string): void {
    this.updateWorkNodeStatus(workNodeId, 'in_progress')
    this.createAgentExecution(workNodeId)
  }

  syncTaskStatusFromWorkflow(workflowId: string): void {
    const workflow = this.getWorkflow(workflowId)
    if (!workflow) return

    const taskStatus = this.deriveTaskStatusFromWorkflow(workflow)
    if (taskStatus) {
      this.taskRepo.updateTaskStatus(workflow.task_id, taskStatus)
    }
  }

  private deriveTaskStatusFromWorkflow(workflow: Workflow): string | null {
    const nodes = this.getWorkNodesByWorkflowId(workflow.id)
    if (nodes.length === 0) return null

    // 原则2: Work Node → Task 自动联动
    // 1. 任意 Work Node = in_progress → Task in_progress
    const hasInProgressNode = nodes.some(n => n.status === 'in_progress')
    if (hasInProgressNode) return 'in_progress'

    // 2. 任意 Work Node = in_review 且无 in_progress → Task in_progress
    const hasReviewNode = nodes.some(n => n.status === 'in_review')
    if (hasReviewNode) return 'in_progress'

    // All nodes completed → Task in_review (await final approval)
    const allDone = nodes.every(n => n.status === 'done')
    if (allDone || workflow.status === 'done') return 'in_review'

    return null
  }

  completeWorkNode(workNodeId: string, requiresApproval: boolean): void {
    if (requiresApproval) {
      this.updateWorkNodeStatus(workNodeId, 'in_review')
    } else {
      this.finalizeWorkNode(workNodeId)
    }
  }

  private finalizeWorkNode(workNodeId: string): void {
    this.updateWorkNodeStatus(workNodeId, 'done')

    const node = this.getWorkNode(workNodeId)
    if (!node) return

    const workflow = this.getWorkflow(node.workflow_id)
    if (!workflow) return

    this.advanceToNextNode(workflow)
  }

  private advanceToNextNode(workflow: Workflow): void {
    const nodes = this.getWorkNodesByWorkflowId(workflow.id)
    const nextIndex = workflow.current_node_index + 1

    if (nextIndex >= nodes.length) {
      // 所有节点完成
      this.updateWorkflowStatus(workflow.id, 'done')
      this.syncTaskStatusFromWorkflow(workflow.id)
      return
    }

    // 推进到下一个节点
    this.updateWorkflowStatus(workflow.id, 'in_progress', nextIndex)
    this.startWorkNode(nodes[nextIndex].id)
    this.syncTaskStatusFromWorkflow(workflow.id)
  }

  approveWorkNode(workNodeId: string): void {
    this.finalizeWorkNode(workNodeId)
  }

  rejectWorkNode(workNodeId: string): void {
    this.startWorkNode(workNodeId)
  }

  /**
   * 原则3: 用户审核任务通过 → Task: in_review → done
   */
  approveTask(taskId: string): boolean {
    const task = this.getTask(taskId)
    if (!task || task.status !== 'in_review') return false

    this.taskRepo.updateTaskStatus(taskId, 'done')
    return true
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

  getWorkNodeTemplate(templateNodeId: string): WorkNodeTemplate | null {
    return this.workflowRepo.getWorkNodeTemplate(templateNodeId)
  }

  /**
   * 获取工作节点的组合提示词（任务提示词 + 节点提示词）
   */
  getCombinedPromptForWorkNode(workNodeId: string): string | null {
    const workNode = this.getWorkNode(workNodeId)
    if (!workNode) return null

    const workflow = this.getWorkflow(workNode.workflow_id)
    if (!workflow) return null

    const task = this.getTask(workflow.task_id)
    if (!task) return null

    const nodePrompt = workNode.prompt || ''
    if (nodePrompt) {
      return `${task.prompt}\n\n${nodePrompt}`
    }
    return task.prompt
  }

  // ============ Workflow 实例操作 ============
  createWorkflow(taskId: string): Workflow {
    return this.workflowRepo.createWorkflow(taskId)
  }

  getWorkflow(id: string): Workflow | null {
    return this.workflowRepo.getWorkflow(id)
  }

  getWorkflowByTaskId(taskId: string): Workflow | null {
    return this.workflowRepo.getWorkflowByTaskId(taskId)
  }

  updateWorkflowStatus(id: string, status: string, nodeIndex?: number): Workflow | null {
    return this.workflowRepo.updateWorkflowStatus(id, status, nodeIndex)
  }

  // ============ WorkNode 实例操作 ============
  createWorkNodeFromTemplate(workflowId: string, template: WorkNodeTemplate): WorkNode {
    return this.workflowRepo.createWorkNodeFromTemplate(workflowId, template)
  }

  createWorkNode(workflowId: string, templateId: string, nodeOrder: number): WorkNode {
    return this.workflowRepo.createWorkNode(workflowId, templateId, nodeOrder)
  }

  getWorkNode(id: string): WorkNode | null {
    return this.workflowRepo.getWorkNode(id)
  }

  getWorkNodesByWorkflowId(workflowId: string): WorkNode[] {
    return this.workflowRepo.getWorkNodesByWorkflowId(workflowId)
  }

  updateWorkNodeStatus(id: string, status: string): WorkNode | null {
    const updatedNode = this.workflowRepo.updateWorkNodeStatus(id, status)
    if (updatedNode) {
      this.workNodeStatusListeners.forEach((listener) => {
        try {
          listener(updatedNode)
        } catch (error) {
          console.error('[DatabaseService] Work node status listener failed:', error)
        }
      })
    }
    return updatedNode
  }

  // ============ AgentExecution 操作 ============
  createAgentExecution(workNodeId: string): AgentExecution {
    return this.agentRepo.createAgentExecution(workNodeId)
  }

  getAgentExecution(id: string): AgentExecution | null {
    return this.agentRepo.getAgentExecution(id)
  }

  getAgentExecutionsByWorkNodeId(workNodeId: string): AgentExecution[] {
    return this.agentRepo.getAgentExecutionsByWorkNodeId(workNodeId)
  }

  getLatestAgentExecution(workNodeId: string): AgentExecution | null {
    return this.agentRepo.getLatestAgentExecution(workNodeId)
  }

  updateAgentExecutionStatus(
    id: string,
    status: 'idle' | 'running' | 'completed',
    cost?: number,
    duration?: number
  ): AgentExecution | null {
    const execution = this.agentRepo.updateAgentExecutionStatus(id, status, cost, duration)

    // 原则1: Agent CLI → Work Node 自动联动（idle 除外）
    if (execution && status !== 'idle') {
      this.syncWorkNodeFromAgentStatus(execution.work_node_id, status)
    }

    return execution
  }

  /**
   * 原则1: Agent CLI 状态同步到 Work Node
   * - running → in_progress
   * - completed → in_review
   */
  private syncWorkNodeFromAgentStatus(workNodeId: string, agentStatus: 'running' | 'completed'): void {
    const workNode = this.getWorkNode(workNodeId)
    if (!workNode) return
    if (workNode.status === 'done') return

    const workNodeStatus = agentStatus === 'running' ? 'in_progress' : 'in_review'
    this.updateWorkNodeStatus(workNodeId, workNodeStatus)

    // 同步更新 Task 状态
    this.syncTaskStatusFromWorkflow(workNode.workflow_id)
  }

  // ============ 清理和关闭 ============
  close(): void {
    console.log('[DatabaseService] Closing database connection')
    this.connection.close()
  }

  dispose(): void {
    this.close()
  }
}
