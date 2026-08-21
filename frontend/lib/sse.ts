import type { Citation, StreamError } from '@/lib/types'

export interface SSEEvent {
  type: 'token' | 'citations' | 'error' | 'done'
  token?: string
  citations?: Citation[]
  error?: StreamError
}

/** Splits a growing text buffer into complete `data: ...` payloads plus a remainder to keep
 * buffering, so a payload split across two chunk reads is never parsed prematurely. */
export function extractSSEPayloads(buffer: string): { payloads: string[]; remainder: string } {
  const lines = buffer.split('\n')
  const remainder = lines.pop() ?? ''
  const payloads = lines
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice('data: '.length).trim())
    .filter((payload) => payload.length > 0)
  return { payloads, remainder }
}

export function parseSSEEvent(payload: string): SSEEvent | null {
  try {
    const parsed = JSON.parse(payload)
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
      return parsed as SSEEvent
    }
    return null
  } catch {
    return null
  }
}
