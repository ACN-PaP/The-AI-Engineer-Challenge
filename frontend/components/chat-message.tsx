import { cn } from '@/lib/utils'
import { Heart, User } from 'lucide-react'
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
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
          aria-hidden="true"
        >
          <Heart className="size-4" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[80%] rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm sm:max-w-[70%]',
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : tone === 'error'
              ? 'rounded-bl-md bg-destructive/10 text-destructive'
              : 'rounded-bl-md bg-card text-card-foreground ring-1 ring-border',
        )}
      >
        <div className="whitespace-pre-wrap text-pretty">{children}</div>
      </div>

      {isUser && (
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"
          aria-hidden="true"
        >
          <User className="size-4" />
        </div>
      )}
    </div>
  )
}
