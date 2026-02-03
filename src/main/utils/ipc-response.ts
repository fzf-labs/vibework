import type { IpcMainInvokeEvent } from 'electron'

export interface IpcResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export type Validator<T> = (value: unknown, name: string) => T

type InferShape<T extends Record<string, Validator<unknown>>> = {
  [K in keyof T]: T[K] extends Validator<infer U> ? U : never
}

const fail = (name: string, expected: string): never => {
  throw new Error(`Invalid ${name}: expected ${expected}`)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const v = {
  string:
    (options?: { minLength?: number; allowEmpty?: boolean }): Validator<string> =>
    (value, name) => {
      if (typeof value !== 'string') {
        return fail(name, 'string')
      }
      if (!options?.allowEmpty && options?.minLength === undefined && value.length === 0) {
        return fail(name, 'non-empty string')
      }
      if (options?.minLength !== undefined && value.length < options.minLength) {
        return fail(name, `string length >= ${options.minLength}`)
      }
      return value
    },
  boolean: (): Validator<boolean> => (value, name) => {
    if (typeof value !== 'boolean') {
      return fail(name, 'boolean')
    }
    return value
  },
  number: (options?: { min?: number; max?: number }): Validator<number> => (value, name) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return fail(name, 'number')
    }
    if (options?.min !== undefined && value < options.min) {
      return fail(name, `number >= ${options.min}`)
    }
    if (options?.max !== undefined && value > options.max) {
      return fail(name, `number <= ${options.max}`)
    }
    return value
  },
  array: <T>(itemValidator: Validator<T>): Validator<T[]> => (value, name) => {
    if (!Array.isArray(value)) {
      return fail(name, 'array')
    }
    return value.map((item, index) => itemValidator(item, `${name}[${index}]`))
  },
  object: (): Validator<Record<string, unknown>> => (value, name) => {
    if (!isRecord(value)) {
      return fail(name, 'object')
    }
    return value
  },
  shape:
    <T extends Record<string, Validator<unknown>>>(shape: T): Validator<InferShape<T>> =>
    (value, name) => {
      if (!isRecord(value)) {
        return fail(name, 'object')
      }
      for (const key of Object.keys(shape)) {
        const validator = shape[key]
        validator(value[key], `${name}.${key}`)
      }
      return value as InferShape<T>
    },
  enum:
    <T extends string>(values: readonly T[]): Validator<T> =>
    (value, name) => {
      if (typeof value !== 'string') {
        return fail(name, 'string')
      }
      if (!values.includes(value as T)) {
        return fail(name, `one of ${values.join(', ')}`)
      }
      return value as T
    },
  optional:
    <T>(validator: Validator<T>): Validator<T | undefined> =>
    (value, name) => {
      if (value === undefined) return undefined
      return validator(value, name)
    },
  nullable:
    <T>(validator: Validator<T>): Validator<T | null> =>
    (value, name) => {
      if (value === null) return null
      return validator(value, name)
    }
}

export const validateArgs = <T extends unknown[]>(
  validators: ReadonlyArray<Validator<unknown>>,
  args: unknown[]
): T => {
  return validators.map((validator, index) =>
    validator(args[index], `arg${index + 1}`)
  ) as T
}

export const wrapHandler = <T extends unknown[], R>(
  handler: (event: IpcMainInvokeEvent, ...args: T) => Promise<R> | R,
  validators: ReadonlyArray<Validator<unknown>>
) => {
  return async (event: IpcMainInvokeEvent, ...args: unknown[]): Promise<IpcResponse<R>> => {
    try {
      const parsedArgs = validateArgs(validators, args)
      const data = await handler(event, ...(parsedArgs as T))
      return { success: true, data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}
