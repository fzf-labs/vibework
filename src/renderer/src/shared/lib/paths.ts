/**
 * Path utilities for WorkAny
 *
 * Uses ~/.workany/ as the standard data directory across all platforms.
 * This follows the Unix dotfile convention used by developer tools like:
 * - ~/.claude/ (Claude Code)
 * - ~/.npm/ (npm)
 * - ~/.docker/ (Docker)
 */

// Cache for resolved paths
let cachedAppDataDir: string | null = null;

/**
 * Check if running in Tauri environment
 */
function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

/**
 * Get the application data directory
 * Returns ~/.workany on all platforms
 */
export async function getAppDataDir(): Promise<string> {
  if (cachedAppDataDir) {
    return cachedAppDataDir;
  }

  if (isTauri()) {
    try {
      const { homeDir } = await import('@tauri-apps/api/path');
      const home = await homeDir();
      // Remove trailing slash if present
      const homeClean =
        home.endsWith('/') || home.endsWith('\\') ? home.slice(0, -1) : home;
      cachedAppDataDir = `${homeClean}/.workany`;
      return cachedAppDataDir;
    } catch (error) {
      console.warn('[Paths] Failed to get home dir:', error);
    }
  }

  // Fallback for browser mode
  cachedAppDataDir = '~/.workany';
  return cachedAppDataDir;
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
  const appDir = await getAppDataDir();
  return `${appDir}/mcp.json`;
}

/**
 * Get the default skills directory
 */
export async function getSkillsDir(): Promise<string> {
  const appDir = await getAppDataDir();
  return `${appDir}/skills`;
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

  if (isTauri()) {
    try {
      const { homeDir } = await import('@tauri-apps/api/path');
      const home = await homeDir();
      return path.replace(/^~/, home.replace(/\/$/, ''));
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
export async function getDisplayPath(path: string): Promise<string> {
  if (isTauri()) {
    try {
      const { homeDir } = await import('@tauri-apps/api/path');
      const home = await homeDir();
      const homeWithoutSlash = home.replace(/\/$/, '');
      if (path.startsWith(homeWithoutSlash)) {
        return path.replace(homeWithoutSlash, '~');
      }
    } catch {
      // Ignore errors
    }
  }

  return path;
}
