import React from 'react'
import { Project } from '../../types/project'

interface ProjectCardProps {
  project: Project
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project }) => {
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
        justifyContent: 'space-between',
        cursor: 'pointer'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span
          style={{
            fontFamily: 'Space Grotesk',
            fontSize: '16px',
            fontWeight: '600',
            color: '#0D0D0D'
          }}
        >
          {project.name}
        </span>
        <span
          style={{
            fontFamily: 'Inter',
            fontSize: '13px',
            color: '#7A7A7A'
          }}
        >
          {project.path}
        </span>
      </div>

      <div
        style={{
          padding: '6px 12px',
          backgroundColor: project.type === 'local' ? '#E3F2FD' : '#E8F5E9',
          borderRadius: '6px'
        }}
      >
        <span
          style={{
            fontFamily: 'Inter',
            fontSize: '12px',
            fontWeight: '500',
            color: project.type === 'local' ? '#1976D2' : '#388E3C'
          }}
        >
          {project.type === 'local' ? 'Local' : 'Remote'}
        </span>
      </div>
    </div>
  )
}

export default ProjectCard
