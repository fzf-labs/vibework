import type { IpcModuleContext } from './types'
import type { DatabaseService } from '../services/DatabaseService'
import { IPC_CHANNELS } from './channels'

export const registerDatabaseIpc = ({
  handle,
  v,
  services,
  workflowStatusValues,
  workNodeStatusValues,
  agentExecutionStatusValues
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

  handle(IPC_CHANNELS.database.createWorkflow, [v.string()], (_, taskId) =>
    databaseService.createWorkflow(taskId)
  )

  handle(IPC_CHANNELS.database.getWorkflow, [v.string()], (_, id) => databaseService.getWorkflow(id))

  handle(IPC_CHANNELS.database.getWorkflowByTaskId, [v.string()], (_, taskId) =>
    databaseService.getWorkflowByTaskId(taskId)
  )

  handle(
    IPC_CHANNELS.database.updateWorkflowStatus,
    [v.string(), v.enum(workflowStatusValues), v.optional(v.number({ min: 0 }))],
    (_, id, status, nodeIndex) => databaseService.updateWorkflowStatus(id, status, nodeIndex)
  )

  handle(
    IPC_CHANNELS.database.createWorkNode,
    [v.string(), v.string(), v.number({ min: 0 })],
    (_, workflowId, templateId, nodeOrder) =>
      databaseService.createWorkNode(workflowId, templateId, nodeOrder)
  )

  handle(IPC_CHANNELS.database.getWorkNodesByWorkflowId, [v.string()], (_, workflowId) =>
    databaseService.getWorkNodesByWorkflowId(workflowId)
  )

  handle(
    IPC_CHANNELS.database.updateWorkNodeStatus,
    [v.string(), v.enum(workNodeStatusValues)],
    (_, id, status) => databaseService.updateWorkNodeStatus(id, status)
  )

  handle(IPC_CHANNELS.database.approveWorkNode, [v.string()], (_, id) =>
    databaseService.approveWorkNode(id)
  )

  handle(IPC_CHANNELS.database.rejectWorkNode, [v.string()], (_, id) =>
    databaseService.rejectWorkNode(id)
  )

  handle(IPC_CHANNELS.database.approveTask, [v.string()], (_, id) =>
    databaseService.approveTask(id)
  )

  handle(IPC_CHANNELS.database.createAgentExecution, [v.string()], (_, workNodeId) =>
    databaseService.createAgentExecution(workNodeId)
  )

  handle(IPC_CHANNELS.database.getAgentExecutionsByWorkNodeId, [v.string()], (_, workNodeId) =>
    databaseService.getAgentExecutionsByWorkNodeId(workNodeId)
  )

  handle(IPC_CHANNELS.database.getLatestAgentExecution, [v.string()], (_, workNodeId) =>
    databaseService.getLatestAgentExecution(workNodeId)
  )

  handle(
    IPC_CHANNELS.database.updateAgentExecutionStatus,
    [
      v.string(),
      v.enum(agentExecutionStatusValues),
      v.optional(v.number({ min: 0 })),
      v.optional(v.number({ min: 0 }))
    ],
    (_, id, status, cost, duration) =>
      databaseService.updateAgentExecutionStatus(id, status, cost, duration)
  )
}
