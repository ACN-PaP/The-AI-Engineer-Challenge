'use client'

import { useCoinPrices } from '@/hooks/use-coin-prices'
import { COINS, CoinMeta } from '@/lib/coins'
import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp } from 'lucide-react'

interface WatchlistProps {
  selectedCoinId: string
  onCoinSelect: (coin: CoinMeta) => void
}

export function Watchlist({ selectedCoinId, onCoinSelect }: WatchlistProps) {
  const { prices, error } = useCoinPrices()
  const items = COINS.filter((c) => prices[c.id])

  return (
    <div className="flex w-full flex-col gap-1 overflow-y-auto p-3">
      <h2 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Watchlist
      </h2>

      {error || items.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">Prices unavailable right now.</p>
      ) : (
        items.map((coin) => {
          const p = prices[coin.id]
          const up = p.usd_24h_change >= 0
          const isSelected = coin.id === selectedCoinId

          return (
            <button
              key={coin.id}
              type="button"
              onClick={() => onCoinSelect(coin)}
              className={cn(
                'flex items-center justify-between rounded-lg px-2 py-2 text-left transition-all duration-150',
                isSelected ? 'bg-primary/15 ring-1 ring-primary/40' : 'hover:bg-secondary',
              )}
            >
              <div className="min-w-0">
                <div className={cn('text-sm font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                  {p.symbol}
                </div>
                <div className="truncate text-xs text-muted-foreground">{p.name}</div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm text-foreground">
                  ${p.usd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
                <span
                  className={cn(
                    'flex items-center gap-0.5 text-xs font-medium',
                    up ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {Math.abs(p.usd_24h_change).toFixed(2)}%
                </span>
              </div>
            </button>
          )
        })
      )}
    </div>
  )
}
