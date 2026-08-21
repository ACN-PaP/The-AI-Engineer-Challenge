import { Citations } from '@/components/citations'
import { MarkdownContent } from '@/components/markdown-content'
import { cn } from '@/lib/utils'
import type { Citation } from '@/lib/types'
import { Bitcoin, RotateCcw, User } from 'lucide-react'
import type { ReactNode } from 'react'

export type ChatRole = 'user' | 'assistant'

interface ChatMessageProps {
  role: ChatRole
  content?: string
  children?: ReactNode
  tone?: 'default' | 'error'
  citations?: Citation[]
  onRetry?: () => void
}

export function ChatMessage({
  role,
  content,
  children,
  tone = 'default',
  citations,
  onRetry,
}: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div
      className={cn(
        'flex w-full items-end gap-2.5',
        isUser ? 'justify-end' : 'justify-start animate-fade-in-up',
      )}
    >
      {!isUser && (
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 shadow-[0_0_12px_rgba(161,0,255,0.25)]"
          aria-hidden="true"
        >
          <Bitcoin className="size-4" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed sm:max-w-[72%]',
          isUser
            ? 'rounded-br-sm bg-linear-to-r from-[#a100ff] to-[#4318ff] text-white'
            : tone === 'error'
              ? 'rounded-bl-sm bg-red-50 text-red-600 ring-1 ring-red-200'
              : 'rounded-bl-sm bg-white text-card-foreground ring-1 ring-black/[0.08] shadow-sm',
        )}
      >
        {content !== undefined ? (
          isUser ? (
            <p className="whitespace-pre-wrap text-pretty">{content}</p>
          ) : (
            <MarkdownContent>{content}</MarkdownContent>
          )
        ) : (
          <div className="whitespace-pre-wrap text-pretty">{children}</div>
        )}

        {!isUser && citations && citations.length > 0 && <Citations citations={citations} />}

        {tone === 'error' && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-200"
          >
            <RotateCcw className="size-3" />
            Retry
          </button>
        )}
      </div>

      {isUser && (
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground ring-1 ring-border"
          aria-hidden="true"
        >
          <User className="size-4" />
        </div>
      )}
    </div>
  )
}
