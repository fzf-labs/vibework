import type { IpcModuleContext } from './types'
import { IPC_CHANNELS } from './channels'

export const registerPipelineIpc = ({ handle, v, services }: IpcModuleContext): void => {
  const { pipelineService } = services

  handle(
    IPC_CHANNELS.pipeline.execute,
    [v.string(), v.array(v.object()), v.optional(v.string())],
    async (_, pipelineId, stages, workingDirectory) => {
      const executionId = await pipelineService.executePipeline(
        pipelineId,
        stages as unknown as Parameters<typeof pipelineService.executePipeline>[1],
        workingDirectory
      )
      return { executionId }
    }
  )

  handle(IPC_CHANNELS.pipeline.getExecution, [v.string()], (_, executionId) => {
    return pipelineService.getExecution(executionId)
  })

  handle(IPC_CHANNELS.pipeline.getAllExecutions, [], () => pipelineService.getAllExecutions())

  handle(
    IPC_CHANNELS.pipeline.approveStage,
    [v.string(), v.string()],
    (_, stageExecutionId, approvedBy) => {
    pipelineService.approveStage(stageExecutionId, approvedBy)
  })

  handle(IPC_CHANNELS.pipeline.cancel, [v.string()], (_, executionId) => {
    pipelineService.cancelExecution(executionId)
  })
}
