import { config } from '../config'
import { auditSecurityEvent } from './security-audit'

const normalizeHost = (host: string): string => host.toLowerCase()

const isAllowedDomain = (host: string, allowedDomains: string[]): boolean => {
  if (allowedDomains.length === 0) return true
  const normalizedHost = normalizeHost(host)
  return allowedDomains.some((domain) => {
    const normalizedDomain = normalizeHost(domain)
    return (
      normalizedHost === normalizedDomain ||
      normalizedHost.endsWith(`.${normalizedDomain}`)
    )
  })
}

export const assertUrlAllowed = (rawUrl: string, label?: string): void => {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    auditSecurityEvent('url_invalid', { url: rawUrl, label })
    throw new Error('Invalid URL')
  }

  const protocol = parsed.protocol.replace(':', '').toLowerCase()
  if (protocol !== 'http' && protocol !== 'https') {
    auditSecurityEvent('url_protocol_not_allowed', { url: rawUrl, label, protocol })
    throw new Error('URL protocol not allowed')
  }

  if (!isAllowedDomain(parsed.hostname, config.ipc.allowedUrlDomains)) {
    auditSecurityEvent('url_domain_not_allowed', { url: rawUrl, label })
    throw new Error('URL domain not allowed')
  }
}
