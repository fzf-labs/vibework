import { existsSync } from 'fs'
import { realpath } from 'fs/promises'
import { dirname, isAbsolute, relative } from 'path'
import { config } from '../config'
import { auditSecurityEvent } from './security-audit'

const dynamicRoots = new Set<string>()
const baseRoots = new Set<string>()
let baseInitialized = false

const normalizeRoot = async (root: string): Promise<string | null> => {
  if (!root) return null
  try {
    return await realpath(root)
  } catch {
    return null
  }
}

const isWithinRoot = (targetPath: string, root: string): boolean => {
  const rel = relative(root, targetPath)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

const resolveTargetPath = async (targetPath: string): Promise<string> => {
  if (existsSync(targetPath)) {
    return await realpath(targetPath)
  }

  const parentPath = dirname(targetPath)
  const parentRealPath = await realpath(parentPath)
  return parentRealPath
}

const ensureBaseRoots = async (): Promise<void> => {
  if (baseInitialized) return
  baseInitialized = true

  const roots = [config.paths.appRoot, ...config.ipc.allowedFsRoots]
  for (const root of roots) {
    const normalized = await normalizeRoot(root)
    if (normalized) {
      baseRoots.add(normalized)
    }
  }
}

export const addAllowedRoot = async (root: string): Promise<void> => {
  const normalized = await normalizeRoot(root)
  if (normalized) {
    dynamicRoots.add(normalized)
  }
}

export const addAllowedPath = async (targetPath: string): Promise<void> => {
  if (!targetPath) return
  const root = existsSync(targetPath) ? targetPath : dirname(targetPath)
  await addAllowedRoot(root)
}

export const assertFsPathAllowed = async (
  targetPath: string,
  extraRoots: string[] = [],
  label?: string
): Promise<void> => {
  await ensureBaseRoots()
  const resolvedTarget = await resolveTargetPath(targetPath)

  const normalizedExtra: string[] = []
  for (const root of extraRoots) {
    const normalized = await normalizeRoot(root)
    if (normalized) {
      normalizedExtra.push(normalized)
    }
  }

  const roots = [...baseRoots, ...dynamicRoots, ...normalizedExtra]
  const allowed = roots.some((root) => isWithinRoot(resolvedTarget, root))

  if (!allowed) {
    auditSecurityEvent('fs_path_not_allowlisted', { path: targetPath, label })
    throw new Error('Path is not allowlisted')
  }
}
