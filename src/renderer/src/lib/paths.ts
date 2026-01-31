/**
 * Path utilities for VibeWork
 *
 * Uses ~/.VibeWork/ as the standard data directory across all platforms.
 * This follows the Unix dotfile convention used by developer tools like:
 * - ~/.claude/ (Claude Code)
 * - ~/.npm/ (npm)
 * - ~/.docker/ (Docker)
 */

// Cache for resolved paths
let cachedAppDataDir: string | null = null;
let cachedVibeworkDataDir: string | null = null;

/**
 * Check if running in Electron environment
 */
function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  return 'api' in window;
}

/**
 * Get the application data directory
 * Returns ~/.VibeWork on all platforms
 */
export async function getAppDataDir(): Promise<string> {
  if (cachedAppDataDir) {
    return cachedAppDataDir;
  }

  if (isElectron()) {
    try {
      const { path } = await import('./electron-api');
      const appData = await path.appDataDir();
      // Use appData/VibeWork as the data directory
      cachedAppDataDir = `${appData}/VibeWork`;
      return cachedAppDataDir;
    } catch (error) {
      console.warn('[Paths] Failed to get app data dir:', error);
    }
  }

  // Fallback for browser mode
  cachedAppDataDir = '~/.VibeWork';
  return cachedAppDataDir;
}

/**
 * Get the VibeWork data directory
 * Returns ~/.vibework on all platforms
 */
export async function getVibeworkDataDir(): Promise<string> {
  if (cachedVibeworkDataDir) {
    return cachedVibeworkDataDir;
  }

  if (isElectron()) {
    try {
      const { path } = await import('./electron-api');
      cachedVibeworkDataDir = await path.vibeworkDataDir();
      return cachedVibeworkDataDir;
    } catch (error) {
      console.warn('[Paths] Failed to get vibework data dir:', error);
    }
  }

  cachedVibeworkDataDir = '~/.vibework';
  return cachedVibeworkDataDir;
}

/**
 * Get the default working directory for sessions
 */
export async function getDefaultWorkDir(): Promise<string> {
  const appDir = await getAppDataDir();
  return appDir;
}

/**
 * Get the default sessions directory
 */
export async function getSessionsDir(): Promise<string> {
  const appDir = await getAppDataDir();
  return `${appDir}/sessions`;
}

/**
 * Get the default MCP config path
 */
export async function getMcpConfigPath(): Promise<string> {
  const appDir = await getVibeworkDataDir();
  return `${appDir}/mcp/mcp.json`;
}

/**
 * Get the default skills directory
 */
export async function getSkillsDir(): Promise<string> {
  const appDir = await getVibeworkDataDir();
  return `${appDir}/skills`;
}

/**
 * Get the default worktrees directory
 */
export async function getWorktreesDir(): Promise<string> {
  const appDir = await getVibeworkDataDir();
  return `${appDir}/worktrees`;
}

/**
 * Get the default config file path
 */
export async function getConfigPath(): Promise<string> {
  const appDir = await getAppDataDir();
  return `${appDir}/config.json`;
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
      const { path: pathApi } = await import('./electron-api');
      const appData = await pathApi.appDataDir();
      // Extract home directory from appData path
      const home = appData.replace(/\/AppData\/Roaming$/, '').replace(/\/Library\/Application Support$/, '').replace(/\/\.config$/, '');
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
      const { path } = await import('./electron-api');
      const appData = await path.appDataDir();
      // Extract home directory from appData path
      const home = appData
        .replace(/\/AppData\/Roaming$/, '')
        .replace(/\/Library\/Application Support$/, '')
        .replace(/\/\.config$/, '');
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
