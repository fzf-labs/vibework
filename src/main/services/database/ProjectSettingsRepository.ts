import type Database from 'better-sqlite3'
import type { ProjectSkillsSettings } from '../../types/project-settings'

const DEFAULT_PROJECT_SKILLS_SETTINGS: ProjectSkillsSettings = {
  enabled: true,
  includeDefaultDirectories: true,
  customDirectories: []
}

export class ProjectSettingsRepository {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  getProjectSkillsSettings(projectId: string): ProjectSkillsSettings {
    const stmt = this.db.prepare('SELECT skills_config FROM project_settings WHERE project_id = ?')
    const row = stmt.get(projectId) as { skills_config?: string } | undefined
    if (!row?.skills_config) return { ...DEFAULT_PROJECT_SKILLS_SETTINGS }

    try {
      const parsed = JSON.parse(row.skills_config) as Partial<ProjectSkillsSettings>
      return {
        ...DEFAULT_PROJECT_SKILLS_SETTINGS,
        ...parsed,
        customDirectories: Array.isArray(parsed.customDirectories)
          ? parsed.customDirectories
          : DEFAULT_PROJECT_SKILLS_SETTINGS.customDirectories
      }
    } catch {
      return { ...DEFAULT_PROJECT_SKILLS_SETTINGS }
    }
  }

  upsertProjectSkillsSettings(
    projectId: string,
    settings: ProjectSkillsSettings
  ): ProjectSkillsSettings {
    const now = new Date().toISOString()
    const payload = JSON.stringify(settings)
    const existsStmt = this.db.prepare('SELECT project_id FROM project_settings WHERE project_id = ?')
    const existing = existsStmt.get(projectId) as { project_id: string } | undefined

    if (existing) {
      const stmt = this.db.prepare(
        'UPDATE project_settings SET skills_config = ?, updated_at = ? WHERE project_id = ?'
      )
      stmt.run(payload, now, projectId)
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO project_settings (project_id, skills_config, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
      stmt.run(projectId, payload, now, now)
    }

    return settings
  }
}
