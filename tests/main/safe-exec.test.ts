import { basename } from 'path'
import { once } from 'events'
import { describe, expect, it } from 'vitest'
import { CommandNotAllowedError, safeExecFile, safeSpawn } from '../../src/main/utils/safe-exec'

const commandPath = process.execPath
const commandAllowlist = [basename(commandPath)]

describe('safe exec helpers', () => {
  it('rejects commands not in allowlist', async () => {
    await expect(
      safeExecFile('definitely-not-a-real-command', [], {
        allowlist: commandAllowlist,
        timeoutMs: 1000
      })
    ).rejects.toBeInstanceOf(CommandNotAllowedError)
  })

  it('executes allowlisted command', async () => {
    const { stdout } = await safeExecFile(
      commandPath,
      ['-e', 'process.stdout.write("ok")'],
      {
        allowlist: commandAllowlist,
        timeoutMs: 1000
      }
    )

    expect(stdout).toBe('ok')
  })

  it('enforces exec timeouts', async () => {
    await expect(
      safeExecFile(commandPath, ['-e', 'setTimeout(()=>{}, 10000)'], {
        allowlist: commandAllowlist,
        timeoutMs: 50
      })
    ).rejects.toBeInstanceOf(Error)
  })

  it('rejects safeSpawn shell usage', () => {
    expect(() =>
      safeSpawn(commandPath, ['-e', 'process.exit(0)'], {
        allowlist: commandAllowlist,
        shell: true
      } as any)
    ).toThrow('safeSpawn does not allow shell execution')
  })

  it('terminates spawned process after timeout', async () => {
    const child = safeSpawn(commandPath, ['-e', 'setInterval(()=>{}, 1000)'], {
      allowlist: commandAllowlist,
      timeoutMs: 50
    })

    const exitResult = await Promise.race([
      once(child, 'exit'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout waiting for exit')), 1000)
      )
    ])

    const [, signal] = exitResult as [number | null, NodeJS.Signals | null]
    expect(signal || child.killed).toBeTruthy()
  })
})
