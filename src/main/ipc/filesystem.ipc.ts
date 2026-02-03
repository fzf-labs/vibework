import { app, dialog, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { readFile, writeFile, appendFile, stat, rm, access, readdir, realpath, mkdir } from 'fs/promises'
import type { IpcModuleContext } from './types'
import { assertFsPathAllowed, addAllowedPath } from '../utils/fs-allowlist'
import { assertUrlAllowed } from '../utils/url-guard'
import { IPC_CHANNELS } from './channels'

interface FileEntry {
  name: string
  path: string
  isDir: boolean
  children?: FileEntry[]
}

const readDirTree = async (
  targetPath: string,
  maxDepth: number,
  visited: Set<string>
): Promise<FileEntry[]> => {
  if (maxDepth <= 0) return []
  try {
    const resolved = await realpath(targetPath)
    if (visited.has(resolved)) return []
    visited.add(resolved)
  } catch {
    return []
  }

  const entries = await readdir(targetPath, { withFileTypes: true })
  const results: FileEntry[] = []

  for (const entry of entries) {
    const entryPath = join(targetPath, entry.name)
    let isDir = entry.isDirectory()
    let entryResolvedPath: string | null = null

    if (!isDir && entry.isSymbolicLink()) {
      try {
        entryResolvedPath = await realpath(entryPath)
        const targetStats = await stat(entryResolvedPath)
        isDir = targetStats.isDirectory()
      } catch {
        isDir = false
      }
    }

    if (isDir) {
      let children: FileEntry[] = []
      if (maxDepth > 1) {
        try {
          const resolvedPath = entryResolvedPath || (await realpath(entryPath))
          if (!visited.has(resolvedPath)) {
            children = await readDirTree(entryPath, maxDepth - 1, visited)
          }
        } catch {
          children = []
        }
      }
      results.push({ name: entry.name, path: entryPath, isDir: true, children })
    } else {
      results.push({ name: entry.name, path: entryPath, isDir: false })
    }
  }

  return results
}

export const registerFilesystemIpc = ({
  handle,
  v,
  fileDataValidator,
  getFsAllowlistRoots,
  confirmDestructiveOperation,
  appPaths
}: IpcModuleContext): void => {
  handle(
    IPC_CHANNELS.fs.readDir,
    [
      v.string(),
      v.optional(
        v.shape({
          maxDepth: v.optional(v.number({ min: 1 }))
        })
      )
    ],
    async (_, path, options?: { maxDepth?: number }) => {
      await assertFsPathAllowed(path, getFsAllowlistRoots(), 'fs:readDir')
      const maxDepth = Math.max(1, options?.maxDepth ?? 1)
      return await readDirTree(path, maxDepth, new Set())
    }
  )

  handle(IPC_CHANNELS.fs.readFile, [v.string()], async (_, path) => {
    await assertFsPathAllowed(path, getFsAllowlistRoots(), 'fs:readFile')
    const buffer = await readFile(path)
    return new Uint8Array(buffer)
  })

  handle(IPC_CHANNELS.fs.readTextFile, [v.string()], async (_, path) => {
    await assertFsPathAllowed(path, getFsAllowlistRoots(), 'fs:readTextFile')
    return await readFile(path, 'utf-8')
  })

  handle(IPC_CHANNELS.fs.writeFile, [v.string(), fileDataValidator], async (event, path, data) => {
    await assertFsPathAllowed(path, getFsAllowlistRoots(), 'fs:writeFile')
    try {
      await access(path)
      await confirmDestructiveOperation(event, 'Overwrite file', path)
    } catch {
      // file does not exist
    }
    await writeFile(path, data)
  })

  handle(
    IPC_CHANNELS.fs.writeTextFile,
    [v.string(), v.string({ allowEmpty: true })],
    async (event, path, content) => {
    await assertFsPathAllowed(path, getFsAllowlistRoots(), 'fs:writeTextFile')
    try {
      await access(path)
      await confirmDestructiveOperation(event, 'Overwrite text file', path)
    } catch {
      // file does not exist
    }
    await writeFile(path, content, 'utf-8')
  })

  handle(
    IPC_CHANNELS.fs.appendTextFile,
    [v.string(), v.string({ allowEmpty: true })],
    async (_, path, content) => {
    await assertFsPathAllowed(path, getFsAllowlistRoots(), 'fs:appendTextFile')
    await appendFile(path, content, 'utf-8')
  })

  handle(IPC_CHANNELS.fs.stat, [v.string()], async (_, path) => {
    await assertFsPathAllowed(path, getFsAllowlistRoots(), 'fs:stat')
    const stats = await stat(path)
    return {
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    }
  })

  handle(IPC_CHANNELS.fs.exists, [v.string()], async (_, path) => {
    await assertFsPathAllowed(path, getFsAllowlistRoots(), 'fs:exists')
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  })

  handle(
    IPC_CHANNELS.fs.remove,
    [
      v.string(),
      v.optional(
        v.shape({
          recursive: v.optional(v.boolean())
        })
      )
    ],
    async (event, path, options?: { recursive?: boolean }) => {
      await assertFsPathAllowed(path, getFsAllowlistRoots(), 'fs:remove')
      await confirmDestructiveOperation(
        event,
        options?.recursive ? 'Remove path recursively' : 'Remove path',
        path
      )
      await rm(path, { recursive: options?.recursive || false })
    }
  )

  handle(IPC_CHANNELS.fs.mkdir, [v.string()], async (_, path) => {
    await assertFsPathAllowed(path, getFsAllowlistRoots(), 'fs:mkdir')
    await mkdir(path, { recursive: true })
  })

  handle(IPC_CHANNELS.dialog.save, [v.object()], async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    await addAllowedPath(result.filePath)
    return result.filePath
  })

  handle(IPC_CHANNELS.dialog.open, [v.object()], async (event, options: any) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const normalizedOptions: Record<string, unknown> = { ...options }
    const properties = new Set<string>(
      Array.isArray(normalizedOptions.properties)
        ? (normalizedOptions.properties as string[])
        : []
    )

    if (normalizedOptions.directory === true) {
      properties.add('openDirectory')
    }
    if (normalizedOptions.multiple === true) {
      properties.add('multiSelections')
    }
    if (properties.size > 0) {
      normalizedOptions.properties = Array.from(properties)
    }

    const result = window
      ? await dialog.showOpenDialog(window, normalizedOptions)
      : await dialog.showOpenDialog(normalizedOptions)
    if (result.canceled) return null
    for (const filePath of result.filePaths) {
      await addAllowedPath(filePath)
    }
    return properties.has('multiSelections') ? result.filePaths : result.filePaths[0]
  })

  handle(IPC_CHANNELS.shell.openUrl, [v.string()], async (_, url) => {
    assertUrlAllowed(url, 'shell:openUrl')
    await shell.openExternal(url)
  })

  handle(IPC_CHANNELS.shell.openPath, [v.string()], async (_, path) => {
    await assertFsPathAllowed(path, getFsAllowlistRoots(), 'shell:openPath')
    const result = await shell.openPath(path)
    if (result) {
      throw new Error(result)
    }
  })

  handle(IPC_CHANNELS.shell.showItemInFolder, [v.string()], async (_, path) => {
    await assertFsPathAllowed(path, getFsAllowlistRoots(), 'shell:showItemInFolder')
    shell.showItemInFolder(path)
  })

  handle(IPC_CHANNELS.path.appDataDir, [], () => app.getPath('appData'))
  handle(IPC_CHANNELS.path.appConfigDir, [], () => app.getPath('userData'))
  handle(IPC_CHANNELS.path.tempDir, [], () => app.getPath('temp'))
  handle(IPC_CHANNELS.path.resourcesDir, [], () => process.resourcesPath)
  handle(IPC_CHANNELS.path.appPath, [], () => app.getAppPath())
  handle(IPC_CHANNELS.path.vibeworkDataDir, [], () => appPaths.getRootDir())
  handle(IPC_CHANNELS.path.homeDir, [], () => app.getPath('home'))
}
