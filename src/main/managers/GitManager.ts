import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export class GitManager {
  async clone(remoteUrl: string, targetPath: string): Promise<void> {
    try {
      await execAsync(`git clone ${remoteUrl} "${targetPath}"`)
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error}`)
    }
  }

  async init(path: string): Promise<void> {
    try {
      await execAsync(`git init "${path}"`)
    } catch (error) {
      throw new Error(`Failed to initialize repository: ${error}`)
    }
  }

  async getStatus(path: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`git -C "${path}" status`)
      return stdout
    } catch (error) {
      throw new Error(`Failed to get git status: ${error}`)
    }
  }

  async getBranches(path: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`git -C "${path}" branch --list`)
      return stdout.split('\n').filter(b => b.trim()).map(b => b.replace('*', '').trim())
    } catch (error) {
      throw new Error(`Failed to get branches: ${error}`)
    }
  }

  async getCurrentBranch(path: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`git -C "${path}" branch --show-current`)
      return stdout.trim()
    } catch (error) {
      throw new Error(`Failed to get current branch: ${error}`)
    }
  }
}