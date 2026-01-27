import { Notification, NotificationFilter } from '../types/notification'

class NotificationStore {
  private notifications: Notification[] = []
  private listeners: Set<() => void> = new Set()
  private maxNotifications = 100

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('notifications')
      if (stored) {
        this.notifications = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem('notifications', JSON.stringify(this.notifications))
    } catch (error) {
      console.error('Failed to save notifications:', error)
    }
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }

  subscribe(listener: () => void): () => boolean {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  add(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Notification {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      read: false
    }

    this.notifications.unshift(newNotification)

    // 限制通知数量
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications)
    }

    this.saveToStorage()
    this.notify()
    return newNotification
  }

  getAll(filter?: NotificationFilter): Notification[] {
    let filtered = [...this.notifications]

    if (filter) {
      if (filter.type) {
        filtered = filtered.filter((n) => n.type === filter.type)
      }
      if (filter.read !== undefined) {
        filtered = filtered.filter((n) => n.read === filter.read)
      }
      if (filter.startDate) {
        filtered = filtered.filter((n) => n.timestamp >= filter.startDate!)
      }
      if (filter.endDate) {
        filtered = filtered.filter((n) => n.timestamp <= filter.endDate!)
      }
    }

    return filtered
  }

  getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length
  }

  markAsRead(id: string): void {
    const notification = this.notifications.find((n) => n.id === id)
    if (notification) {
      notification.read = true
      this.saveToStorage()
      this.notify()
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach((n) => (n.read = true))
    this.saveToStorage()
    this.notify()
  }

  delete(id: string): void {
    this.notifications = this.notifications.filter((n) => n.id !== id)
    this.saveToStorage()
    this.notify()
  }

  clear(): void {
    this.notifications = []
    this.saveToStorage()
    this.notify()
  }
}

export const notificationStore = new NotificationStore()
