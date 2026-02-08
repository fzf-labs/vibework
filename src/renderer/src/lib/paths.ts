import { path as electronPath } from './electron-api';

/**
 * Path utilities for VibeWork
 *
 * Uses ~/.vibework/ as the standard data directory across all platforms.
 * This follows the Unix dotfile convention used by developer tools like:
 * - ~/.claude/ (Claude Code)
 * - ~/.npm/ (npm)
 * - ~/.docker/ (Docker)
 */

// Cache for resolved paths
let cachedDataRootDir: string | null = null;

/**
 * Check if running in Electron environment
 */
function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  return 'api' in window;
}

/**
 * Get the data root directory
 * Returns ~/.vibework on all platforms
 */
export async function getDataRootDir(): Promise<string> {
  if (cachedDataRootDir) {
    return cachedDataRootDir;
  }

  if (isElectron()) {
    try {
      cachedDataRootDir = await electronPath.vibeworkDataDir();
      return cachedDataRootDir;
    } catch (error) {
      console.warn('[Paths] Failed to get data root dir:', error);
    }
  }

  // Fallback for browser mode
  cachedDataRootDir = '~/.vibework';
  return cachedDataRootDir;
}

/**
 * Get the default working directory for sessions
 */
export async function getDefaultWorkDir(): Promise<string> {
  const dataRootDir = await getDataRootDir();
  return dataRootDir;
}

/**
 * Get the default sessions directory
 */
export async function getSessionsDir(): Promise<string> {
  const dataRootDir = await getDataRootDir();
  return `${dataRootDir}/data/sessions`;
}

/**
 * Get the default MCP config path
 */
export async function getMcpConfigPath(): Promise<string> {
  const dataRootDir = await getDataRootDir();
  return `${dataRootDir}/mcp/mcp.json`;
}

/**
 * Get the default skills directory
 */
export async function getSkillsDir(): Promise<string> {
  const dataRootDir = await getDataRootDir();
  return `${dataRootDir}/skills`;
}

/**
 * Get the default worktrees directory
 */
export async function getWorktreesDir(): Promise<string> {
  const dataRootDir = await getDataRootDir();
  return `${dataRootDir}/worktrees`;
}

/**
 * Get the default config file path
 */
export async function getConfigPath(): Promise<string> {
  const dataRootDir = await getDataRootDir();
  return `${dataRootDir}/config.json`;
}

/**
 * Expand ~ to home directory (for display purposes)
 * In Tauri, paths are already expanded. This is mainly for
 * converting user input.
 */
export async function expandPath(path: string): Promise<string> {
  if (!path.startsWith('~')) {
    return path;
  }

  if (isElectron()) {
    try {
      const home = await electronPath.homeDir();
      return path.replace(/^~/, home);
    } catch (error) {
      console.warn('[Paths] Failed to expand path:', error);
    }
  }

  return path;
}

/**
 * Get a display-friendly version of a path
 * Replaces home directory with ~ for cleaner display
 */
export async function getDisplayPath(pathStr: string): Promise<string> {
  if (isElectron()) {
    try {
      const home = await electronPath.homeDir();
      const homeWithoutSlash = home.replace(/\/$/, '');
      if (pathStr.startsWith(homeWithoutSlash)) {
        return pathStr.replace(homeWithoutSlash, '~');
      }
    } catch {
      // Ignore errors
    }
  }

  return pathStr;
}
