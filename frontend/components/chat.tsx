'use client'

import { ChatMessage } from '@/components/chat-message'
import { TypingIndicator } from '@/components/typing-indicator'
import { Button } from '@/components/ui/button'
import { Heart, SendHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}

const SUGGESTIONS = [
  "I'm feeling overwhelmed today",
  'How can I stay motivated?',
  'I want to build my confidence',
]

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`)
      }

      const data: { reply?: string } = await res.json()

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply?.trim() || "I'm here with you, but I didn't quite catch that. Could you try again?",
        },
      ])
    } catch (error) {
      console.log('[v0] chat request failed:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          isError: true,
          content:
            "I'm having a little trouble connecting right now. Take a breath — please try sending that again in a moment.",
        },
      ])
    } finally {
      setIsLoading(false)
      textareaRef.current?.focus()
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-2xl flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border/70 px-5 py-4 backdrop-blur-sm">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Heart className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-serif text-lg font-bold leading-tight text-foreground">Haven</h1>
          <p className="truncate text-sm text-muted-foreground">Your supportive AI coach</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
          Here for you
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Heart className="size-7" />
            </div>
            <div className="max-w-sm space-y-2">
              <h2 className="text-balance font-serif text-xl font-bold text-foreground">
                Hi, I&apos;m glad you&apos;re here.
              </h2>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                This is a calm, judgment-free space. Share what&apos;s on your mind, and we&apos;ll take it one step at a
                time.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="rounded-full bg-card px-4 py-2 text-sm text-card-foreground ring-1 ring-border transition-colors hover:bg-secondary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <ChatMessage key={m.id} role={m.role} tone={m.isError ? 'error' : 'default'}>
                {m.content}
              </ChatMessage>
            ))}
            {isLoading && (
              <ChatMessage role="assistant">
                <TypingIndicator />
              </ChatMessage>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border/70 px-4 py-4">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex flex-1 items-end rounded-3xl bg-card px-4 py-2 ring-1 ring-border focus-within:ring-2 focus-within:ring-primary/50">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Share what's on your mind…"
              aria-label="Message your coach"
              className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="size-11 shrink-0 rounded-full"
            aria-label="Send message"
          >
            <SendHorizontal className="size-5" />
          </Button>
        </form>
        <p className="mt-2 px-2 text-center text-xs text-muted-foreground">
          Haven offers support, not medical advice. In a crisis, please reach out to a professional.
        </p>
      </div>
    </div>
  )
}
