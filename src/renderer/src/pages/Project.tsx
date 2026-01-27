import React, { useState } from 'react'
import { useProjects } from '@/hooks'
import ProjectCard from '@/components/project/ProjectCard'
import NewProjectDialog from '@/components/project/NewProjectDialog'
import type { NewProjectInput } from '@/types'
import { notificationStore } from '@/stores/notificationStore'

const Projects: React.FC = () => {
  const { projects, loading, addProject } = useProjects()
  const [showNewDialog, setShowNewDialog] = useState(false)

  const handleCreateProject = async (projectData: NewProjectInput): Promise<void> => {
    try {
      await addProject(projectData)
      setShowNewDialog(false)

      // 发送成功通知
      notificationStore.add({
        type: 'success',
        title: '项目创建成功',
        body: `项目 "${projectData.name}" 已成功创建`
      })
    } catch (error) {
      console.error('Failed to create project:', error)

      // 发送错误通知
      notificationStore.add({
        type: 'error',
        title: '项目创建失败',
        body: error instanceof Error ? error.message : '创建项目时发生错误，请稍后重试'
      })
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
        <NewProjectDialog onClose={() => setShowNewDialog(false)} onSubmit={handleCreateProject} />
      )}
    </div>
  )
}

export default Projects
