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

export async function getSessionLogPath(sessionId: string): Promise<string> {
  const root = await getVibeworkDataDir()
  return `${root}/data/sessions/${sessionId}/messages.jsonl`
}

export async function ensureSessionDir(sessionId: string): Promise<string> {
  const root = await getVibeworkDataDir()
  const dir = `${root}/data/sessions/${sessionId}`
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

export async function appendSessionLog(sessionId: string, entry: SessionLogEntry): Promise<void> {
  await ensureSessionDir(sessionId)
  const logPath = await getSessionLogPath(sessionId)
  const line = JSON.stringify(entry) + '\n'
  await fs.appendTextFile(logPath, line)
}

export async function readSessionLogs(sessionId: string): Promise<SessionLogEntry[]> {
  const logPath = await getSessionLogPath(sessionId)
  const exists = await fs.exists(logPath)
  if (!exists) return []
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
