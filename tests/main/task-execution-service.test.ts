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
        requires_approval: false
      })

      const node2 = taskNodeRepo.createNode({
        task_id: taskId,
        node_order: 2,
        name: 'Node 2',
        prompt: 'step 2',
        requires_approval: true
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

      const rerunNode = executionService.rerunTaskNode(node2.id)
      expect(rerunNode?.status).toBe('in_progress')
      expect(rerunNode?.result_summary).toBeNull()
      expect(rerunNode?.error_message).toBeNull()
      expect(rerunNode?.cost).toBeNull()
      expect(rerunNode?.duration).toBeNull()
      expect(rerunNode?.completed_at).toBeNull()

      const errorReviewNode = executionService.markTaskNodeErrorReview(node2.id, 'execution failed')
      expect(errorReviewNode?.status).toBe('in_review')
      expect(errorReviewNode?.error_message).toBe('execution failed')

      const approvedNode = executionService.approveTaskNode(node2.id)
      expect(approvedNode?.status).toBe('done')
      expect(approvedNode?.error_message).toBeNull()

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

  it('moves conversation node to in_review when execution completes', () => {
    const context = createTestContext()
    if (!context) return

    try {
      const { taskRepo, taskNodeRepo, executionService } = context
      const taskId = 'task-conversation'

      taskRepo.createTask({
        id: taskId,
        title: 'Conversation task',
        prompt: 'chat',
        task_mode: 'conversation'
      })

      const conversationNode = taskNodeRepo.createConversationNode({
        task_id: taskId,
        prompt: 'chat'
      })

      const startedNode = executionService.startTaskExecution(taskId)
      expect(startedNode?.id).toBe(conversationNode.id)
      expect(startedNode?.status).toBe('in_progress')

      const completedNode = executionService.completeTaskNode(conversationNode.id, {
        resultSummary: 'first turn finished'
      })
      expect(completedNode?.status).toBe('in_review')
      expect(completedNode?.result_summary).toBe('first turn finished')
      expect(taskRepo.getTask(taskId)?.status).toBe('in_review')

      const approvedNode = executionService.approveTaskNode(conversationNode.id)
      expect(approvedNode?.status).toBe('done')
      expect(taskRepo.getTask(taskId)?.status).toBe('done')
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
        result_summary: 'done'
      })
      taskRepo.syncTaskFromNodes('task-done-todo')
      expect(taskRepo.getTask('task-done-todo')?.status).toBe('in_progress')
    } finally {
      cleanupTestContext(context)
    }
  })
})
