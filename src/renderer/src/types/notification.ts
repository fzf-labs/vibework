export interface Notification {
  id: string
  title: string
  body: string
  type: 'success' | 'info' | 'warning' | 'error'
  timestamp: number
  read: boolean
  actionUrl?: string
  actionLabel?: string
}

export interface NotificationFilter {
  type?: 'success' | 'info' | 'warning' | 'error'
  read?: boolean
  startDate?: number
  endDate?: number
}
