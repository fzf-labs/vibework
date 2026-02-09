import { TaskNodeRepository } from './database/TaskNodeRepository'
import { TaskRepository } from './database/TaskRepository'
import type { TaskNode } from '../types/task'

interface CompleteNodeResult {
  resultSummary?: string | null
  cost?: number | null
  duration?: number | null
  sessionId?: string | null
  allowConversationCompletion?: boolean
}

export class TaskExecutionService {
  private taskRepo: TaskRepository
  private taskNodeRepo: TaskNodeRepository

  constructor(taskRepo: TaskRepository, taskNodeRepo: TaskNodeRepository) {
    this.taskRepo = taskRepo
    this.taskNodeRepo = taskNodeRepo
  }

  startTaskExecution(taskId: string): TaskNode | null {
    const runningNode = this.taskNodeRepo.getTaskNodesByStatus(taskId, 'in_progress')[0]
    if (runningNode) {
      this.syncTaskStatus(taskId)
      return runningNode
    }

    const nextNode = this.taskNodeRepo.getNextTodoNode(taskId)
    if (!nextNode) {
      this.syncTaskStatus(taskId)
      return null
    }

    const startedNode = this.taskNodeRepo.startNode(nextNode.id)
    this.syncTaskStatus(taskId)
    return startedNode
  }

  stopTaskExecution(taskId: string): TaskNode | null {
    const runningNode = this.taskNodeRepo.getTaskNodesByStatus(taskId, 'in_progress')[0]
    if (!runningNode) {
      this.syncTaskStatus(taskId)
      return null
    }

    const updated = this.taskNodeRepo.stopNodeExecution(runningNode.id)

    this.syncTaskStatus(taskId)
    return updated
  }

  stopTaskNodeExecution(nodeId: string, reason?: string): TaskNode | null {
    const node = this.taskNodeRepo.getTaskNode(nodeId)
    if (!node) return null

    const updated = this.taskNodeRepo.stopNodeExecution(nodeId, reason ?? 'stopped_by_user')
    this.syncTaskStatus(node.task_id)
    return updated
  }

  completeTaskNode(nodeId: string, result: CompleteNodeResult = {}): TaskNode | null {
    const node = this.taskNodeRepo.getTaskNode(nodeId)
    if (!node) return null

    const task = this.taskRepo.getTask(node.task_id)
    if (!task) return null

    const completionStatus: 'done' | 'in_review' =
      task.task_mode === 'conversation'
        ? result.allowConversationCompletion
          ? 'done'
          : 'in_review'
        : node.requires_approval
          ? 'in_review'
          : 'done'

    const updated = this.taskNodeRepo.completeNode({
      node_id: nodeId,
      status: completionStatus,
      result_summary: result.resultSummary ?? null,
      error_message: null,
      cost: result.cost ?? null,
      duration: result.duration ?? null,
      session_id: result.sessionId ?? null
    })

    if (updated?.status === 'done') {
      this.startNextTodoNode(node.task_id)
    }

    this.syncTaskStatus(node.task_id)
    return updated
  }

  markTaskNodeErrorReview(nodeId: string, error: string): TaskNode | null {
    const node = this.taskNodeRepo.getTaskNode(nodeId)
    if (!node) return null

    const updated = this.taskNodeRepo.markErrorReview(nodeId, error)

    this.syncTaskStatus(node.task_id)
    return updated
  }

  approveTaskNode(nodeId: string): TaskNode | null {
    const node = this.taskNodeRepo.getTaskNode(nodeId)
    if (!node) return null

    const updated = this.taskNodeRepo.approveNode(nodeId)
    if (updated?.status === 'done') {
      this.startNextTodoNode(node.task_id)
    }

    this.syncTaskStatus(node.task_id)
    return updated
  }

  rerunTaskNode(nodeId: string): TaskNode | null {
    const node = this.taskNodeRepo.getTaskNode(nodeId)
    if (!node) return null

    const updated = this.taskNodeRepo.rerunNode(nodeId)
    this.syncTaskStatus(node.task_id)
    return updated
  }

  syncTaskStatus(taskId: string): void {
    this.taskRepo.syncTaskFromNodes(taskId)
  }

  private startNextTodoNode(taskId: string): TaskNode | null {
    const runningNode = this.taskNodeRepo.getTaskNodesByStatus(taskId, 'in_progress')[0]
    if (runningNode) return runningNode

    const nextNode = this.taskNodeRepo.getNextTodoNode(taskId)
    if (!nextNode) return null

    try {
      return this.taskNodeRepo.startNode(nextNode.id)
    } catch (error) {
      console.warn('[TaskExecutionService] Failed to start next node:', error)
      return null
    }
  }
}
