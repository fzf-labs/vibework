/**
 * Electron API 封装
 * 替换 Tauri API，提供统一的接口
 */

// 检查是否在 Electron 环境中
export function isElectron(): boolean {
  return typeof window !== 'undefined' && 'api' in window
}

// 文件系统操作
export const fs = {
  /**
   * 读取文件内容
   */
  async readFile(path: string): Promise<Uint8Array> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.fs.readFile(path)
  },

  /**
   * 读取文本文件
   */
  async readTextFile(path: string): Promise<string> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.fs.readTextFile(path)
  },

  /**
   * 写入文件
   */
  async writeFile(path: string, data: Uint8Array | string): Promise<void> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.fs.writeFile(path, data)
  },

  /**
   * 写入文本文件
   */
  async writeTextFile(path: string, content: string): Promise<void> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.fs.writeTextFile(path, content)
  },

  /**
   * 追加写入文本文件
   */
  async appendTextFile(path: string, content: string): Promise<void> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.fs.appendTextFile(path, content)
  },

  /**
   * 获取文件信息
   */
  async stat(path: string): Promise<{ size: number; isFile: boolean; isDirectory: boolean }> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.fs.stat(path)
  },

  /**
   * 读取目录内容
   */
  async readDir(
    path: string,
    options?: { maxDepth?: number }
  ): Promise<{ name: string; path: string; isDir: boolean; children?: unknown[] }[]> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.fs.readDir(path, options)
  },

  /**
   * 检查文件/目录是否存在
   */
  async exists(path: string): Promise<boolean> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.fs.exists(path)
  },

  /**
   * 删除文件/目录
   */
  async remove(path: string, options?: { recursive?: boolean }): Promise<void> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.fs.remove(path, options)
  },
  /**
   * 创建目录
   */
  async mkdir(path: string): Promise<void> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.fs.mkdir(path)
  }
}

// 对话框操作
export const dialog = {
  /**
   * 保存文件对话框
   */
  async save(options: {
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<string | null> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.dialog.save(options)
  },

  /**
   * 打开文件对话框
   */
  async open(options: {
    multiple?: boolean
    directory?: boolean
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<string | string[] | null> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.dialog.open(options)
  }
}

// Shell 操作
export const shell = {
  /**
   * 在默认浏览器中打开 URL
   */
  async openUrl(url: string): Promise<void> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.shell.openUrl(url)
  },

  /**
   * Open a file or folder with the default application
   */
  async openPath(path: string): Promise<void> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.shell.openPath(path)
  },

  /**
   * 在文件管理器中显示文件
   */
  async showItemInFolder(path: string): Promise<void> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.shell.showItemInFolder(path)
  }
}

// 路径操作
export const path = {
  /**
   * 获取应用配置目录
   */
  async appConfigDir(): Promise<string> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.path.appConfigDir()
  },

  /**
   * 获取临时目录
   */
  async tempDir(): Promise<string> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.path.tempDir()
  },

  /**
   * 获取应用资源目录
   */
  async resourcesDir(): Promise<string> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.path.resourcesDir()
  },

  /**
   * 获取应用路径
   */
  async appPath(): Promise<string> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.path.appPath()
  },

  /**
   * 获取应用数据目录 (~/.vibework)
   */
  async vibeworkDataDir(): Promise<string> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.path.vibeworkDataDir()
  },

  /**
   * 获取用户目录
   */
  async homeDir(): Promise<string> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.path.homeDir()
  },

  /**
   * 拼接路径
   */
  join(...paths: string[]): string {
    return paths.join('/')
  }
}

// 应用信息
export const app = {
  /**
   * 获取应用版本
   */
  async getVersion(): Promise<string> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.app.getVersion()
  }
}

export const automation = {
  async create(input: Record<string, unknown>): Promise<unknown> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.automation.create(input)
  },

  async update(id: string, updates: Record<string, unknown>): Promise<unknown> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.automation.update(id, updates)
  },

  async delete(id: string): Promise<boolean> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.automation.delete(id)
  },

  async get(id: string): Promise<unknown> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.automation.get(id)
  },

  async list(): Promise<unknown[]> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.automation.list() as Promise<unknown[]>
  },

  async setEnabled(id: string, enabled: boolean): Promise<unknown> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.automation.setEnabled(id, enabled)
  },

  async runNow(id: string): Promise<unknown> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.automation.runNow(id)
  },

  async listRuns(id: string, limit?: number): Promise<unknown[]> {
    if (!window.api) {
      throw new Error('Electron API not available')
    }
    return window.api.automation.listRuns(id, limit) as Promise<unknown[]>
  }
}
