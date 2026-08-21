'use client'

import { ChatMessage } from '@/components/chat-message'
import { NewsPanel } from '@/components/news-panel'
import { PriceChart } from '@/components/price-chart'
import { COINS, CoinMeta, PriceTicker } from '@/components/price-ticker'
import { TopicsPanel } from '@/components/topics-panel'
import { TypingIndicator } from '@/components/typing-indicator'
import { Button } from '@/components/ui/button'
import { Watchlist } from '@/components/watchlist'
import { extractSSEPayloads, parseSSEEvent } from '@/lib/sse'
import { TOPIC_CATEGORIES } from '@/lib/topics'
import type { Citation, Message, StreamError } from '@/lib/types'
import { Bitcoin, MessageSquarePlus, ShieldAlert, SendHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/** Client-side mirror of the backend's history window (api/services/conversation.py) — keeps
 * the request payload small; the backend independently enforces its own limit either way. */
const MAX_CLIENT_HISTORY_MESSAGES = 20

const INITIAL_SUGGESTIONS = [
  'What is the difference between Bitcoin and Ethereum?',
  'How does staking work?',
  'Explain the risks of investing in altcoins',
]

class ChatStreamError extends Error {
  code: string
  constructor(error: StreamError) {
    super(error.message)
    this.code = error.code
  }
}

function getFollowUpSuggestions(response: string): string[] {
  const lower = response.toLowerCase()

  for (const topic of TOPIC_CATEGORIES) {
    if (topic.keywords.some((kw) => lower.includes(kw))) {
      return topic.questions
    }
  }

  return [
    'What are the safest crypto investments right now?',
    'How does blockchain technology actually work?',
    'What is DeFi and is it worth the risk?',
  ]
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [followUps, setFollowUps] = useState<string[]>([])
  const [selectedCoin, setSelectedCoin] = useState<CoinMeta>(COINS[0])

  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isLoading])

  async function runAssistantTurn(historyMessages: Message[]) {
    setIsLoading(true)
    setFollowUps([])

    const assistantId = crypto.randomUUID()
    let fullContent = ''
    let firstToken = true
    let receivedDone = false

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyMessages.slice(-MAX_CLIENT_HISTORY_MESSAGES).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          selected_coin_id: selectedCoin.id,
          currency: 'usd',
        }),
      })

      if (!res.ok || !res.body) throw new Error(`Request failed with status ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const { payloads, remainder } = extractSSEPayloads(buffer)
        buffer = remainder

        for (const payload of payloads) {
          const event = parseSSEEvent(payload)
          if (!event) continue

          if (event.type === 'token' && event.token) {
            fullContent += event.token
            if (firstToken) {
              firstToken = false
              setIsLoading(false)
              setMessages((prev) => [
                ...prev,
                { id: assistantId, role: 'assistant', content: fullContent },
              ])
            } else {
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, content: fullContent } : m)),
              )
            }
          } else if (event.type === 'citations') {
            // Keep the already-streamed message intact even if citations are malformed.
            try {
              const citations: Citation[] = event.citations ?? []
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, citations } : m)),
              )
            } catch (citationError) {
              console.log('[chat] failed to attach citations:', citationError)
            }
          } else if (event.type === 'error') {
            throw new ChatStreamError(
              event.error ?? { code: 'unknown_error', message: 'Something went wrong. Please try again.' },
            )
          } else if (event.type === 'done') {
            receivedDone = true
          }
        }
      }

      if (!receivedDone) {
        throw new ChatStreamError({
          code: 'stream_interrupted',
          message: 'The response was interrupted before it finished. Please try again.',
        })
      }

      setFollowUps(getFollowUpSuggestions(fullContent))
    } catch (error) {
      console.log('[chat] request failed:', error)
      const safeMessage =
        error instanceof ChatStreamError
          ? error.message
          : "I'm having trouble reaching the advisor right now. Please check your connection and try again in a moment."

      if (!firstToken) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isError: true } : m)),
        )
      } else {
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', isError: true, content: safeMessage },
        ])
      }
    } finally {
      setIsLoading(false)
      textareaRef.current?.focus()
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    await runAssistantTurn(nextMessages)
  }

  async function retryLastTurn() {
    if (isLoading) return
    const historyWithoutFailedReply = [...messages]
    while (
      historyWithoutFailedReply.length > 0 &&
      historyWithoutFailedReply[historyWithoutFailedReply.length - 1].role === 'assistant'
    ) {
      historyWithoutFailedReply.pop()
    }
    setMessages(historyWithoutFailedReply)
    await runAssistantTurn(historyWithoutFailedReply)
  }

  function handleNewChat() {
    setMessages([])
    setFollowUps([])
    setInput('')
    setIsLoading(false)
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
    <div className="mx-auto flex h-dvh w-full max-w-[1440px]">
      {/* Crypto news sidebar */}
      <aside className="hidden shrink-0 border-r border-border lg:flex lg:w-64">
        <NewsPanel />
      </aside>

      <div className="mx-auto flex h-dvh w-full max-w-3xl flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-5 py-4 backdrop-blur-sm">
        <div className="flex size-10 items-center justify-center rounded-lg bg-linear-to-br from-[#a100ff] to-[#4318ff] text-primary-foreground shadow-[0_0_18px_rgba(161,0,255,0.55)]">
          <Bitcoin className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
            Crypto Advisor
          </h1>
          <p className="truncate text-sm text-muted-foreground">AI cryptocurrency assistant</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleNewChat}
            disabled={messages.length === 0 && !isLoading}
            className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Start a new chat"
          >
            <MessageSquarePlus className="size-3.5" />
            New chat
          </button>
          <div className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
            Online
          </div>
        </div>
      </header>

      {/* Live price ticker */}
      <PriceTicker selectedCoinId={selectedCoin.id} onCoinSelect={setSelectedCoin} />

      {/* Price chart */}
      <PriceChart coinId={selectedCoin.id} symbol={selectedCoin.symbol} name={selectedCoin.name} />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30 shadow-[0_0_24px_rgba(161,0,255,0.5)]">
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
              {INITIAL_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="rounded-full bg-card px-4 py-2 text-sm text-card-foreground ring-1 ring-border transition-all duration-200 hover:bg-secondary hover:text-foreground hover:scale-105 hover:ring-primary/50 hover:shadow-[0_0_14px_rgba(161,0,255,0.35)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m, index) => (
              <ChatMessage
                key={m.id}
                role={m.role}
                content={m.content}
                tone={m.isError ? 'error' : 'default'}
                citations={m.citations}
                onRetry={m.isError && index === messages.length - 1 ? retryLastTurn : undefined}
              />
            ))}

            {isLoading && (
              <ChatMessage role="assistant">
                <TypingIndicator />
              </ChatMessage>
            )}

            {/* Follow-up question chips */}
            {followUps.length > 0 && !isLoading && (
              <div className="flex flex-wrap gap-2 pl-11 pt-1">
                {followUps.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="rounded-full bg-card px-3 py-1.5 text-xs text-card-foreground ring-1 ring-border transition-all duration-200 hover:bg-secondary hover:text-foreground hover:scale-105 hover:ring-primary/50 hover:shadow-[0_0_10px_rgba(161,0,255,0.3)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
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
              placeholder="Ask about a coin, market, or strategy…"
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

      {/* Watchlist + quick topics sidebar */}
      <aside className="hidden shrink-0 flex-col border-l border-border lg:flex lg:w-72">
        <div className="border-b border-border">
          <Watchlist selectedCoinId={selectedCoin.id} onCoinSelect={setSelectedCoin} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <TopicsPanel onSelect={sendMessage} />
        </div>
      </aside>
    </div>
  )
}
