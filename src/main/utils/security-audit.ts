export type SecurityAuditLevel = 'info' | 'warn' | 'error'

export interface SecurityAuditEvent {
  level: SecurityAuditLevel
  event: string
  timestamp: string
  details?: Record<string, unknown>
}

export function auditSecurityEvent(
  event: string,
  details?: Record<string, unknown>,
  level: SecurityAuditLevel = 'warn'
): void {
  const payload: SecurityAuditEvent = {
    level,
    event,
    timestamp: new Date().toISOString(),
    details
  }

  const serialized = JSON.stringify(payload)
  if (level === 'error') {
    console.error(`[SecurityAudit] ${serialized}`)
    return
  }

  if (level === 'info') {
    console.info(`[SecurityAudit] ${serialized}`)
    return
  }

  console.warn(`[SecurityAudit] ${serialized}`)
}
