import React from 'react'

interface SkillCardProps {
  name: string
  description: string
  status: 'Active' | 'Inactive'
  iconColor: string
}

const SkillCard: React.FC<SkillCardProps> = ({ name, description, status, iconColor }) => {
  const statusColor = status === 'Active' ? '#388E3C' : '#757575'
  const statusBgColor = status === 'Active' ? '#E8F5E9' : '#F5F5F5'

  return (
    <div
      style={{
        width: '100%',
        padding: '20px 24px',
        backgroundColor: '#FAFAFA',
        border: '1px solid #E8E8E8',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: iconColor,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span
            style={{
              fontFamily: 'Space Grotesk',
              fontSize: '16px',
              fontWeight: '600',
              color: '#0D0D0D'
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontFamily: 'Inter',
              fontSize: '13px',
              color: '#7A7A7A'
            }}
          >
            {description}
          </span>
        </div>
      </div>

      <div
        style={{
          padding: '6px 12px',
          backgroundColor: statusBgColor,
          borderRadius: '6px'
        }}
      >
        <span
          style={{
            fontFamily: 'Inter',
            fontSize: '12px',
            fontWeight: '500',
            color: statusColor
          }}
        >
          {status}
        </span>
      </div>
    </div>
  )
}

export default SkillCard
