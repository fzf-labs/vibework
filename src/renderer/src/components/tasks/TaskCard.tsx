import React from 'react'

interface TaskCardProps {
  title: string
  description: string
  tag: string
  avatarColor: string
}

const TaskCard: React.FC<TaskCardProps> = ({ title, description, tag, avatarColor }) => {
  return (
    <div
      style={{
        width: '100%',
        padding: '16px',
        backgroundColor: '#FAFAFA',
        border: '1px solid #E8E8E8',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <span
        style={{
          fontFamily: 'Space Grotesk',
          fontSize: '14px',
          fontWeight: '600',
          color: '#0D0D0D'
        }}
      >
        {title}
      </span>

      <span
        style={{
          fontFamily: 'Inter',
          fontSize: '12px',
          color: '#7A7A7A',
          lineHeight: '1.5'
        }}
      >
        {description}
      </span>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%'
        }}
      >
        <div
          style={{
            padding: '4px 8px',
            backgroundColor: '#E3F2FD',
            borderRadius: '4px'
          }}
        >
          <span
            style={{
              fontFamily: 'Inter',
              fontSize: '11px',
              color: '#1976D2',
              fontWeight: '500'
            }}
          >
            {tag}
          </span>
        </div>

        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: avatarColor
          }}
        />
      </div>
    </div>
  )
}

export default TaskCard
