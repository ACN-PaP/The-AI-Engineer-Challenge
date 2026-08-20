'use client'

import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'

interface CoinData {
  symbol: string
  usd: number
  usd_24h_change: number
}

const COINS = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'solana', symbol: 'SOL' },
  { id: 'binancecoin', symbol: 'BNB' },
  { id: 'ripple', symbol: 'XRP' },
  { id: 'cardano', symbol: 'ADA' },
]

export function PriceTicker() {
  const [prices, setPrices] = useState<Record<string, CoinData>>({})
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchPrices() {
      try {
        const ids = COINS.map((c) => c.id).join(',')
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
          { next: { revalidate: 0 } },
        )
        if (!res.ok) throw new Error('fetch failed')
        const data = await res.json()
        const mapped: Record<string, CoinData> = {}
        for (const coin of COINS) {
          if (data[coin.id]) {
            mapped[coin.id] = {
              symbol: coin.symbol,
              usd: data[coin.id].usd,
              usd_24h_change: data[coin.id].usd_24h_change ?? 0,
            }
          }
        }
        setPrices(mapped)
        setError(false)
      } catch {
        setError(true)
      }
    }

    fetchPrices()
    const id = setInterval(fetchPrices, 60_000)
    return () => clearInterval(id)
  }, [])

  const items = COINS.filter((c) => prices[c.id])
  if (error || items.length === 0) return null

  return (
    <div className="overflow-hidden border-b border-border bg-background/60 backdrop-blur-sm">
      <div className="flex w-max animate-ticker gap-10 px-6 py-1.5 whitespace-nowrap">
        {[...items, ...items].map((coin, i) => {
          const p = prices[coin.id]
          const up = p.usd_24h_change >= 0
          return (
            <span key={i} className="inline-flex items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">{p.symbol}</span>
              <span className="text-muted-foreground">
                ${p.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
              <span
                className={cn(
                  'flex items-center gap-0.5 font-medium',
                  up ? 'text-emerald-400' : 'text-red-400',
                )}
              >
                {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                {Math.abs(p.usd_24h_change).toFixed(2)}%
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
