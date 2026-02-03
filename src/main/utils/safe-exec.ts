import { execFile, spawn } from 'child_process'
import type { ExecFileOptions, SpawnOptionsWithoutStdio } from 'child_process'
import { promisify } from 'util'
import { basename } from 'path'
import { auditSecurityEvent } from './security-audit'

const execFileAsync = promisify(execFile)

export class CommandNotAllowedError extends Error {
  constructor(command: string) {
    super(`Command not allowlisted: ${command}`)
    this.name = 'CommandNotAllowedError'
  }
}

export interface SafeExecFileOptions {
  cwd?: string
  env?: NodeJS.ProcessEnv
  timeoutMs?: number
  allowlist: ReadonlySet<string> | string[]
  label?: string
  maxBuffer?: number
}

export interface SafeSpawnOptions extends SpawnOptionsWithoutStdio {
  timeoutMs?: number
  allowlist: ReadonlySet<string> | string[]
  label?: string
  killSignal?: NodeJS.Signals
  killTimeoutMs?: number
}

const normalizeAllowlist = (allowlist: ReadonlySet<string> | string[]): Set<string> => {
  if (allowlist instanceof Set) {
    return new Set([...allowlist].map((entry) => entry.toLowerCase()))
  }
  return new Set(allowlist.map((entry) => entry.toLowerCase()))
}

const resolveCommandKey = (command: string): string => basename(command).toLowerCase()

const assertAllowed = (command: string, allowlist: ReadonlySet<string> | string[], label?: string): void => {
  const normalizedAllowlist = normalizeAllowlist(allowlist)
  const commandKey = resolveCommandKey(command)
  const lowerCommand = command.toLowerCase()

  if (normalizedAllowlist.size === 0) {
    auditSecurityEvent('command_allowlist_empty', { command, label })
    throw new CommandNotAllowedError(command)
  }

  if (!normalizedAllowlist.has(commandKey) && !normalizedAllowlist.has(lowerCommand)) {
    auditSecurityEvent('command_not_allowlisted', { command, label })
    throw new CommandNotAllowedError(command)
  }
}

export async function safeExecFile(
  command: string,
  args: string[],
  options: SafeExecFileOptions
): Promise<{ stdout: string; stderr: string }> {
  assertAllowed(command, options.allowlist, options.label)

  const execOptions: ExecFileOptions = {
    cwd: options.cwd,
    env: options.env,
    timeout: options.timeoutMs,
    windowsHide: true,
    maxBuffer: options.maxBuffer
  }

  return execFileAsync(command, args, execOptions)
}

export function safeSpawn(
  command: string,
  args: string[],
  options: SafeSpawnOptions
) {
  if (options.shell) {
    throw new Error('safeSpawn does not allow shell execution')
  }

  assertAllowed(command, options.allowlist, options.label)

  const child = spawn(command, args, {
    ...options,
    shell: false
  })

  if (options.timeoutMs && options.timeoutMs > 0) {
    const killSignal = options.killSignal ?? 'SIGTERM'
    const killTimeoutMs = options.killTimeoutMs ?? 5000

    const timeoutId = setTimeout(() => {
      if (!child.killed) {
        child.kill(killSignal)
      }

      const forceId = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL')
        }
      }, killTimeoutMs)

      child.once('exit', () => clearTimeout(forceId))
    }, options.timeoutMs)

    child.once('exit', () => clearTimeout(timeoutId))
    child.once('close', () => clearTimeout(timeoutId))
  }

  return child
}
