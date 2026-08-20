'use client'

import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'

export interface CoinMeta {
  id: string
  symbol: string
  name: string
}

interface CoinData extends CoinMeta {
  usd: number
  usd_24h_change: number
}

export const COINS: CoinMeta[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
]

interface PriceTickerProps {
  selectedCoinId: string
  onCoinSelect: (coin: CoinMeta) => void
}

export function PriceTicker({ selectedCoinId, onCoinSelect }: PriceTickerProps) {
  const [prices, setPrices] = useState<Record<string, CoinData>>({})
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchPrices() {
      try {
        const ids = COINS.map((c) => c.id).join(',')
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
        )
        if (!res.ok) throw new Error('fetch failed')
        const data = await res.json()
        const mapped: Record<string, CoinData> = {}
        for (const coin of COINS) {
          if (data[coin.id]) {
            mapped[coin.id] = {
              ...coin,
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
          const isSelected = coin.id === selectedCoinId

          return (
            <button
              key={i}
              type="button"
              onClick={() => onCoinSelect(coin)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-2 py-0.5 text-xs transition-all duration-150',
                isSelected
                  ? 'bg-primary/15 ring-1 ring-primary/40'
                  : 'hover:bg-white/5',
              )}
            >
              <span className={cn('font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                {p.symbol}
              </span>
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
            </button>
          )
        })}
      </div>
    </div>
  )
}
