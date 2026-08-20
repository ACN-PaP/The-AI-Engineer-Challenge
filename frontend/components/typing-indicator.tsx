export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1" aria-label="Coach is typing">
      <span className="sr-only">Your coach is typing a reply</span>
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60" />
    </div>
  )
}
