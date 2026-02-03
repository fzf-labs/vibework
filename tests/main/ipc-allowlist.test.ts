import { mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertFsPathAllowed } from '../../src/main/utils/fs-allowlist'

const createTempDir = async () => mkdtemp(join(tmpdir(), 'vibework-allowlist-'))

describe('filesystem allowlist', () => {
  it('allows paths within extra roots', async () => {
    const root = await createTempDir()
    const filePath = join(root, 'allowed.txt')
    await writeFile(filePath, 'ok')

    await expect(assertFsPathAllowed(filePath, [root], 'test')).resolves.toBeUndefined()
  })

  it('rejects paths outside extra roots', async () => {
    const root = await createTempDir()
    const otherRoot = await createTempDir()
    const filePath = join(otherRoot, 'blocked.txt')
    await writeFile(filePath, 'nope')

    await expect(assertFsPathAllowed(filePath, [root], 'test')).rejects.toThrow(
      'Path is not allowlisted'
    )
  })
})

describe('url allowlist', () => {
  const originalDomains = process.env.VIBEWORK_ALLOWED_URL_DOMAINS

  afterEach(() => {
    if (originalDomains === undefined) {
      delete process.env.VIBEWORK_ALLOWED_URL_DOMAINS
    } else {
      process.env.VIBEWORK_ALLOWED_URL_DOMAINS = originalDomains
    }
  })

  const loadUrlGuard = async (domains?: string) => {
    if (domains === undefined) {
      delete process.env.VIBEWORK_ALLOWED_URL_DOMAINS
    } else {
      process.env.VIBEWORK_ALLOWED_URL_DOMAINS = domains
    }
    vi.resetModules()
    return await import('../../src/main/utils/url-guard')
  }

  it('rejects non-http protocols', async () => {
    const { assertUrlAllowed } = await loadUrlGuard()
    expect(() => assertUrlAllowed('file:///tmp/example.txt', 'test')).toThrow(
      'URL protocol not allowed'
    )
  })

  it('enforces allowed domains when configured', async () => {
    const { assertUrlAllowed } = await loadUrlGuard('example.com')
    expect(() => assertUrlAllowed('https://example.com', 'test')).not.toThrow()
    expect(() => assertUrlAllowed('https://evil.example.org', 'test')).toThrow(
      'URL domain not allowed'
    )
  })
})
