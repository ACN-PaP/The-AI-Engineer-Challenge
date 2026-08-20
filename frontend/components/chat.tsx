'use client'

import { ChatMessage } from '@/components/chat-message'
import { PriceChart } from '@/components/price-chart'
import { COINS, CoinMeta, PriceTicker } from '@/components/price-ticker'
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

const INITIAL_SUGGESTIONS = [
  'What is the difference between Bitcoin and Ethereum?',
  'How does staking work?',
  'Explain the risks of investing in altcoins',
]

function getFollowUpSuggestions(response: string): string[] {
  const lower = response.toLowerCase()

  const topics: Array<{ keywords: string[]; questions: string[] }> = [
    {
      keywords: ['bitcoin', 'btc'],
      questions: [
        "What drives Bitcoin's price?",
        'How does Bitcoin mining work?',
        'Is Bitcoin good for long-term holding?',
      ],
    },
    {
      keywords: ['ethereum', 'eth', 'ether'],
      questions: [
        'How do Ethereum gas fees work?',
        'What is ETH staking and how does it earn yield?',
        'What are the top Ethereum dApps right now?',
      ],
    },
    {
      keywords: ['staking', 'stake', 'yield', 'validator'],
      questions: [
        'Which coins have the best staking rewards?',
        'What are the risks of staking?',
        'How do I start staking as a beginner?',
      ],
    },
    {
      keywords: ['defi', 'decentralized finance', 'liquidity', 'amm', 'dex'],
      questions: [
        'What are the biggest risks in DeFi?',
        'How does yield farming work?',
        'What are the most trusted DeFi protocols?',
      ],
    },
    {
      keywords: ['nft', 'non-fungible'],
      questions: [
        'How do NFTs derive their value?',
        'What are the best NFT marketplaces?',
        'Are NFTs still a good investment?',
      ],
    },
    {
      keywords: ['altcoin', 'solana', 'sol', 'bnb', 'ada', 'cardano', 'xrp'],
      questions: [
        'How do I research altcoins safely?',
        'What makes a promising altcoin?',
        'How does market cap affect altcoin risk?',
      ],
    },
    {
      keywords: ['risk', 'volatile', 'volatility', 'safe', 'invest', 'portfolio'],
      questions: [
        'How can I reduce my crypto risk exposure?',
        'What is dollar-cost averaging in crypto?',
        'What percentage of a portfolio should be in crypto?',
      ],
    },
    {
      keywords: ['blockchain', 'technology', 'consensus', 'smart contract', 'layer'],
      questions: [
        'What is proof of work vs proof of stake?',
        'How does a blockchain transaction get confirmed?',
        'What is a smart contract and how does it work?',
      ],
    },
    {
      keywords: ['wallet', 'cold', 'hot', 'hardware', 'seed phrase', 'private key'],
      questions: [
        'What is the safest way to store crypto?',
        'What happens if I lose my seed phrase?',
        'What are the best hardware wallets?',
      ],
    },
  ]

  for (const topic of topics) {
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

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)
    setFollowUps([])

    const assistantId = crypto.randomUUID()

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })

      if (!res.ok) throw new Error(`Request failed with status ${res.status}`)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let buffer = ''
      let firstToken = true

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break
          try {
            const parsed = JSON.parse(raw)
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.token) {
              fullContent += parsed.token
              if (firstToken) {
                setMessages((prev) => [
                  ...prev,
                  { id: assistantId, role: 'assistant', content: fullContent },
                ])
                setIsLoading(false)
                firstToken = false
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: fullContent } : m,
                  ),
                )
              }
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }

      if (firstToken) {
        // stream ended with no tokens (empty response)
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: "I didn't quite catch that. Could you rephrase your question about crypto?",
          },
        ])
      }

      setFollowUps(getFollowUpSuggestions(fullContent))
    } catch (error) {
      console.log('[chat] request failed:', error)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          isError: true,
          content:
            "I'm having trouble reaching the advisor right now. Please check your connection and try again in a moment.",
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
        <div className="flex size-10 items-center justify-center rounded-lg bg-linear-to-br from-[#a100ff] to-[#4318ff] text-primary-foreground shadow-[0_0_18px_rgba(161,0,255,0.55)]">
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
            {messages.map((m) => (
              <ChatMessage
                key={m.id}
                role={m.role}
                content={m.content}
                tone={m.isError ? 'error' : 'default'}
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
  )
}
