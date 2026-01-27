import { notificationStore } from '../../stores/notificationStore'

/**
 * 通知测试按钮组件
 * 用于开发和测试通知系统
 * 使用方法：在任意页面导入并使用 <NotificationTestButton />
 */
export function NotificationTestButton(): JSX.Element {
  const addTestNotification = (type: 'success' | 'info' | 'warning' | 'error'): void => {
    const messages = {
      success: {
        title: '操作成功',
        body: '您的操作已成功完成！'
      },
      info: {
        title: '系统提示',
        body: '这是一条信息通知，用于提醒您注意相关内容。'
      },
      warning: {
        title: '警告提示',
        body: '请注意：检测到潜在的问题，建议您及时处理。'
      },
      error: {
        title: '错误提示',
        body: '操作失败：发生了一个错误，请稍后重试。'
      }
    }

    notificationStore.add({
      type,
      title: messages[type].title,
      body: messages[type].body
    })
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
        border: '1px solid #E8E8E8',
        zIndex: 999
      }}
    >
      <h4
        style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#0D0D0D',
          margin: '0 0 12px 0'
        }}
      >
        测试通知
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={() => addTestNotification('success')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #10B981',
            backgroundColor: '#10B98115',
            color: '#10B981',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          ✓ 成功通知
        </button>
        <button
          onClick={() => addTestNotification('info')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #3B82F6',
            backgroundColor: '#3B82F615',
            color: '#3B82F6',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          ℹ 信息通知
        </button>
        <button
          onClick={() => addTestNotification('warning')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #F59E0B',
            backgroundColor: '#F59E0B15',
            color: '#F59E0B',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          ⚠ 警告通知
        </button>
        <button
          onClick={() => addTestNotification('error')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #EF4444',
            backgroundColor: '#EF444415',
            color: '#EF4444',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          ✕ 错误通知
        </button>
      </div>
    </div>
  )
}
