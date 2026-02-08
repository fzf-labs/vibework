import { TaskNodeRepository } from './database/TaskNodeRepository'
import { TaskRepository } from './database/TaskRepository'
import type { TaskNode } from '../types/task'

interface CompleteNodeResult {
  resultSummary?: string | null
  cost?: number | null
  duration?: number | null
  sessionId?: string | null
  manualConversationStop?: boolean
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
    const task = this.taskRepo.getTask(taskId)
    if (!task) return null

    let currentNode = this.taskNodeRepo.getCurrentTaskNode(taskId)
    if (!currentNode) {
      this.syncTaskStatus(taskId)
      return null
    }

    if (task.task_mode === 'conversation') {
      if (currentNode.status === 'todo') {
        currentNode = this.taskNodeRepo.startNode(currentNode.id) ?? currentNode
      }

      if (currentNode.status === 'in_progress') {
        currentNode =
          this.taskNodeRepo.completeNode({
            node_id: currentNode.id,
            status: 'done',
            review_reason: null,
            result_summary: currentNode.result_summary,
            error_message: currentNode.error_message,
            cost: currentNode.cost,
            duration: currentNode.duration
          }) ?? currentNode
      } else if (currentNode.status === 'in_review') {
        currentNode = this.taskNodeRepo.approveNode(currentNode.id) ?? currentNode
      }

      this.syncTaskStatus(taskId)
      return currentNode
    }

    if (currentNode.status === 'todo' || currentNode.status === 'in_progress') {
      currentNode = this.taskNodeRepo.cancelNode(currentNode.id) ?? currentNode
    }

    this.syncTaskStatus(taskId)
    return currentNode
  }

  completeTaskNode(nodeId: string, result: CompleteNodeResult = {}): TaskNode | null {
    const node = this.taskNodeRepo.getTaskNode(nodeId)
    if (!node) return null

    const task = this.taskRepo.getTask(node.task_id)
    if (!task) return null

    if (
      task.task_mode === 'conversation' &&
      !result.manualConversationStop &&
      !result.allowConversationCompletion
    ) {
      // conversation 节点默认持续进行，仅显式 stopExecution 时结束
      return node
    }

    const requiresApproval = Boolean(node.requires_approval)
    const updated = this.taskNodeRepo.completeNode({
      node_id: nodeId,
      status: requiresApproval ? 'in_review' : 'done',
      review_reason: requiresApproval ? 'approval' : null,
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

    if (updated && Boolean(node.continue_on_error)) {
      this.startNextTodoNode(node.task_id)
    }

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

  rejectTaskNode(nodeId: string, reason?: string): TaskNode | null {
    const node = this.taskNodeRepo.getTaskNode(nodeId)
    if (!node) return null

    const updated = this.taskNodeRepo.rejectNode(nodeId, reason)
    this.syncTaskStatus(node.task_id)
    return updated
  }

  retryTaskNode(nodeId: string): TaskNode | null {
    const node = this.taskNodeRepo.getTaskNode(nodeId)
    if (!node) return null

    const updated = this.taskNodeRepo.retryNode(nodeId)
    this.syncTaskStatus(node.task_id)
    return updated
  }

  cancelTaskNode(nodeId: string): TaskNode | null {
    const node = this.taskNodeRepo.getTaskNode(nodeId)
    if (!node) return null

    const updated = this.taskNodeRepo.cancelNode(nodeId)
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
