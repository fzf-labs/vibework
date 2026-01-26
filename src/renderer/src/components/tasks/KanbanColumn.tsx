import React from 'react'
import TaskCard from './TaskCard'

interface Task {
  id: string
  title: string
  description: string
  tag: string
  avatarColor: string
}

interface KanbanColumnProps {
  title: string
  count: number
  tasks: Task[]
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ title, count, tasks }) => {
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        height: '100%'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%'
        }}
      >
        <span
          style={{
            fontFamily: 'Space Grotesk',
            fontSize: '16px',
            fontWeight: '600',
            color: '#0D0D0D'
          }}
        >
          {title}
        </span>

        <div
          style={{
            padding: '4px 8px',
            backgroundColor: '#F5F5F5',
            borderRadius: '12px'
          }}
        >
          <span
            style={{
              fontFamily: 'Inter',
              fontSize: '12px',
              color: '#7A7A7A',
              fontWeight: '500'
            }}
          >
            {count}
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowY: 'auto'
        }}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            title={task.title}
            description={task.description}
            tag={task.tag}
            avatarColor={task.avatarColor}
          />
        ))}
      </div>
    </div>
  )
}

export default KanbanColumn
