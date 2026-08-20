'use client'

import { ChatMessage } from '@/components/chat-message'
import { TypingIndicator } from '@/components/typing-indicator'
import { Button } from '@/components/ui/button'
import { Bitcoin, ShieldAlert, SendHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}

const SUGGESTIONS = [
  'What is the difference between Bitcoin and Ethereum?',
  'How does staking work?',
  'Explain the risks of investing in altcoins',
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
          content:
            data.reply?.trim() ||
            "I didn't quite catch that. Could you rephrase your question about crypto?",
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
            "I'm having trouble reaching the advisor right now. Please check your connection and try sending that again in a moment.",
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
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-5 py-4 backdrop-blur-sm">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Bitcoin className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
            Crypto Advisor
          </h1>
          <p className="truncate text-sm text-muted-foreground">AI cryptocurrency assistant</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
          Online
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
              <Bitcoin className="size-8" />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-balance text-xl font-semibold tracking-tight text-foreground">
                Ask me anything about crypto
              </h2>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                Get clear, balanced explanations of markets, blockchain technology, coins, and
                investment concepts — with the risks laid out alongside the opportunities.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="rounded-full bg-card px-4 py-2 text-sm text-card-foreground ring-1 ring-border transition-colors hover:bg-secondary hover:text-foreground"
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
      <div className="border-t border-border bg-background/80 px-4 py-4 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex flex-1 items-end rounded-2xl bg-card px-4 py-2 ring-1 ring-border focus-within:ring-2 focus-within:ring-primary">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask about a coin, market, or concept…"
              aria-label="Message the Crypto Advisor"
              className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="size-11 shrink-0 rounded-xl"
            aria-label="Send message"
          >
            <SendHorizontal className="size-5" />
          </Button>
        </form>
        <p className="mt-2 flex items-center justify-center gap-1.5 px-2 text-center text-xs text-muted-foreground">
          <ShieldAlert className="size-3.5 shrink-0" aria-hidden="true" />
          Not financial advice. Do your own research before investing.
        </p>
      </div>
    </div>
  )
}
