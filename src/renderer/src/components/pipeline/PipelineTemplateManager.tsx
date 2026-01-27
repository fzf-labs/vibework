import { useState } from 'react'
import { pipelineTemplateStore } from '../../stores/pipelineTemplateStore'
import { PipelineTemplate } from '../../types/pipeline'
import { PipelineTemplateList } from './PipelineTemplateList'
import { PipelineTemplateEditor } from './PipelineTemplateEditor'

export function PipelineTemplateManager(): JSX.Element {
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [editingTemplate, setEditingTemplate] = useState<PipelineTemplate | undefined>()

  const handleCreate = (): void => {
    setEditingTemplate(undefined)
    setView('edit')
  }

  const handleEdit = (template: PipelineTemplate): void => {
    setEditingTemplate(template)
    setView('edit')
  }

  const handleSave = (
    templateData: Omit<PipelineTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): void => {
    if (editingTemplate) {
      pipelineTemplateStore.update(editingTemplate.id, templateData)
    } else {
      pipelineTemplateStore.add(templateData)
    }
    setView('list')
  }

  const handleCancel = (): void => {
    setView('list')
  }

  const handleExecute = (template: PipelineTemplate): void => {
    // TODO: 实现流水线执行逻辑
    console.log('Execute pipeline:', template)
    alert(`执行流水线: ${template.name}`)
  }

  return (
    <div className="h-full flex flex-col">
      {view === 'list' ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">流水线模板</h2>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              新建模板
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PipelineTemplateList onEdit={handleEdit} onExecute={handleExecute} />
          </div>
        </>
      ) : (
        <PipelineTemplateEditor
          template={editingTemplate}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}
