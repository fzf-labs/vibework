import type { IpcModuleContext } from './types'

export const registerPipelineIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { pipelineService } = services

  handle(
    'pipeline:execute',
    [v.string(), v.array(v.object()), v.optional(v.string())],
    async (_, pipelineId, stages, workingDirectory) => {
      const executionId = await pipelineService.executePipeline(
        pipelineId,
        stages as Parameters<typeof pipelineService.executePipeline>[1],
        workingDirectory
      )
      return { executionId }
    }
  )

  handle('pipeline:getExecution', [v.string()], (_, executionId) => {
    return pipelineService.getExecution(executionId)
  })

  handle('pipeline:getAllExecutions', [], () => pipelineService.getAllExecutions())

  handle('pipeline:approveStage', [v.string(), v.string()], (_, stageExecutionId, approvedBy) => {
    pipelineService.approveStage(stageExecutionId, approvedBy)
  })

  handle('pipeline:cancel', [v.string()], (_, executionId) => {
    pipelineService.cancelExecution(executionId)
  })
}
