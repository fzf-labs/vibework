import Database from 'better-sqlite3'

export class DatabaseConnection {
  private dbPath: string
  private db?: Database.Database

  constructor(dbPath: string) {
    this.dbPath = dbPath
  }

  open(): Database.Database {
    if (!this.db) {
      this.db = new Database(this.dbPath)
      this.db.pragma('journal_mode = WAL')
      this.db.pragma('foreign_keys = ON')
    }
    return this.db
  }

  initTables(): void {
    const db = this.assertDb()
    console.log('[DatabaseService] Creating tables...')

    // 创建 agent_tool_configs 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_tool_configs (
        id TEXT PRIMARY KEY,
        tool_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        config_json TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // 创建 projects 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        description TEXT,
        project_type TEXT NOT NULL DEFAULT 'normal',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    // 移除废弃的 project_settings 表
    db.exec(`
      DROP TABLE IF EXISTS project_settings
    `)

    // 创建 tasks 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        session_id TEXT UNIQUE,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        project_id TEXT,
        worktree_path TEXT,
        branch_name TEXT,
        base_branch TEXT,
        workspace_path TEXT,
        cli_tool_id TEXT,
        agent_tool_config_id TEXT,
        agent_tool_config_snapshot TEXT,
        workflow_template_id TEXT,
        cost REAL,
        duration REAL,
        favorite INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
      )
    `)

    this.migrateTasksSessionIdNullable(db)
    this.ensureColumn(db, 'tasks', 'agent_tool_config_id', 'TEXT')
    this.ensureColumn(db, 'tasks', 'agent_tool_config_snapshot', 'TEXT')

    // 创建 workflow_templates 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_templates (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL CHECK(scope IN ('global', 'project')),
        project_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)

    // 创建 workflow_template_nodes 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_template_nodes (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        node_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        requires_approval INTEGER DEFAULT 0,
        continue_on_error INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE
      )
    `)

    // 创建 workflows 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        current_node_index INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'todo',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `)

    // 创建 work_nodes 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS work_nodes (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        template_node_id TEXT,
        node_order INTEGER NOT NULL,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        requires_approval INTEGER DEFAULT 0,
        continue_on_error INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'todo',
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
        FOREIGN KEY (template_node_id) REFERENCES workflow_template_nodes(id) ON DELETE SET NULL
      )
    `)

    // 创建 agent_executions 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_executions (
        id TEXT PRIMARY KEY,
        work_node_id TEXT NOT NULL,
        execution_index INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'idle',
        started_at TEXT,
        completed_at TEXT,
        cost REAL,
        duration REAL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (work_node_id) REFERENCES work_nodes(id) ON DELETE CASCADE
      )
    `)

    this.purgeDeletedAgentToolConfigs(db)
    this.createIndexes(db)

    console.log('[DatabaseService] Tables created successfully')
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = undefined
    }
  }

  getDb(): Database.Database {
    return this.assertDb()
  }

  private assertDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not opened')
    }
    return this.db
  }

  private createIndexes(db: Database.Database): void {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
      CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_agent_tool_configs_tool_id ON agent_tool_configs(tool_id);
      CREATE INDEX IF NOT EXISTS idx_workflows_task_id ON workflows(task_id);
      CREATE INDEX IF NOT EXISTS idx_work_nodes_workflow_id ON work_nodes(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_agent_exec_work_node_id ON agent_executions(work_node_id);
    `)

    // workflow_templates 唯一性索引（部分索引）
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_global_template_name
        ON workflow_templates(name)
        WHERE scope = 'global';
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_project_template_name
        ON workflow_templates(project_id, name)
        WHERE scope = 'project';
    `)

    db.exec(`
      DROP INDEX IF EXISTS uniq_agent_tool_config;
      DROP INDEX IF EXISTS uniq_agent_tool_default;
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_tool_config
        ON agent_tool_configs(tool_id, name);
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_tool_default
        ON agent_tool_configs(tool_id)
        WHERE is_default = 1;
    `)
  }

  private purgeDeletedAgentToolConfigs(db: Database.Database): void {
    if (!this.hasColumn(db, 'agent_tool_configs', 'deleted_at')) return
    db.exec(`DELETE FROM agent_tool_configs WHERE deleted_at IS NOT NULL`)
  }

  private hasColumn(db: Database.Database, table: string, column: string): boolean {
    try {
      const info = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
      return info.some((entry) => entry.name === column)
    } catch (error) {
      console.error('[DatabaseService] Failed to inspect column:', table, column, error)
      return false
    }
  }

  private ensureColumn(
    db: Database.Database,
    table: string,
    column: string,
    definition: string
  ): void {
    try {
      const info = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
      const exists = info.some((entry) => entry.name === column)
      if (!exists) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
      }
    } catch (error) {
      console.error('[DatabaseService] Failed to ensure column:', table, column, error)
    }
  }

  private migrateTasksSessionIdNullable(db: Database.Database): void {
    let needsMigration = false
    try {
      const info = db.prepare(`PRAGMA table_info(tasks)`).all() as Array<{
        name: string
        notnull: number
      }>
      const sessionIdInfo = info.find((entry) => entry.name === 'session_id')
      needsMigration = Boolean(sessionIdInfo?.notnull)
    } catch (error) {
      console.error('[DatabaseService] Failed to inspect tasks.session_id:', error)
      return
    }

    if (!needsMigration) return

    let createSql: string | null | undefined
    try {
      const row = db
        .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'`)
        .get() as { sql?: string | null } | undefined
      createSql = row?.sql
    } catch (error) {
      console.error('[DatabaseService] Failed to read tasks table SQL:', error)
      return
    }

    if (!createSql) {
      console.error('[DatabaseService] Missing tasks table SQL; cannot migrate safely')
      return
    }

    const tempTable = 'tasks__tmp_session_id_nullable'
    const tempCreateSql = this.makeTasksCreateSqlSessionIdNullable(createSql, tempTable)
    if (!tempCreateSql) {
      console.error('[DatabaseService] Failed to rewrite tasks schema for nullable session_id')
      return
    }

    const fkRow = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys?: number } | undefined
    const shouldRestoreForeignKeys = Boolean(fkRow?.foreign_keys)

    try {
      db.exec('PRAGMA foreign_keys = OFF')
      const migrate = db.transaction(() => {
        db.exec(`DROP TABLE IF EXISTS ${tempTable}`)
        db.exec(tempCreateSql)
        db.exec(`INSERT INTO ${tempTable} SELECT * FROM tasks`)
        db.exec('DROP TABLE tasks')
        db.exec(`ALTER TABLE ${tempTable} RENAME TO tasks`)
      })
      migrate()
      console.log('[DatabaseService] Migrated tasks.session_id to be nullable')
    } catch (error) {
      console.error('[DatabaseService] Failed to migrate tasks.session_id to nullable:', error)
    } finally {
      if (shouldRestoreForeignKeys) {
        db.exec('PRAGMA foreign_keys = ON')
      }
    }
  }

  private makeTasksCreateSqlSessionIdNullable(createSql: string, tableName: string): string | null {
    const renamed = createSql.replace(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`\\[]?tasks["'`\\]]?/i,
      `CREATE TABLE ${tableName}`
    )

    const sessionIdDef = renamed.match(/\bsession_id\b[^,)]*/i)?.[0]
    if (!sessionIdDef) return null

    const rewrittenSessionIdDef = sessionIdDef.replace(/\bNOT\s+NULL\b/gi, ' ').replace(/\s+/g, ' ')
    return renamed.replace(sessionIdDef, rewrittenSessionIdDef)
  }
}
