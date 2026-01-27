import React, { useState } from 'react'
import ApprovalDialog from './ApprovalDialog'

interface ApprovalRequest {
  id: string
  executionId: string
  stageId: string
  stageName: string
  stageDescription?: string
  requestedAt: Date
}

interface ApprovalListProps {
  requests: ApprovalRequest[]
  onApprove: (requestId: string, approvedBy: string) => void
  onReject: (requestId: string) => void
}

const ApprovalList: React.FC<ApprovalListProps> = ({
  requests,
  onApprove,
  onReject
}): JSX.Element | null => {
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null)
  const [showDialog, setShowDialog] = useState(false)

  const handleApprove = (requestId: string): void => {
    onApprove(requestId, 'current-user')
    setShowDialog(false)
    setSelectedRequest(null)
  }

  const handleReject = (requestId: string): void => {
    onReject(requestId)
    setShowDialog(false)
    setSelectedRequest(null)
  }

  const handleRequestClick = (request: ApprovalRequest): void => {
    setSelectedRequest(request)
    setShowDialog(true)
  }

  if (requests.length === 0) {
    return null
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E8E8E8',
          borderRadius: '12px',
          padding: '16px',
          width: '320px',
          maxHeight: '400px',
          overflow: 'auto',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          zIndex: 999
        }}
      >
        <h3
          style={{
            fontFamily: 'Space Grotesk',
            fontSize: '16px',
            fontWeight: '600',
            color: '#0D0D0D',
            marginBottom: '12px'
          }}
        >
          待审批 ({requests.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {requests.map((request) => (
            <div
              key={request.id}
              onClick={() => handleRequestClick(request)}
              style={{
                padding: '12px',
                backgroundColor: '#FAFAFA',
                border: '1px solid #E8E8E8',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <div
                style={{
                  fontFamily: 'Inter',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#0D0D0D',
                  marginBottom: '4px'
                }}
              >
                {request.stageName}
              </div>
              <div
                style={{
                  fontFamily: 'Inter',
                  fontSize: '12px',
                  color: '#7A7A7A'
                }}
              >
                {new Date(request.requestedAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ApprovalDialog
        request={selectedRequest}
        open={showDialog}
        onApprove={handleApprove}
        onReject={handleReject}
        onClose={() => setShowDialog(false)}
      />
    </>
  )
}

export default ApprovalList
