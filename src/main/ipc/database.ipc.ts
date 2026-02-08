import type { IpcModuleContext } from './types'
import type { DatabaseService } from '../services/DatabaseService'
import type { TaskNodeStatus } from '../types/task'
import { IPC_CHANNELS } from './channels'

export const registerDatabaseIpc = ({
  handle,
  v,
  services,
  taskNodeStatusValues
}: IpcModuleContext): void => {
  const { databaseService } = services

  handle(IPC_CHANNELS.database.createTask, [v.object()], (_, input) =>
    databaseService.createTask(input as unknown as Parameters<DatabaseService['createTask']>[0])
  )

  handle(IPC_CHANNELS.database.getTask, [v.string()], (_, id) => databaseService.getTask(id))

  handle(IPC_CHANNELS.database.getAllTasks, [], () => databaseService.getAllTasks())

  handle(IPC_CHANNELS.database.updateTask, [v.string(), v.object()], (_, id, updates) =>
    databaseService.updateTask(
      id,
      updates as unknown as Parameters<DatabaseService['updateTask']>[1]
    )
  )

  handle(IPC_CHANNELS.database.deleteTask, [v.string()], (_, id) => databaseService.deleteTask(id))

  handle(IPC_CHANNELS.database.getTasksByProjectId, [v.string()], (_, projectId) =>
    databaseService.getTasksByProjectId(projectId)
  )

  handle(
    IPC_CHANNELS.database.listAgentToolConfigs,
    [v.optional(v.string({ allowEmpty: true }))],
    (_, toolId) => databaseService.listAgentToolConfigs(toolId || undefined)
  )

  handle(IPC_CHANNELS.database.getAgentToolConfig, [v.string()], (_, id) =>
    databaseService.getAgentToolConfig(id)
  )

  handle(IPC_CHANNELS.database.createAgentToolConfig, [v.object()], (_, input) =>
    databaseService.createAgentToolConfig(
      input as unknown as Parameters<DatabaseService['createAgentToolConfig']>[0]
    )
  )

  handle(
    IPC_CHANNELS.database.updateAgentToolConfig,
    [v.string(), v.object()],
    (_, id, updates) =>
      databaseService.updateAgentToolConfig(
        id,
        updates as unknown as Parameters<DatabaseService['updateAgentToolConfig']>[1]
      )
  )

  handle(IPC_CHANNELS.database.deleteAgentToolConfig, [v.string()], (_, id) =>
    databaseService.deleteAgentToolConfig(id)
  )

  handle(IPC_CHANNELS.database.setDefaultAgentToolConfig, [v.string()], (_, id) =>
    databaseService.setDefaultAgentToolConfig(id)
  )

  handle(IPC_CHANNELS.database.getGlobalWorkflowTemplates, [], () =>
    databaseService.getGlobalWorkflowTemplates()
  )

  handle(IPC_CHANNELS.database.getWorkflowTemplatesByProject, [v.string()], (_, projectId) =>
    databaseService.getWorkflowTemplatesByProject(projectId)
  )

  handle(IPC_CHANNELS.database.getWorkflowTemplate, [v.string()], (_, templateId) =>
    databaseService.getWorkflowTemplate(templateId)
  )

  handle(IPC_CHANNELS.database.createWorkflowTemplate, [v.object()], (_, input) =>
    databaseService.createWorkflowTemplate(
      input as unknown as Parameters<DatabaseService['createWorkflowTemplate']>[0]
    )
  )

  handle(IPC_CHANNELS.database.updateWorkflowTemplate, [v.object()], (_, input) =>
    databaseService.updateWorkflowTemplate(
      input as unknown as Parameters<DatabaseService['updateWorkflowTemplate']>[0]
    )
  )

  handle(
    IPC_CHANNELS.database.deleteWorkflowTemplate,
    [v.string(), v.enum(['global', 'project'] as const)],
    (_, templateId, scope) => databaseService.deleteWorkflowTemplate(templateId, scope)
  )

  handle(
    IPC_CHANNELS.database.copyGlobalWorkflowToProject,
    [v.string(), v.string()],
    (_, globalTemplateId, projectId) =>
      databaseService.copyGlobalWorkflowToProject(globalTemplateId, projectId)
  )

  handle(IPC_CHANNELS.database.getTaskNodes, [v.string()], (_, taskId) =>
    databaseService.getTaskNodes(taskId)
  )

  handle(IPC_CHANNELS.database.getTaskNode, [v.string()], (_, nodeId) =>
    databaseService.getTaskNode(nodeId)
  )

  handle(IPC_CHANNELS.database.getCurrentTaskNode, [v.string()], (_, taskId) =>
    databaseService.getCurrentTaskNode(taskId)
  )

  handle(
    IPC_CHANNELS.database.updateCurrentTaskNodeRuntime,
    [
      v.string(),
      v.shape({
        session_id: v.optional(v.nullable(v.string({ allowEmpty: true }))),
        cli_tool_id: v.optional(v.nullable(v.string({ allowEmpty: true }))),
        agent_tool_config_id: v.optional(v.nullable(v.string({ allowEmpty: true })))
      })
    ],
    (_, taskId, updates) =>
      databaseService.updateCurrentTaskNodeRuntime(
        taskId,
        updates as unknown as Parameters<DatabaseService['updateCurrentTaskNodeRuntime']>[1]
      )
  )

  handle(
    IPC_CHANNELS.database.getTaskNodesByStatus,
    [v.string(), v.enum(taskNodeStatusValues)],
    (_, taskId, status) => databaseService.getTaskNodesByStatus(taskId, status as TaskNodeStatus)
  )

  handle(
    IPC_CHANNELS.database.completeTaskNode,
    [
      v.string(),
      v.optional(
        v.shape({
          resultSummary: v.optional(v.nullable(v.string({ allowEmpty: true }))),
          cost: v.optional(v.nullable(v.number())),
          duration: v.optional(v.nullable(v.number())),
          sessionId: v.optional(v.nullable(v.string({ allowEmpty: true }))),
          allowConversationCompletion: v.optional(v.boolean())
        })
      )
    ],
    (_, nodeId, result) => databaseService.completeTaskNode(nodeId, result || {})
  )

  handle(IPC_CHANNELS.database.markTaskNodeErrorReview, [v.string(), v.string()], (_, nodeId, error) =>
    databaseService.markTaskNodeErrorReview(nodeId, error)
  )

  handle(IPC_CHANNELS.database.approveTaskNode, [v.string()], (_, nodeId) =>
    databaseService.approveTaskNode(nodeId)
  )

  handle(
    IPC_CHANNELS.database.rejectTaskNode,
    [v.string(), v.optional(v.string({ allowEmpty: true }))],
    (_, nodeId, reason) => databaseService.rejectTaskNode(nodeId, reason || undefined)
  )

  handle(IPC_CHANNELS.database.retryTaskNode, [v.string()], (_, nodeId) =>
    databaseService.retryTaskNode(nodeId)
  )

  handle(IPC_CHANNELS.database.cancelTaskNode, [v.string()], (_, nodeId) =>
    databaseService.cancelTaskNode(nodeId)
  )
}
