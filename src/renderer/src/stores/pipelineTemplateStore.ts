import { PipelineTemplate } from '../types/pipeline'

class PipelineTemplateStore {
  private templates: PipelineTemplate[] = []
  private listeners: Set<() => void> = new Set()

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('pipelineTemplates')
      if (stored) {
        this.templates = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load pipeline templates:', error)
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('pipelineTemplates', JSON.stringify(this.templates))
    } catch (error) {
      console.error('Failed to save pipeline templates:', error)
    }
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }

  subscribe(listener: () => void): () => boolean {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getAll(): PipelineTemplate[] {
    return [...this.templates]
  }

  get(id: string): PipelineTemplate | undefined {
    return this.templates.find((t) => t.id === id)
  }

  add(template: Omit<PipelineTemplate, 'id' | 'createdAt' | 'updatedAt'>): PipelineTemplate {
    const newTemplate: PipelineTemplate = {
      ...template,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    this.templates.push(newTemplate)
    this.saveToStorage()
    this.notify()
    return newTemplate
  }

  update(
    id: string,
    updates: Partial<Omit<PipelineTemplate, 'id' | 'createdAt'>>
  ): PipelineTemplate | null {
    const index = this.templates.findIndex((t) => t.id === id)
    if (index === -1) return null

    this.templates[index] = {
      ...this.templates[index],
      ...updates,
      updatedAt: Date.now()
    }
    this.saveToStorage()
    this.notify()
    return this.templates[index]
  }

  delete(id: string): boolean {
    const index = this.templates.findIndex((t) => t.id === id)
    if (index === -1) return false

    this.templates.splice(index, 1)
    this.saveToStorage()
    this.notify()
    return true
  }

  duplicate(id: string): PipelineTemplate | null {
    const template = this.get(id)
    if (!template) return null

    const duplicated = this.add({
      name: `${template.name} (副本)`,
      description: template.description,
      stages: template.stages.map((stage) => ({ ...stage }))
    })
    return duplicated
  }
}

export const pipelineTemplateStore = new PipelineTemplateStore()
