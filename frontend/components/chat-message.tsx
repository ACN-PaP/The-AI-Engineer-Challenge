import { cn } from '@/lib/utils'
import { Bitcoin, User } from 'lucide-react'
import type { ReactNode } from 'react'

export type ChatRole = 'user' | 'assistant'

interface ChatMessageProps {
  role: ChatRole
  children: ReactNode
  tone?: 'default' | 'error'
}

export function ChatMessage({ role, children, tone = 'default' }: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex w-full items-end gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/25"
          aria-hidden="true"
        >
          <Bitcoin className="size-4" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed sm:max-w-[72%]',
          isUser
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : tone === 'error'
              ? 'rounded-bl-sm bg-destructive/10 text-destructive ring-1 ring-destructive/30'
              : 'rounded-bl-sm bg-card text-card-foreground ring-1 ring-border',
        )}
      >
        <div className="whitespace-pre-wrap text-pretty">{children}</div>
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
