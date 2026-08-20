'use client'

import { COINS, CoinMeta } from '@/lib/coins'
import { useEffect, useState } from 'react'

export interface CoinData extends CoinMeta {
  usd: number
  usd_24h_change: number
}

export function useCoinPrices() {
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

  return { prices, error }
}
