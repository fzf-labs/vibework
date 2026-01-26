import React from 'react'

interface StatCardProps {
  label: string
  value: string
}

const StatCard: React.FC<StatCardProps> = ({ label, value }) => {
  return (
    <div
      style={{
        flex: 1,
        padding: '24px',
        border: '1px solid #E8E8E8',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <span
        style={{
          fontFamily: 'Inter',
          fontSize: '13px',
          color: '#7A7A7A'
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'Space Grotesk',
          fontSize: '32px',
          fontWeight: '600',
          color: '#0D0D0D'
        }}
      >
        {value}
      </span>
    </div>
  )
}

const Overview: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <h1
        style={{
          fontFamily: 'Space Grotesk',
          fontSize: '28px',
          fontWeight: '600',
          color: '#0D0D0D',
          margin: 0
        }}
      >
        Project Overview
      </h1>

      <div style={{ display: 'flex', gap: '20px' }}>
        <StatCard label="Total Tasks" value="24" />
        <StatCard label="Active Sessions" value="3" />
        <StatCard label="Skills" value="8" />
        <StatCard label="MCPs" value="5" />
      </div>
    </div>
  )
}

export default Overview
