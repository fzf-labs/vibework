import { fs } from './electron-api'
import { getDataRootDir } from './paths'

export interface SessionLogEntry {
  id?: string
  type: 'stdout' | 'stderr' | 'normalized' | 'finished'
  task_id: string
  session_id: string
  created_at: string
  schema_version?: string
  meta?: Record<string, unknown>
  content?: string
  entry?: unknown
  exit_code?: number
}

export async function getSessionLogPath(
  taskId: string,
  projectId?: string | null
): Promise<string> {
  const root = await getDataRootDir()
  const projectKey = projectId?.trim() || 'project'
  return `${root}/data/sessions/${projectKey}/${taskId}.jsonl`
}

export async function ensureSessionDir(projectId?: string | null): Promise<string> {
  const root = await getDataRootDir()
  const projectKey = projectId?.trim() || 'project'
  const dir = `${root}/data/sessions/${projectKey}`
  try {
    const exists = await fs.exists(dir)
    if (!exists) {
      await fs.mkdir(dir)
    }
  } catch {
    await fs.mkdir(dir)
  }
  return dir
}

export async function appendSessionLog(
  taskId: string,
  entry: SessionLogEntry,
  projectId?: string | null
): Promise<void> {
  await ensureSessionDir(projectId)
  const logPath = await getSessionLogPath(taskId, projectId)
  const line = JSON.stringify(entry) + '\n'
  await fs.appendTextFile(logPath, line)
}

export async function readSessionLogs(
  taskId: string,
  projectId?: string | null
): Promise<SessionLogEntry[]> {
  const logPath = await getSessionLogPath(taskId, projectId)
  const exists = await fs.exists(logPath)
  if (!exists) {
    return []
  }
  const content = await fs.readTextFile(logPath)
  const lines = content.split('\n').filter(Boolean)
  const entries: SessionLogEntry[] = []
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as SessionLogEntry)
    } catch {
      // ignore malformed lines
    }
  }
  return entries
}
