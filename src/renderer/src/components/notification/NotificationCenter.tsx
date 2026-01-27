import { useState, useEffect } from 'react'
import { notificationStore } from '../../stores/notificationStore'
import { Notification, NotificationFilter } from '../../types/notification'
import { NotificationItem } from './NotificationItem'

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<NotificationFilter>({})
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadNotifications()
    const unsubscribe = notificationStore.subscribe(() => {
      loadNotifications()
    })
    return unsubscribe
  }, [filter])

  const loadNotifications = () => {
    setNotifications(notificationStore.getAll(filter))
    setUnreadCount(notificationStore.getUnreadCount())
  }

  const handleMarkAsRead = (id: string) => {
    notificationStore.markAsRead(id)
  }

  const handleDelete = (id: string) => {
    notificationStore.delete(id)
  }

  const handleMarkAllAsRead = () => {
    notificationStore.markAllAsRead()
  }

  const handleClearAll = () => {
    if (confirm('确定要清空所有通知吗？')) {
      notificationStore.clear()
    }
  }

  const handleFilterChange = (newFilter: NotificationFilter) => {
    setFilter(newFilter)
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 头部 */}
      <div className="bg-white border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">通知中心</h2>
          <span className="text-sm text-gray-500">
            {unreadCount > 0 && `${unreadCount} 条未读`}
          </span>
        </div>

        {/* 过滤器 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => handleFilterChange({})}
            className={`px-3 py-1 rounded ${!filter.type && !filter.read ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            全部
          </button>
          <button
            onClick={() => handleFilterChange({ read: false })}
            className={`px-3 py-1 rounded ${filter.read === false ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            未读
          </button>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button
            onClick={handleMarkAllAsRead}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={unreadCount === 0}
          >
            全部已读
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            disabled={notifications.length === 0}
          >
            清空全部
          </button>
        </div>
      </div>

      {/* 通知列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {notifications.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            暂无通知
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
