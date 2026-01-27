import { useState, useEffect, useRef, useCallback } from 'react'
import { notificationStore } from '../../stores/notificationStore'
import { Notification } from '../../types/notification'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function NotificationButton(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadNotifications = useCallback((): void => {
    const allNotifications = notificationStore.getAll()
    setNotifications(allNotifications.slice(0, 5)) // 只显示最近5条
    setUnreadCount(notificationStore.getUnreadCount())
  }, [])

  useEffect(() => {
    const initialLoad = setTimeout(() => {
      loadNotifications()
    }, 0)
    const unsubscribe = notificationStore.subscribe(() => {
      loadNotifications()
    })
    return () => {
      clearTimeout(initialLoad)
      unsubscribe()
    }
  }, [loadNotifications])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMarkAsRead = (id: string): void => {
    notificationStore.markAsRead(id)
  }

  const handleDelete = (id: string): void => {
    notificationStore.delete(id)
  }

  const handleMarkAllAsRead = (): void => {
    notificationStore.markAllAsRead()
  }

  const getTypeIcon = (type: string): string => {
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

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'success':
        return '#10B981'
      case 'error':
        return '#EF4444'
      case 'warning':
        return '#F59E0B'
      case 'info':
      default:
        return '#3B82F6'
    }
  }

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* 通知按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'relative',
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          border: '1px solid #E8E8E8',
          backgroundColor: isOpen ? '#F5F5F5' : '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = '#F5F5F5'
        }}
        onMouseLeave={(e) => {
          if (!isOpen) e.currentTarget.style.backgroundColor = '#FFFFFF'
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15 6.66667C15 5.34058 14.4732 4.06881 13.5355 3.13113C12.5979 2.19345 11.3261 1.66667 10 1.66667C8.67392 1.66667 7.40215 2.19345 6.46447 3.13113C5.52678 4.06881 5 5.34058 5 6.66667C5 12.5 2.5 14.1667 2.5 14.1667H17.5C17.5 14.1667 15 12.5 15 6.66667Z"
            stroke="#0D0D0D"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M11.4417 17.5C11.2952 17.7526 11.0849 17.9622 10.8319 18.1079C10.5789 18.2537 10.292 18.3304 10 18.3304C9.70802 18.3304 9.42115 18.2537 9.16815 18.1079C8.91515 17.9622 8.70486 17.7526 8.55835 17.5"
            stroke="#0D0D0D"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* 未读数量徽章 */}
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              minWidth: '18px',
              height: '18px',
              borderRadius: '9px',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 下拉面板 */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '48px',
            right: '0',
            width: '400px',
            maxHeight: '500px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
            border: '1px solid #E8E8E8',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* 头部 */}
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid #E8E8E8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <h3
              style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#0D0D0D',
                margin: 0
              }}
            >
              通知
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                style={{
                  fontSize: '13px',
                  color: '#3B82F6',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                全部已读
              </button>
            )}
          </div>

          {/* 通知列表 */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: '400px'
            }}
          >
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: '#9CA3AF',
                  fontSize: '14px'
                }}
              >
                暂无通知
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationDropdownItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                  getTypeIcon={getTypeIcon}
                  getTypeColor={getTypeColor}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// 通知项组件
interface NotificationDropdownItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
  getTypeIcon: (type: string) => string
  getTypeColor: (type: string) => string
}

function NotificationDropdownItem({
  notification,
  onMarkAsRead,
  onDelete,
  getTypeIcon,
  getTypeColor
}: NotificationDropdownItemProps): JSX.Element {
  const [isHovered, setIsHovered] = useState(false)

  const timeAgo = formatDistanceToNow(notification.timestamp, {
    addSuffix: true,
    locale: zhCN
  })

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid #F3F4F6',
        backgroundColor: notification.read ? '#FFFFFF' : '#F9FAFB',
        cursor: 'pointer',
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: 'flex', gap: '12px' }}>
        {/* 类型图标 */}
        <div
          style={{
            flexShrink: 0,
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: `${getTypeColor(notification.type)}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: getTypeColor(notification.type),
            fontSize: '16px'
          }}
        >
          {getTypeIcon(notification.type)}
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '8px' }}>
            <h4
              style={{
                fontSize: '14px',
                fontWeight: notification.read ? '400' : '600',
                color: '#0D0D0D',
                margin: 0,
                flex: 1
              }}
            >
              {notification.title}
            </h4>
            {!notification.read && (
              <span
                style={{
                  flexShrink: 0,
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#3B82F6',
                  marginTop: '4px'
                }}
              />
            )}
          </div>
          <p
            style={{
              fontSize: '13px',
              color: '#6B7280',
              margin: '4px 0 0 0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {notification.body}
          </p>
          <div
            style={{
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{timeAgo}</span>
            {isHovered && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {!notification.read && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onMarkAsRead(notification.id)
                    }}
                    style={{
                      fontSize: '12px',
                      color: '#3B82F6',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    标记已读
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(notification.id)
                  }}
                  style={{
                    fontSize: '12px',
                    color: '#EF4444',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  删除
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
