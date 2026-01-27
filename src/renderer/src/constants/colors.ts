export const colors = {
  primary: '#646cff',
  primaryHover: '#535bf2',
  background: '#242424',
  surface: '#1a1a1a',
  text: 'rgba(255, 255, 255, 0.87)',
  textSecondary: '#888',
  border: '#333',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#2196f3',
} as const

export type ColorKey = keyof typeof colors
