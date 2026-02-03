import { homedir } from 'os'
import { join } from 'path'

const parseCsv = (value?: string): string[] =>
  value
    ? value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : []

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const defaultCommandAllowlist = [
  'git',
  'node',
  'npm',
  'pnpm',
  'bun',
  'yarn',
  'code',
  'cursor',
  'webstorm',
  'idea',
  'goland',
  'xed',
  'antigravity',
  'claude',
  'codex',
  'gemini',
  'opencode',
  'cursor-agent',
  'which',
  'where'
]

const appRoot = join(homedir(), '.vibework')

export const config = {
  paths: {
    appRoot,
    logsDir: join(appRoot, 'logs')
  },
  models: {
    claudeDefaultModel: process.env.VIBEWORK_CLAUDE_MODEL || 'sonnet'
  },
  commandAllowlist: new Set(
    [...defaultCommandAllowlist, ...parseCsv(process.env.VIBEWORK_COMMAND_ALLOWLIST)].map(
      (entry) => entry.toLowerCase()
    )
  ),
  commandTimeoutMs: parseNumber(process.env.VIBEWORK_COMMAND_TIMEOUT_MS, 30000),
  log: {
    batchFlushIntervalMs: parseNumber(process.env.VIBEWORK_LOG_FLUSH_INTERVAL_MS, 50),
    maxBatchBytes: parseNumber(process.env.VIBEWORK_LOG_BATCH_MAX_BYTES, 256 * 1024),
    rotation: {
      maxFileBytes: parseNumber(process.env.VIBEWORK_LOG_MAX_BYTES, 10 * 1024 * 1024),
      maxFiles: parseNumber(process.env.VIBEWORK_LOG_MAX_FILES, 5)
    }
  },
  ipc: {
    allowedUrlDomains: parseCsv(process.env.VIBEWORK_ALLOWED_URL_DOMAINS),
    allowedFsRoots: parseCsv(process.env.VIBEWORK_ALLOWED_FS_ROOTS)
  }
}
