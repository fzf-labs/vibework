import type { IpcModuleContext } from './types'
import type { DatabaseService } from '../services/DatabaseService'

export const registerDatabaseIpc = ({
  handle,
  v,
  services,
  workflowStatusValues,
  workNodeStatusValues,
  agentExecutionStatusValues
}: IpcModuleContext): void => {
  const { databaseService } = services

  handle('db:createTask', [v.object()], (_, input) => databaseService.createTask(input))

  handle('db:getTask', [v.string()], (_, id) => databaseService.getTask(id))

  handle('db:getAllTasks', [], () => databaseService.getAllTasks())

  handle('db:updateTask', [v.string(), v.object()], (_, id, updates) =>
    databaseService.updateTask(id, updates)
  )

  handle('db:deleteTask', [v.string()], (_, id) => databaseService.deleteTask(id))

  handle('db:getTasksByProjectId', [v.string()], (_, projectId) =>
    databaseService.getTasksByProjectId(projectId)
  )

  handle('db:getGlobalWorkflowTemplates', [], () =>
    databaseService.getGlobalWorkflowTemplates()
  )

  handle('db:getWorkflowTemplatesByProject', [v.string()], (_, projectId) =>
    databaseService.getWorkflowTemplatesByProject(projectId)
  )

  handle('db:getWorkflowTemplate', [v.string()], (_, templateId) =>
    databaseService.getWorkflowTemplate(templateId)
  )

  handle('db:createWorkflowTemplate', [v.object()], (_, input) =>
    databaseService.createWorkflowTemplate(input)
  )

  handle('db:updateWorkflowTemplate', [v.object()], (_, input) =>
    databaseService.updateWorkflowTemplate(input)
  )

  handle(
    'db:deleteWorkflowTemplate',
    [v.string(), v.enum(['global', 'project'] as const)],
    (_, templateId, scope) => databaseService.deleteWorkflowTemplate(templateId, scope)
  )

  handle(
    'db:copyGlobalWorkflowToProject',
    [v.string(), v.string()],
    (_, globalTemplateId, projectId) =>
      databaseService.copyGlobalWorkflowToProject(globalTemplateId, projectId)
  )

  handle('db:createWorkflow', [v.string()], (_, taskId) =>
    databaseService.createWorkflow(taskId)
  )

  handle('db:getWorkflow', [v.string()], (_, id) => databaseService.getWorkflow(id))

  handle('db:getWorkflowByTaskId', [v.string()], (_, taskId) =>
    databaseService.getWorkflowByTaskId(taskId)
  )

  handle(
    'db:updateWorkflowStatus',
    [v.string(), v.enum(workflowStatusValues), v.optional(v.number({ min: 0 }))],
    (_, id, status, nodeIndex) => databaseService.updateWorkflowStatus(id, status, nodeIndex)
  )

  handle(
    'db:createWorkNode',
    [v.string(), v.string(), v.number({ min: 0 })],
    (_, workflowId, templateId, nodeOrder) =>
      databaseService.createWorkNode(workflowId, templateId, nodeOrder)
  )

  handle('db:getWorkNodesByWorkflowId', [v.string()], (_, workflowId) =>
    databaseService.getWorkNodesByWorkflowId(workflowId)
  )

  handle(
    'db:updateWorkNodeStatus',
    [v.string(), v.enum(workNodeStatusValues)],
    (_, id, status) => databaseService.updateWorkNodeStatus(id, status)
  )

  handle('db:approveWorkNode', [v.string()], (_, id) => databaseService.approveWorkNode(id))

  handle('db:rejectWorkNode', [v.string()], (_, id) => databaseService.rejectWorkNode(id))

  handle('db:approveTask', [v.string()], (_, id) => databaseService.approveTask(id))

  handle('db:createAgentExecution', [v.string()], (_, workNodeId) =>
    databaseService.createAgentExecution(workNodeId)
  )

  handle('db:getAgentExecutionsByWorkNodeId', [v.string()], (_, workNodeId) =>
    databaseService.getAgentExecutionsByWorkNodeId(workNodeId)
  )

  handle('db:getLatestAgentExecution', [v.string()], (_, workNodeId) =>
    databaseService.getLatestAgentExecution(workNodeId)
  )

  handle(
    'db:updateAgentExecutionStatus',
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
