import Database from 'better-sqlite3'

const TARGET_SCHEMA_VERSION = 4

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
    console.log('[DatabaseService] Initializing tables...')

    this.createBaseTables(db)
    this.createBaseIndexes(db)

    const userVersion = Number(db.pragma('user_version', { simple: true }) ?? 0)
    if (userVersion < 3) {
      console.log(
        `[DatabaseService] Rebuilding runtime schema: v${userVersion} -> v3`
      )
      const rebuildRuntimeSchema = db.transaction(() => {
        db.exec(`
          DROP TABLE IF EXISTS task_node_runs;
          DROP TABLE IF EXISTS agent_executions;
          DROP TABLE IF EXISTS work_nodes;
          DROP TABLE IF EXISTS workflows;
          DROP TABLE IF EXISTS project_settings;
          DROP TABLE IF EXISTS task_nodes;
          DROP TABLE IF EXISTS tasks;
        `)

        this.createRuntimeTables(db)
        this.createRuntimeIndexes(db)
        db.pragma('user_version = 3')
      })

      rebuildRuntimeSchema()
    } else {
      this.createRuntimeTables(db)
      this.createRuntimeIndexes(db)
    }

    this.migrateSchema(db, userVersion)

    console.log('[DatabaseService] Tables initialized successfully')
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

  private createBaseTables(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_tool_configs (
        id TEXT PRIMARY KEY,
        tool_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        config_json TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        description TEXT,
        project_type TEXT NOT NULL DEFAULT 'normal'
          CHECK (project_type IN ('normal', 'git')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workflow_templates (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL CHECK (scope IN ('global', 'project')),
        project_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workflow_template_nodes (
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        node_order INTEGER NOT NULL CHECK (node_order >= 1),
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        cli_tool_id TEXT,
        agent_tool_config_id TEXT,
        requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_tool_config_id) REFERENCES agent_tool_configs(id) ON DELETE SET NULL,
        UNIQUE (template_id, node_order)
      );

      CREATE TABLE IF NOT EXISTS automations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        trigger_type TEXT NOT NULL CHECK (trigger_type IN ('interval', 'daily', 'weekly')),
        trigger_json TEXT NOT NULL,
        timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
        source_task_id TEXT,
        template_json TEXT NOT NULL,
        next_run_at TEXT NOT NULL,
        last_run_at TEXT,
        last_status TEXT CHECK (last_status IS NULL OR last_status IN ('running', 'success', 'failed', 'skipped')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS automation_runs (
        id TEXT PRIMARY KEY,
        automation_id TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        triggered_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'skipped')),
        task_id TEXT,
        task_node_id TEXT,
        session_id TEXT,
        error_message TEXT,
        finished_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
        FOREIGN KEY (task_node_id) REFERENCES task_nodes(id) ON DELETE SET NULL,
        UNIQUE (automation_id, scheduled_at)
      );
    `)
  }

  private createRuntimeTables(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,

        status TEXT NOT NULL DEFAULT 'todo'
          CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),
        task_mode TEXT NOT NULL DEFAULT 'conversation'
          CHECK (task_mode IN ('conversation', 'workflow')),

        project_id TEXT,
        worktree_path TEXT,
        branch_name TEXT,
        base_branch TEXT,
        workspace_path TEXT,

        started_at TEXT,
        completed_at TEXT,
        cost REAL,
        duration REAL,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,

        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,

        CHECK (
          (worktree_path IS NULL AND branch_name IS NULL AND base_branch IS NULL)
          OR
          (worktree_path IS NOT NULL AND branch_name IS NOT NULL AND base_branch IS NOT NULL)
        )
      );

      CREATE TABLE IF NOT EXISTS task_nodes (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,

        node_order INTEGER NOT NULL CHECK (node_order >= 1),

        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        cli_tool_id TEXT
          CHECK (cli_tool_id IS NULL OR cli_tool_id IN (
            'claude-code', 'cursor-agent', 'gemini-cli', 'codex', 'codex-cli', 'opencode'
          )),
        agent_tool_config_id TEXT,

        requires_approval INTEGER NOT NULL DEFAULT 0 CHECK (requires_approval IN (0, 1)),

        status TEXT NOT NULL DEFAULT 'todo'
          CHECK (status IN ('todo', 'in_progress', 'in_review', 'done')),

        session_id TEXT,
        result_summary TEXT,
        error_message TEXT,
        cost REAL,
        duration REAL,

        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,

        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_tool_config_id) REFERENCES agent_tool_configs(id) ON DELETE SET NULL,
        UNIQUE (task_id, node_order)
      );
    `)
  }

  private createBaseIndexes(db: Database.Database): void {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);

      CREATE UNIQUE INDEX IF NOT EXISTS uniq_global_template_name
        ON workflow_templates(name)
        WHERE scope = 'global';
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_project_template_name
        ON workflow_templates(project_id, name)
        WHERE scope = 'project';

      CREATE INDEX IF NOT EXISTS idx_workflow_template_nodes_template_id
        ON workflow_template_nodes(template_id);

      CREATE INDEX IF NOT EXISTS idx_agent_tool_configs_tool_id ON agent_tool_configs(tool_id);

      DROP INDEX IF EXISTS uniq_agent_tool_config;
      DROP INDEX IF EXISTS uniq_agent_tool_default;
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_tool_config
        ON agent_tool_configs(tool_id, name);
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_agent_tool_default
        ON agent_tool_configs(tool_id)
        WHERE is_default = 1;

      CREATE INDEX IF NOT EXISTS idx_automations_enabled_next_run
        ON automations(enabled, next_run_at);

      CREATE INDEX IF NOT EXISTS idx_runs_automation_created
        ON automation_runs(automation_id, created_at);
    `)
  }

  private createRuntimeIndexes(db: Database.Database): void {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

      CREATE UNIQUE INDEX IF NOT EXISTS uniq_tasks_worktree_path
        ON tasks(worktree_path)
        WHERE worktree_path IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_tasks_project_branch
        ON tasks(project_id, branch_name)
        WHERE project_id IS NOT NULL AND branch_name IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_task_nodes_task_id ON task_nodes(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_nodes_status ON task_nodes(status);
      CREATE INDEX IF NOT EXISTS idx_task_nodes_task_status_order
        ON task_nodes(task_id, status, node_order);
      CREATE INDEX IF NOT EXISTS idx_task_nodes_session_id ON task_nodes(session_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_task_nodes_single_in_progress
        ON task_nodes(task_id)
        WHERE status = 'in_progress';
    `)
  }

  private migrateSchema(db: Database.Database, originalUserVersion: number): void {
    let currentVersion = Number(db.pragma('user_version', { simple: true }) ?? originalUserVersion)

    if (currentVersion < 4) {
      const migrateToV4 = db.transaction(() => {
        this.createBaseTables(db)
        this.createBaseIndexes(db)
        db.pragma('user_version = 4')
      })

      migrateToV4()
      currentVersion = 4
      console.log('[DatabaseService] Migrated schema to v4')
    }

    if (currentVersion < TARGET_SCHEMA_VERSION) {
      db.pragma(`user_version = ${TARGET_SCHEMA_VERSION}`)
    }
  }
}
