'use client'

import { useCryptoNews } from '@/hooks/use-crypto-news'
import { Newspaper } from 'lucide-react'

function timeAgo(pubDate: string): string {
  const diffMs = Date.now() - new Date(pubDate).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NewsPanel() {
  const { items, error } = useCryptoNews()

  return (
    <div className="flex w-full flex-col gap-1 overflow-y-auto p-3">
      <h2 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Crypto News
      </h2>

      {error || items.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">News unavailable right now.</p>
      ) : (
        items.map((item) => (
          <a
            key={item.link}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col gap-1 rounded-md px-2 py-2 transition-all duration-150 hover:bg-secondary"
          >
            <span className="text-xs leading-snug text-foreground">{item.title}</span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Newspaper className="size-3" />
              {item.source} · {timeAgo(item.pubDate)}
            </span>
          </a>
        ))
      )}
    </div>
  )
}
