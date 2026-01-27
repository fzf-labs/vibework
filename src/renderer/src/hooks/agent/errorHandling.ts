// Error handling utilities for agent

import { getErrorMessages } from './config';

// Helper to format fetch errors with more details (user-friendly, localized)
export function formatFetchError(error: unknown, _endpoint: string): string {
  const err = error as Error;
  const message = err.message || String(error);
  const t = getErrorMessages();

  // Common error patterns - use friendly messages
  if (
    message === 'Load failed' ||
    message === 'Failed to fetch' ||
    message.includes('NetworkError')
  ) {
    return t.connectionFailedFinal;
  }

  if (message.includes('CORS') || message.includes('cross-origin')) {
    return t.corsError;
  }

  if (message.includes('timeout') || message.includes('Timeout')) {
    return t.timeout;
  }

  if (message.includes('ECONNREFUSED')) {
    return t.serverNotRunning;
  }

  // Return generic message for other errors
  return t.requestFailed.replace('{message}', message);
}

// Fetch with retry logic for better resilience
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  const t = getErrorMessages();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError.message || '';

      // Don't retry if aborted
      if (lastError.name === 'AbortError') {
        throw lastError;
      }

      // Only retry on network errors
      const isNetworkError =
        errorMessage === 'Load failed' ||
        errorMessage === 'Failed to fetch' ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('ECONNREFUSED');

      if (!isNetworkError) {
        throw lastError;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = retryDelay * Math.pow(2, attempt);
        const retryMsg = t.retrying
          .replace('{attempt}', String(attempt + 1))
          .replace('{max}', String(maxRetries));
        console.log(`[useAgent] ${retryMsg} (${delay}ms)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}
