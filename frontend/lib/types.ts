export interface Citation {
  id: string
  title: string
  source: string
  url: string
  retrievedAt: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
  citations?: Citation[]
}

export interface StreamError {
  code: string
  message: string
}
