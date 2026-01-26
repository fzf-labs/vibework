import React, { useEffect, useState } from 'react'
import { Project } from '../../types/project'
import NewProjectDialog from '../projects/NewProjectDialog'

interface ProjectSelectorProps {
  onProjectChange?: (project: Project | null) => void
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ onProjectChange }) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNewDialog, setShowNewDialog] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const data = await window.api.projects.getAll()
      setProjects(data)
      if (data.length > 0 && !currentProject) {
        setCurrentProject(data[0])
        onProjectChange?.(data[0])
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  const handleSelectProject = (project: Project) => {
    setCurrentProject(project)
    setShowDropdown(false)
    onProjectChange?.(project)
  }

  const handleCreateProject = async (projectData: any) => {
    try {
      const newProject = await window.api.projects.add(projectData)
      setShowNewDialog(false)
      await loadProjects()
      setCurrentProject(newProject)
      onProjectChange?.(newProject)
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          border: '1px solid #E8E8E8',
          borderRadius: '4px',
          cursor: 'pointer',
          backgroundColor: '#FFFFFF'
        }}
      >
        <span
          style={{
            fontFamily: 'Inter',
            fontSize: '14px',
            color: '#0D0D0D'
          }}
        >
          {currentProject ? currentProject.name : 'Select Project'}
        </span>
        <span style={{ fontSize: '12px', color: '#7A7A7A' }}>▼</span>
      </div>

      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E8E8E8',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            minWidth: '250px',
            zIndex: 1000
          }}
        >
          <div style={{ padding: '8px' }}>
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleSelectProject(project)}
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor:
                    currentProject?.id === project.id ? '#F5F5F5' : 'transparent'
                }}
              >
                <div
                  style={{
                    fontFamily: 'Space Grotesk',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#0D0D0D'
                  }}
                >
                  {project.name}
                </div>
                <div
                  style={{
                    fontFamily: 'Inter',
                    fontSize: '12px',
                    color: '#7A7A7A',
                    marginTop: '4px'
                  }}
                >
                  {project.path}
                </div>
              </div>
            ))}

            <div
              style={{
                borderTop: '1px solid #E8E8E8',
                marginTop: '8px',
                paddingTop: '8px'
              }}
            >
              <button
                onClick={() => {
                  setShowDropdown(false)
                  setShowNewDialog(true)
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#E42313',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
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

export default ProjectSelector
