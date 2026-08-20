'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface PriceChartProps {
  coinId: string
  symbol: string
  name: string
}

interface DataPoint {
  time: string
  price: number
}

const RANGES = [
  { label: '1D', days: 1 },
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
]

function sampleData(raw: [number, number][], maxPoints: number): DataPoint[] {
  const step = Math.max(1, Math.floor(raw.length / maxPoints))
  return raw
    .filter((_, i) => i % step === 0 || i === raw.length - 1)
    .map(([ts, price]) => ({
      time: ts,
      price: parseFloat(price.toFixed(2)),
    }))
    .map(({ time, price }) => ({
      time: new Date(time).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      price,
    }))
}

function formatPrice(v: number) {
  if (v >= 10000) return `$${(v / 1000).toFixed(1)}k`
  if (v >= 1000) return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (v >= 1) return `$${v.toFixed(2)}`
  return `$${v.toFixed(4)}`
}

export function PriceChart({ coinId, symbol, name }: PriceChartProps) {
  const [data, setData] = useState<DataPoint[]>([])
  const [range, setRange] = useState(7)
  const [loading, setLoading] = useState(true)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [priceChange, setPriceChange] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchChart() {
      setLoading(true)
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${range}`,
        )
        if (!res.ok) throw new Error('fetch failed')
        const json = await res.json()
        if (cancelled) return

        const raw: [number, number][] = json.prices
        const maxPoints = range === 1 ? 24 : range <= 7 ? raw.length : 60
        const points = sampleData(raw, maxPoints)

        setData(points)
        if (points.length >= 2) {
          const first = points[0].price
          const last = points[points.length - 1].price
          setCurrentPrice(last)
          setPriceChange(((last - first) / first) * 100)
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchChart()
    return () => { cancelled = true }
  }, [coinId, range])

  const isUp = (priceChange ?? 0) >= 0

  return (
    <div className="border-b border-border bg-background/60 px-4 pt-3 pb-2 backdrop-blur-sm">
      {/* Header row */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-sm font-bold text-foreground">{symbol}/USD</span>
          <span className="truncate text-xs text-muted-foreground">{name}</span>
          {currentPrice !== null && (
            <span className="text-sm font-semibold text-foreground">
              {formatPrice(currentPrice)}
            </span>
          )}
          {priceChange !== null && (
            <span
              className={cn(
                'text-xs font-medium',
                isUp ? 'text-emerald-400' : 'text-red-400',
              )}
            >
              {isUp ? '+' : ''}
              {priceChange.toFixed(2)}%
            </span>
          )}
        </div>

        {/* Range selector */}
        <div className="flex shrink-0 gap-0.5 rounded-lg bg-secondary p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRange(r.days)}
              className={cn(
                'rounded-md px-2 py-0.5 text-xs font-medium transition-all',
                range === r.days
                  ? 'bg-primary text-white shadow-[0_0_8px_rgba(161,0,255,0.5)]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[130px]">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex gap-1.5">
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-primary" />
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 2, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${coinId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a100ff" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#a100ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 9, fill: '#52525b' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                tickCount={4}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#52525b' }}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={formatPrice}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  background: '#161616',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                  padding: '6px 10px',
                }}
                labelStyle={{ color: '#71717a', marginBottom: 2 }}
                formatter={(v: number) => [formatPrice(v), symbol]}
                cursor={{ stroke: 'rgba(161,0,255,0.4)', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={isUp ? '#a100ff' : '#ef4444'}
                strokeWidth={2}
                fill={`url(#grad-${coinId})`}
                dot={false}
                activeDot={{ r: 3, fill: '#a100ff', strokeWidth: 0 }}
                isAnimationActive={true}
                animationDuration={400}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
