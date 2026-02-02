import { fs } from './electron-api'
import { getVibeworkDataDir } from './paths'

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
  sessionId: string,
  projectId?: string | null
): Promise<string> {
  const root = await getVibeworkDataDir()
  const projectKey = projectId?.trim() || 'project'
  return `${root}/data/sessions/${projectKey}/${sessionId}.jsonl`
}

export async function ensureSessionDir(
  sessionId: string,
  projectId?: string | null
): Promise<string> {
  const root = await getVibeworkDataDir()
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
  sessionId: string,
  entry: SessionLogEntry,
  projectId?: string | null
): Promise<void> {
  await ensureSessionDir(sessionId, projectId)
  const logPath = await getSessionLogPath(sessionId, projectId)
  const line = JSON.stringify(entry) + '\n'
  await fs.appendTextFile(logPath, line)
}

export async function readSessionLogs(
  sessionId: string,
  projectId?: string | null
): Promise<SessionLogEntry[]> {
  const logPath = await getSessionLogPath(sessionId, projectId)
  const exists = await fs.exists(logPath)
  if (!exists) {
    const root = await getVibeworkDataDir()
    const legacyPath = `${root}/data/sessions/${sessionId}/messages.jsonl`
    const legacyExists = await fs.exists(legacyPath)
    if (!legacyExists) return []
    const legacyContent = await fs.readTextFile(legacyPath)
    const legacyLines = legacyContent.split('\n').filter(Boolean)
    const legacyEntries: SessionLogEntry[] = []
    for (const line of legacyLines) {
      try {
        legacyEntries.push(JSON.parse(line) as SessionLogEntry)
      } catch {
        // ignore malformed lines
      }
    }
    return legacyEntries
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
