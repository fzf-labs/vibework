import os from 'os'

export const FALLBACK_SHELL = os.platform() === 'win32' ? 'cmd.exe' : '/bin/sh'

const ALLOWED_ENV_VARS = new Set([
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TERM',
  'TMPDIR',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'LC_MESSAGES',
  'LC_COLLATE',
  'LC_MONETARY',
  'LC_NUMERIC',
  'LC_TIME',
  'TZ',
  'DISPLAY',
  'COLORTERM',
  'TERM_PROGRAM',
  'TERM_PROGRAM_VERSION',
  'COLUMNS',
  'LINES',
  'SSH_AUTH_SOCK',
  'SSH_AGENT_PID',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'http_proxy',
  'https_proxy',
  'NO_PROXY',
  'no_proxy',
  'ALL_PROXY',
  'all_proxy',
  'FTP_PROXY',
  'ftp_proxy',
  'NVM_DIR',
  'NVM_BIN',
  'NVM_INC',
  'NVM_CD_FLAGS',
  'NVM_RC_VERSION',
  'PYENV_ROOT',
  'PYENV_SHELL',
  'PYENV_VERSION',
  'RBENV_ROOT',
  'RBENV_SHELL',
  'RBENV_VERSION',
  'GOPATH',
  'GOROOT',
  'GOBIN',
  'CARGO_HOME',
  'RUSTUP_HOME',
  'DENO_DIR',
  'DENO_INSTALL',
  'BUN_INSTALL',
  'PNPM_HOME',
  'VOLTA_HOME',
  'ASDF_DIR',
  'ASDF_DATA_DIR',
  'FNM_DIR',
  'FNM_MULTISHELL_PATH',
  'FNM_NODE_DIST_MIRROR',
  'SDKMAN_DIR',
  'HOMEBREW_PREFIX',
  'HOMEBREW_CELLAR',
  'HOMEBREW_REPOSITORY',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_CACHE_HOME',
  'XDG_STATE_HOME',
  'XDG_RUNTIME_DIR',
  'EDITOR',
  'VISUAL',
  'PAGER',
  '__CF_USER_TEXT_ENCODING',
  'Apple_PubSub_Socket_Render',
  'COMSPEC',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
  'PROGRAMFILES',
  'PROGRAMFILES(X86)',
  'SYSTEMROOT',
  'WINDIR',
  'TEMP',
  'TMP',
  'PATHEXT',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'NODE_EXTRA_CA_CERTS',
  'REQUESTS_CA_BUNDLE',
  'GIT_SSH_COMMAND',
  'GIT_AUTHOR_NAME',
  'GIT_AUTHOR_EMAIL',
  'GIT_COMMITTER_NAME',
  'GIT_COMMITTER_EMAIL',
  'GIT_EDITOR',
  'GIT_PAGER',
  'AWS_PROFILE',
  'AWS_DEFAULT_REGION',
  'AWS_REGION',
  'AWS_CONFIG_FILE',
  'AWS_SHARED_CREDENTIALS_FILE',
  'DOCKER_HOST',
  'DOCKER_CONFIG',
  'DOCKER_CERT_PATH',
  'DOCKER_TLS_VERIFY',
  'COMPOSE_PROJECT_NAME',
  'KUBECONFIG',
  'KUBE_CONFIG_PATH',
  'CLOUDSDK_CONFIG',
  'AZURE_CONFIG_DIR',
  'JAVA_HOME',
  'ANDROID_HOME',
  'ANDROID_SDK_ROOT',
  'FLUTTER_ROOT',
  'DOTNET_ROOT'
])

const ALLOWED_PREFIXES = ['VIBEWORK_', 'LC_']

function isAllowedVar(key: string, isWindows: boolean): boolean {
  if (isWindows) {
    return ALLOWED_ENV_VARS.has(key.toUpperCase())
  }
  return ALLOWED_ENV_VARS.has(key)
}

function hasAllowedPrefix(key: string, isWindows: boolean): boolean {
  const normalized = isWindows ? key.toUpperCase() : key
  return ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

function sanitizeEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const sanitized: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      sanitized[key] = value
    }
  }
  return sanitized
}

export function buildSafeEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const currentPlatform = os.platform()
  const isWindows = currentPlatform === 'win32'
  const raw = sanitizeEnv(env)
  const safe: Record<string, string> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (isAllowedVar(key, isWindows) || hasAllowedPrefix(key, isWindows)) {
      safe[key] = value
    }
  }

  return safe
}

function resolveLocale(env: NodeJS.ProcessEnv): string {
  const lang = env.LANG
  if (lang && lang.includes('UTF-8')) return lang
  const lcAll = env.LC_ALL
  if (lcAll && lcAll.includes('UTF-8')) return lcAll
  return 'en_US.UTF-8'
}

export function getDefaultShell(): string {
  if (os.platform() !== 'win32' && process.env.SHELL) {
    return process.env.SHELL
  }
  if (os.platform() === 'win32') {
    return process.env.COMSPEC || FALLBACK_SHELL
  }
  return '/bin/zsh'
}

export function buildTerminalEnv(params: {
  paneId: string
  workspaceId?: string | null
  shell: string
}): Record<string, string> {
  const baseEnv = buildSafeEnv(process.env)
  const locale = resolveLocale(process.env)

  return {
    ...baseEnv,
    SHELL: params.shell,
    TERM: 'xterm-256color',
    TERM_PROGRAM: 'VibeWork',
    TERM_PROGRAM_VERSION: process.env.npm_package_version || '1.0.0',
    COLORTERM: 'truecolor',
    LANG: locale,
    VIBEWORK_PANE_ID: params.paneId,
    VIBEWORK_WORKSPACE_ID: params.workspaceId || ''
  }
}
