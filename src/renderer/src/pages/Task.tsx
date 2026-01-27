import React from 'react'
import KanbanColumn from '../components/task/KanbanColumn'

const Tasks: React.FC = () => {
  const todoTasks = [
    {
      id: '1',
      title: '实现项目克隆功能',
      description: '支持从远程仓库克隆项目到本地',
      tag: 'Feature',
      avatarColor: '#E42313'
    }
  ]

  const inProgressTasks = [
    {
      id: '2',
      title: '实现Git可视化操作',
      description: '添加diff、merge、PR等可视化界面',
      tag: 'Feature',
      avatarColor: '#2196F3'
    }
  ]

  const inReviewTasks = [
    {
      id: '3',
      title: '实现任务流水线',
      description: '支持自定义任务流水线和人工确认',
      tag: 'Feature',
      avatarColor: '#4CAF50'
    }
  ]

  const doneTasks = [
    {
      id: '4',
      title: '搭建基础架构',
      description: 'Electron + React + TypeScript项目结构',
      tag: 'Setup',
      avatarColor: '#9C27B0'
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%'
        }}
      >
        <h1
          style={{
            fontFamily: 'Space Grotesk',
            fontSize: '24px',
            fontWeight: '700',
            color: '#0D0D0D',
            margin: 0
          }}
        >
          Tasks
        </h1>

        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: '#E42313',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontFamily: 'Space Grotesk',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          + Add Task
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '16px',
          height: 'calc(100% - 60px)',
          backgroundColor: '#FAFAFA',
          padding: '32px',
          borderRadius: '8px'
        }}
      >
        <KanbanColumn title="To Do" count={todoTasks.length} tasks={todoTasks} />
        <KanbanColumn title="In Progress" count={inProgressTasks.length} tasks={inProgressTasks} />
        <KanbanColumn title="In Review" count={inReviewTasks.length} tasks={inReviewTasks} />
        <KanbanColumn title="Done" count={doneTasks.length} tasks={doneTasks} />
      </div>
    </div>
  )
}

export default Tasks
