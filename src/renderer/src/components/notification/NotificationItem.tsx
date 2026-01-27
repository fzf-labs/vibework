import { Notification } from '../../types/notification'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
}

export function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'info':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return '✓'
      case 'error':
        return '✕'
      case 'warning':
        return '⚠'
      case 'info':
      default:
        return 'ℹ'
    }
  }

  const timeAgo = formatDistanceToNow(notification.timestamp, {
    addSuffix: true,
    locale: zhCN
  })

  return (
    <div
      className={`p-4 border rounded-lg ${
        notification.read ? 'bg-gray-50' : 'bg-white'
      } ${getTypeColor(notification.type)} transition-all hover:shadow-md`}
    >
      <div className="flex items-start gap-3">
        {/* 类型图标 */}
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white">
          <span className="text-lg">{getTypeIcon(notification.type)}</span>
        </div>

        {/* 通知内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-gray-900">{notification.title}</h4>
            {!notification.read && (
              <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full"></span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">{notification.body}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span>{timeAgo}</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex-shrink-0 flex gap-2">
          {!notification.read && (
            <button
              onClick={() => onMarkAsRead(notification.id)}
              className="text-blue-600 hover:text-blue-800 text-sm"
              title="标记为已读"
            >
              标记已读
            </button>
          )}
          <button
            onClick={() => onDelete(notification.id)}
            className="text-red-600 hover:text-red-800 text-sm"
            title="删除"
          >
            删除
          </button>
        </div>
      </div>
    </div>
  )
}
