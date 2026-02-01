import { randomUUID } from 'crypto'
import { ulid } from 'ulid'

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/

export function newUlid(): string {
  return ulid().toUpperCase()
}

export function newUuid(): string {
  return randomUUID()
}

export function isUlid(value: unknown): value is string {
  return typeof value === 'string' && ULID_REGEX.test(value)
}
