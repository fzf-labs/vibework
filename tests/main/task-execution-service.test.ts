import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { TaskExecutionService } from '../../src/main/services/TaskExecutionService'
import { DatabaseConnection } from '../../src/main/services/database/DatabaseConnection'
import { TaskNodeRepository } from '../../src/main/services/database/TaskNodeRepository'
import { TaskRepository } from '../../src/main/services/database/TaskRepository'

type TestContext = {
  tempDir: string
  connection: DatabaseConnection
  taskRepo: TaskRepository
  taskNodeRepo: TaskNodeRepository
  executionService: TaskExecutionService
}

const createTestContext = (): TestContext | null => {
  const tempDir = mkdtempSync(join(tmpdir(), 'vibework-task-execution-'))
  const dbPath = join(tempDir, 'test.db')
  const connection = new DatabaseConnection(dbPath)

  let db
  try {
    db = connection.open()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('NODE_MODULE_VERSION')) {
      rmSync(tempDir, { recursive: true, force: true })
      return null
    }
    throw error
  }

  connection.initTables()

  const taskRepo = new TaskRepository(db)
  const taskNodeRepo = new TaskNodeRepository(db)
  const executionService = new TaskExecutionService(taskRepo, taskNodeRepo)

  return {
    tempDir,
    connection,
    taskRepo,
    taskNodeRepo,
    executionService
  }
}

const cleanupTestContext = (context: TestContext): void => {
  context.connection.close()
  rmSync(context.tempDir, { recursive: true, force: true })
}

describe('TaskExecutionService', () => {
  it('transitions task nodes and syncs final task status', () => {
    const context = createTestContext()
    if (!context) return

    try {
      const { taskRepo, taskNodeRepo, executionService } = context
      const taskId = 'task-flow'

      taskRepo.createTask({
        id: taskId,
        title: 'Flow task',
        prompt: 'run flow',
        task_mode: 'workflow'
      })

      const node1 = taskNodeRepo.createNode({
        task_id: taskId,
        node_order: 1,
        name: 'Node 1',
        prompt: 'step 1',
        requires_approval: false,
        continue_on_error: false
      })

      const node2 = taskNodeRepo.createNode({
        task_id: taskId,
        node_order: 2,
        name: 'Node 2',
        prompt: 'step 2',
        requires_approval: true,
        continue_on_error: false
      })

      const startedNode = executionService.startTaskExecution(taskId)
      expect(startedNode?.id).toBe(node1.id)
      expect(taskNodeRepo.getTaskNode(node1.id)?.status).toBe('in_progress')

      const completedNode1 = executionService.completeTaskNode(node1.id, {
        resultSummary: 'node1 done',
        cost: 1.5,
        duration: 12
      })
      expect(completedNode1?.status).toBe('done')
      expect(taskNodeRepo.getTaskNode(node2.id)?.status).toBe('in_progress')

      const reviewNode = executionService.completeTaskNode(node2.id, {
        resultSummary: 'ready for review'
      })
      expect(reviewNode?.status).toBe('in_review')
      expect(reviewNode?.review_reason).toBe('approval')

      const rejectedNode = executionService.rejectTaskNode(node2.id, 'revise output')
      expect(rejectedNode?.status).toBe('in_review')
      expect(rejectedNode?.review_reason).toBe('rejected')
      expect(rejectedNode?.error_message).toBe('revise output')

      const retriedNode = executionService.retryTaskNode(node2.id)
      expect(retriedNode?.status).toBe('todo')
      expect(retriedNode?.session_id).toBeNull()
      expect(retriedNode?.result_summary).toBeNull()
      expect(retriedNode?.error_message).toBeNull()
      expect(retriedNode?.cost).toBeNull()
      expect(retriedNode?.duration).toBeNull()
      expect(retriedNode?.started_at).toBeNull()
      expect(retriedNode?.completed_at).toBeNull()

      const restartedNode = executionService.startTaskExecution(taskId)
      expect(restartedNode?.id).toBe(node2.id)
      expect(restartedNode?.status).toBe('in_progress')

      const errorReviewNode = executionService.markTaskNodeErrorReview(node2.id, 'execution failed')
      expect(errorReviewNode?.status).toBe('in_review')
      expect(errorReviewNode?.review_reason).toBe('error')

      const approvedNode = executionService.approveTaskNode(node2.id)
      expect(approvedNode?.status).toBe('done')
      expect(approvedNode?.review_reason).toBeNull()

      const task = taskRepo.getTask(taskId)
      expect(task?.status).toBe('done')
      expect(task?.cost).toBe(1.5)
      expect(task?.started_at).not.toBeNull()
      expect(task?.completed_at).not.toBeNull()
      expect(task?.duration).not.toBeNull()
    } finally {
      cleanupTestContext(context)
    }
  })

  it('aggregates task status for mixed node states', () => {
    const context = createTestContext()
    if (!context) return

    try {
      const { taskRepo, taskNodeRepo } = context

      taskRepo.createTask({
        id: 'task-done-todo',
        title: 'Done + Todo',
        prompt: 'aggregate 1',
        task_mode: 'workflow'
      })
      const doneTodoNode1 = taskNodeRepo.createNode({
        task_id: 'task-done-todo',
        node_order: 1,
        name: 'Node 1',
        prompt: 'step 1'
      })
      taskNodeRepo.createNode({
        task_id: 'task-done-todo',
        node_order: 2,
        name: 'Node 2',
        prompt: 'step 2'
      })

      taskNodeRepo.startNode(doneTodoNode1.id)
      taskNodeRepo.completeNode({
        node_id: doneTodoNode1.id,
        status: 'done',
        review_reason: null,
        result_summary: 'done'
      })
      taskRepo.syncTaskFromNodes('task-done-todo')
      expect(taskRepo.getTask('task-done-todo')?.status).toBe('in_progress')

      taskRepo.createTask({
        id: 'task-todo-cancelled',
        title: 'Todo + Cancelled',
        prompt: 'aggregate 2',
        task_mode: 'workflow'
      })
      const todoCancelledNode1 = taskNodeRepo.createNode({
        task_id: 'task-todo-cancelled',
        node_order: 1,
        name: 'Node 1',
        prompt: 'step 1'
      })
      const todoCancelledNode2 = taskNodeRepo.createNode({
        task_id: 'task-todo-cancelled',
        node_order: 2,
        name: 'Node 2',
        prompt: 'step 2'
      })

      taskNodeRepo.cancelNode(todoCancelledNode1.id)
      taskRepo.syncTaskFromNodes('task-todo-cancelled')
      expect(taskRepo.getTask('task-todo-cancelled')?.status).toBe('todo')

      taskNodeRepo.cancelNode(todoCancelledNode2.id)
      taskRepo.syncTaskFromNodes('task-todo-cancelled')
      expect(taskRepo.getTask('task-todo-cancelled')?.status).toBe('cancelled')
    } finally {
      cleanupTestContext(context)
    }
  })
})
