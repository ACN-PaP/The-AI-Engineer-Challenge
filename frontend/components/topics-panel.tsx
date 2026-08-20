'use client'

import { TOPIC_CATEGORIES } from '@/lib/topics'

interface TopicsPanelProps {
  onSelect: (question: string) => void
}

export function TopicsPanel({ onSelect }: TopicsPanelProps) {
  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto p-3">
      <h2 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Quick Topics
      </h2>

      {TOPIC_CATEGORIES.map((topic) => (
        <div key={topic.label} className="flex flex-col gap-1.5">
          <h3 className="px-2 text-xs font-medium text-foreground">{topic.label}</h3>
          <div className="flex flex-col gap-1">
            {topic.questions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onSelect(q)}
                className="rounded-md px-2 py-1.5 text-left text-xs leading-snug text-muted-foreground transition-all duration-150 hover:bg-secondary hover:text-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
