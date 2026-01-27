import { useState } from 'react'
import { PipelineTemplate, PipelineStage } from '../../types/pipeline'

interface PipelineTemplateEditorProps {
  template?: PipelineTemplate
  onSave: (template: Omit<PipelineTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}

export function PipelineTemplateEditor({ template, onSave, onCancel }: PipelineTemplateEditorProps) {
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [stages, setStages] = useState<PipelineStage[]>(template?.stages || [])

  const handleAddStage = () => {
    const newStage: PipelineStage = {
      id: Date.now().toString(),
      name: '新环节',
      type: 'command',
      command: '',
      args: []
    }
    setStages([...stages, newStage])
  }

  const handleRemoveStage = (index: number) => {
    setStages(stages.filter((_, i) => i !== index))
  }

  const handleUpdateStage = (index: number, updates: Partial<PipelineStage>) => {
    const newStages = [...stages]
    newStages[index] = { ...newStages[index], ...updates }
    setStages(newStages)
  }

  const handleSubmit = () => {
    if (!name.trim()) {
      alert('请输入模板名称')
      return
    }
    onSave({ name, description, stages })
  }

  return (
    <div className="bg-white rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">{template ? '编辑模板' : '新建模板'}</h2>

      {/* 基本信息 */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">模板名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="输入模板名称"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            rows={3}
            placeholder="输入模板描述"
          />
        </div>
      </div>

      {/* 环节列表 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">流水线环节</h3>
          <button
            onClick={handleAddStage}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            添加环节
          </button>
        </div>

        <div className="space-y-3">
          {stages.map((stage, index) => (
            <div key={stage.id} className="border rounded p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={stage.name}
                    onChange={(e) => handleUpdateStage(index, { name: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                    placeholder="环节名称"
                  />
                  <input
                    type="text"
                    value={stage.command || ''}
                    onChange={(e) => handleUpdateStage(index, { command: e.target.value })}
                    className="w-full px-2 py-1 border rounded text-sm"
                    placeholder="命令 (如: npm run build)"
                  />
                </div>
                <button
                  onClick={() => handleRemoveStage(index)}
                  className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          保存
        </button>
      </div>
    </div>
  )
}
