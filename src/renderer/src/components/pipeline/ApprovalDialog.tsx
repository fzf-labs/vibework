import React from 'react'

interface ApprovalRequest {
  id: string
  executionId: string
  stageId: string
  stageName: string
  stageDescription?: string
  requestedAt: Date
}

interface ApprovalDialogProps {
  request: ApprovalRequest | null
  open: boolean
  onApprove: (requestId: string) => void
  onReject: (requestId: string) => void
  onClose: () => void
}

const ApprovalDialog: React.FC<ApprovalDialogProps> = ({
  request,
  open,
  onApprove,
  onReject,
  onClose
}) => {
  if (!open || !request) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          padding: '24px',
          width: '500px',
          maxHeight: '80vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontFamily: 'Space Grotesk',
            fontSize: '20px',
            fontWeight: '600',
            color: '#0D0D0D',
            marginBottom: '16px'
          }}
        >
          审批请求
        </h2>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '12px' }}>
            <label
              style={{
                fontFamily: 'Inter',
                fontSize: '14px',
                fontWeight: '500',
                color: '#0D0D0D',
                display: 'block',
                marginBottom: '4px'
              }}
            >
              环节名称
            </label>
            <span
              style={{
                fontFamily: 'Inter',
                fontSize: '14px',
                color: '#7A7A7A'
              }}
            >
              {request.stageName}
            </span>
          </div>

          {request.stageDescription && (
            <div style={{ marginBottom: '12px' }}>
              <label
                style={{
                  fontFamily: 'Inter',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#0D0D0D',
                  display: 'block',
                  marginBottom: '4px'
                }}
              >
                描述
              </label>
              <span
                style={{
                  fontFamily: 'Inter',
                  fontSize: '14px',
                  color: '#7A7A7A'
                }}
              >
                {request.stageDescription}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onReject(request.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid #E8E8E8',
              backgroundColor: '#FFFFFF',
              color: '#0D0D0D',
              cursor: 'pointer',
              fontFamily: 'Inter',
              fontSize: '14px'
            }}
          >
            拒绝
          </button>
          <button
            onClick={() => onApprove(request.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontFamily: 'Inter',
              fontSize: '14px'
            }}
          >
            批准
          </button>
        </div>
      </div>
    </div>
  )
}

export default ApprovalDialog
