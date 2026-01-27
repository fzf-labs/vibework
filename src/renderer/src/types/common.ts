export interface BaseEntity {
  id: string
  createdAt: Date
  updatedAt: Date
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface ApiResponse<T> {
  data: T
  error?: string
}
