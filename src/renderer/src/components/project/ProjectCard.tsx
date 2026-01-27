import React, { useState } from 'react'
import { Project } from '../../types/project'
import EditorConfigDialog from './EditorConfigDialog'

interface ProjectCardProps {
  project: Project
  onUpdate?: (project: Project) => void
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onUpdate }): JSX.Element => {
  const [showEditorConfig, setShowEditorConfig] = useState(false)

  const handleOpenProject = async (): Promise<void> => {
    if (!project.config.editor) {
      setShowEditorConfig(true)
      return
    }

    try {
      await window.api.editor.openProject(project.path, project.config.editor.path)
    } catch (error) {
      console.error('Failed to open project:', error)
    }
  }

  const handleSaveEditor = async (editorCommand: string): Promise<void> => {
    try {
      const updatedProject = await window.api.projects.update(project.id, {
        config: {
          ...project.config,
          editor: { path: editorCommand }
        }
      })
      if (onUpdate && updatedProject) {
        onUpdate(updatedProject)
      }
    } catch (error) {
      console.error('Failed to save editor config:', error)
    }
  }

  return (
    <>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

          <button
            onClick={() => setShowEditorConfig(true)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #E8E8E8',
              backgroundColor: '#FFFFFF',
              color: '#0D0D0D',
              cursor: 'pointer',
              fontFamily: 'Inter',
              fontSize: '12px'
            }}
          >
            配置编辑器
          </button>

          <button
            onClick={handleOpenProject}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontFamily: 'Inter',
              fontSize: '12px'
            }}
          >
            打开项目
          </button>
        </div>
      </div>

      <EditorConfigDialog
        project={project}
        open={showEditorConfig}
        onClose={() => setShowEditorConfig(false)}
        onSave={handleSaveEditor}
      />
    </>
  )
}

export default ProjectCard
