import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { platform } from 'os'

const execAsync = promisify(exec)

export interface EditorInfo {
  type: 'vscode' | 'cursor' | 'webstorm' | 'idea' | 'other'
  name: string
  path: string
  command: string
  available: boolean
}

export class EditorManager {
  private detectedEditors: EditorInfo[] = []

  constructor() {
    this.detectEditors()
  }

  /**
   * 检测系统中可用的编辑器
   */
  private async detectEditors(): Promise<void> {
    const editors: EditorInfo[] = []
    const os = platform()

    // VSCode
    const vscode = await this.detectVSCode(os)
    if (vscode) editors.push(vscode)

    // Cursor
    const cursor = await this.detectCursor(os)
    if (cursor) editors.push(cursor)

    // WebStorm
    const webstorm = await this.detectWebStorm(os)
    if (webstorm) editors.push(webstorm)

    // IntelliJ IDEA
    const idea = await this.detectIdea(os)
    if (idea) editors.push(idea)

    this.detectedEditors = editors
  }

  /**
   * 检测 VSCode
   */
  private async detectVSCode(os: string): Promise<EditorInfo | null> {
    const paths = this.getVSCodePaths(os)

    for (const path of paths) {
      if (existsSync(path)) {
        return {
          type: 'vscode',
          name: 'Visual Studio Code',
          path,
          command: os === 'win32' ? 'code.cmd' : 'code',
          available: true
        }
      }
    }

    // 尝试通过命令检测
    try {
      await execAsync(os === 'win32' ? 'where code' : 'which code')
      return {
        type: 'vscode',
        name: 'Visual Studio Code',
        path: 'code',
        command: os === 'win32' ? 'code.cmd' : 'code',
        available: true
      }
    } catch {
      return null
    }
  }

  /**
   * 检测 Cursor
   */
  private async detectCursor(os: string): Promise<EditorInfo | null> {
    const paths = this.getCursorPaths(os)

    for (const path of paths) {
      if (existsSync(path)) {
        return {
          type: 'cursor',
          name: 'Cursor',
          path,
          command: 'cursor',
          available: true
        }
      }
    }

    try {
      await execAsync(os === 'win32' ? 'where cursor' : 'which cursor')
      return {
        type: 'cursor',
        name: 'Cursor',
        path: 'cursor',
        command: 'cursor',
        available: true
      }
    } catch {
      return null
    }
  }

  /**
   * 检测 WebStorm
   */
  private async detectWebStorm(os: string): Promise<EditorInfo | null> {
    const paths = this.getWebStormPaths(os)

    for (const path of paths) {
      if (existsSync(path)) {
        return {
          type: 'webstorm',
          name: 'WebStorm',
          path,
          command: 'webstorm',
          available: true
        }
      }
    }

    try {
      await execAsync(os === 'win32' ? 'where webstorm' : 'which webstorm')
      return {
        type: 'webstorm',
        name: 'WebStorm',
        path: 'webstorm',
        command: 'webstorm',
        available: true
      }
    } catch {
      return null
    }
  }

  /**
   * 检测 IntelliJ IDEA
   */
  private async detectIdea(os: string): Promise<EditorInfo | null> {
    const paths = this.getIdeaPaths(os)

    for (const path of paths) {
      if (existsSync(path)) {
        return {
          type: 'idea',
          name: 'IntelliJ IDEA',
          path,
          command: 'idea',
          available: true
        }
      }
    }

    try {
      await execAsync(os === 'win32' ? 'where idea' : 'which idea')
      return {
        type: 'idea',
        name: 'IntelliJ IDEA',
        path: 'idea',
        command: 'idea',
        available: true
      }
    } catch {
      return null
    }
  }

  /**
   * 获取 VSCode 可能的路径
   */
  private getVSCodePaths(os: string): string[] {
    if (os === 'darwin') {
      return ['/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code']
    } else if (os === 'win32') {
      return [
        'C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd',
        'C:\\Program Files (x86)\\Microsoft VS Code\\bin\\code.cmd'
      ]
    } else {
      return ['/usr/bin/code', '/usr/local/bin/code']
    }
  }

  /**
   * 获取 Cursor 可能的路径
   */
  private getCursorPaths(os: string): string[] {
    if (os === 'darwin') {
      return ['/Applications/Cursor.app/Contents/Resources/app/bin/cursor']
    } else if (os === 'win32') {
      return [
        'C:\\Program Files\\Cursor\\bin\\cursor.cmd',
        'C:\\Program Files (x86)\\Cursor\\bin\\cursor.cmd'
      ]
    } else {
      return ['/usr/bin/cursor', '/usr/local/bin/cursor']
    }
  }

  /**
   * 获取 WebStorm 可能的路径
   */
  private getWebStormPaths(os: string): string[] {
    if (os === 'darwin') {
      return ['/Applications/WebStorm.app/Contents/MacOS/webstorm']
    } else if (os === 'win32') {
      return [
        'C:\\Program Files\\JetBrains\\WebStorm\\bin\\webstorm64.exe',
        'C:\\Program Files (x86)\\JetBrains\\WebStorm\\bin\\webstorm.exe'
      ]
    } else {
      return ['/usr/bin/webstorm', '/usr/local/bin/webstorm']
    }
  }

  /**
   * 获取 IntelliJ IDEA 可能的路径
   */
  private getIdeaPaths(os: string): string[] {
    if (os === 'darwin') {
      return ['/Applications/IntelliJ IDEA.app/Contents/MacOS/idea']
    } else if (os === 'win32') {
      return [
        'C:\\Program Files\\JetBrains\\IntelliJ IDEA\\bin\\idea64.exe',
        'C:\\Program Files (x86)\\JetBrains\\IntelliJ IDEA\\bin\\idea.exe'
      ]
    } else {
      return ['/usr/bin/idea', '/usr/local/bin/idea']
    }
  }

  /**
   * 获取所有检测到的编辑器
   */
  getAvailableEditors(): EditorInfo[] {
    return this.detectedEditors
  }

  /**
   * 在指定编辑器中打开项目
   */
  async openProject(projectPath: string, editorCommand: string): Promise<void> {
    try {
      await execAsync(`${editorCommand} "${projectPath}"`)
    } catch (error) {
      throw new Error(`Failed to open project: ${error}`)
    }
  }
}
