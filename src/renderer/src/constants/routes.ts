export const routes = {
  OVERVIEW: 'overview',
  PROJECTS: 'projects',
  TASKS: 'tasks',
  SKILLS: 'skills',
  MCPS: 'mcps',
  CLI_TOOLS: 'cli-tools',
  SETTINGS: 'settings',
} as const

export type Route = typeof routes[keyof typeof routes]
