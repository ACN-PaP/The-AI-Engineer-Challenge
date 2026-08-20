import { MarkdownContent } from '@/components/markdown-content'
import { cn } from '@/lib/utils'
import { Bitcoin, User } from 'lucide-react'
import type { ReactNode } from 'react'

export type ChatRole = 'user' | 'assistant'

interface ChatMessageProps {
  role: ChatRole
  content?: string
  children?: ReactNode
  tone?: 'default' | 'error'
}

export function ChatMessage({ role, content, children, tone = 'default' }: ChatMessageProps) {
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
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30 shadow-[0_0_14px_rgba(161,0,255,0.45)]"
          aria-hidden="true"
        >
          <Bitcoin className="size-4" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed sm:max-w-[72%]',
          isUser
            ? 'rounded-br-sm bg-linear-to-r from-[#a100ff] to-[#4318ff] text-primary-foreground'
            : tone === 'error'
              ? 'rounded-bl-sm bg-destructive/10 text-destructive ring-1 ring-destructive/30'
              : 'rounded-bl-sm bg-white/5 backdrop-blur-md text-card-foreground ring-1 ring-white/10 shadow-lg shadow-black/20',
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
