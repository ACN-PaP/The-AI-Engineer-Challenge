'use client'

import { formatRetrievedAt } from '@/lib/format-date'
import type { Citation } from '@/lib/types'
import { ExternalLink } from 'lucide-react'

export function Citations({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null

  return (
    <div className="mt-2 flex flex-col gap-1 border-t border-black/[0.06] pt-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Sources
      </span>
      {citations.map((citation) => (
        <a
          key={citation.id}
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-secondary"
        >
          <span className="flex items-center gap-1.5 text-card-foreground">
            <ExternalLink className="size-3 shrink-0" />
            <span className="truncate">{citation.title}</span>
          </span>
          <span className="pl-[18px] text-[11px] text-muted-foreground">
            Market data retrieved {formatRetrievedAt(citation.retrievedAt)}
          </span>
        </a>
      ))}
    </div>
  )
}
