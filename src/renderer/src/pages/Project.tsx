import React, { useState } from 'react'
import { useProjects } from '@/hooks'
import ProjectCard from '@/components/project/ProjectCard'
import NewProjectDialog from '@/components/project/NewProjectDialog'

const Projects: React.FC = () => {
  const { projects, loading, addProject } = useProjects()
  const [showNewDialog, setShowNewDialog] = useState(false)

  const handleCreateProject = async (projectData: any) => {
    try {
      await addProject(projectData)
      setShowNewDialog(false)
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <h1
          style={{
            fontFamily: 'Space Grotesk',
            fontSize: '28px',
            fontWeight: '600',
            color: '#0D0D0D',
            margin: 0
          }}
        >
          Projects
        </h1>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            style={{
              padding: '10px 20px',
              backgroundColor: '#FFFFFF',
              color: '#0D0D0D',
              border: '1px solid #E8E8E8',
              borderRadius: '8px',
              fontFamily: 'Space Grotesk',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Clone Repository
          </button>
          <button
            onClick={() => setShowNewDialog(true)}
            style={{
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
            + New Project
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div
          style={{
            padding: '60px',
            textAlign: 'center',
            color: '#7A7A7A'
          }}
        >
          No projects yet. Create your first project to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {showNewDialog && (
        <NewProjectDialog
          onClose={() => setShowNewDialog(false)}
          onSubmit={handleCreateProject}
        />
      )}
    </div>
  )
}

export default Projects
