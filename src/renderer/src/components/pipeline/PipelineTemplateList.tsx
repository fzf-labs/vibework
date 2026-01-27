import { useState, useEffect, useCallback } from 'react'
import { pipelineTemplateStore } from '../../stores/pipelineTemplateStore'
import { PipelineTemplate } from '../../types/pipeline'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface PipelineTemplateListProps {
  onEdit: (template: PipelineTemplate) => void
  onExecute: (template: PipelineTemplate) => void
}

export function PipelineTemplateList({
  onEdit,
  onExecute
}: PipelineTemplateListProps): JSX.Element {
  const [templates, setTemplates] = useState<PipelineTemplate[]>([])

  const loadTemplates = useCallback((): void => {
    setTemplates(pipelineTemplateStore.getAll())
  }, [])

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      loadTemplates()
    }, 0)
    const unsubscribe = pipelineTemplateStore.subscribe(() => {
      loadTemplates()
    })
    return () => {
      clearTimeout(initialLoad)
      unsubscribe()
    }
  }, [loadTemplates])

  const handleDelete = (id: string): void => {
    if (confirm('确定要删除此模板吗？')) {
      pipelineTemplateStore.delete(id)
    }
  }

  const handleDuplicate = (id: string): void => {
    pipelineTemplateStore.duplicate(id)
  }

  return (
    <div className="space-y-4">
      {templates.length === 0 ? (
        <div className="text-center text-gray-500 py-8">暂无流水线模板</div>
      ) : (
        templates.map((template) => (
          <div
            key={template.id}
            className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{template.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>{template.stages.length} 个环节</span>
                  <span>
                    更新于{' '}
                    {formatDistanceToNow(template.updatedAt, { addSuffix: true, locale: zhCN })}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onExecute(template)}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  执行
                </button>
                <button
                  onClick={() => onEdit(template)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDuplicate(template.id)}
                  className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  复制
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
