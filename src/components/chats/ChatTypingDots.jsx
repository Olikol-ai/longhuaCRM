export default function ChatTypingDots({ label = 'печатает…', asBubble = false }) {
  if (asBubble) {
    return (
      <div className="lh-chat-typing" role="status" aria-label={label}>
        <span className="lh-chat-typing__dot" aria-hidden />
        <span className="lh-chat-typing__dot" aria-hidden />
        <span className="lh-chat-typing__dot" aria-hidden />
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground" role="status">
      <span className="inline-flex items-center gap-1" aria-hidden>
        <span className="lh-chat-typing__dot" />
        <span className="lh-chat-typing__dot" />
        <span className="lh-chat-typing__dot" />
      </span>
      {label}
    </span>
  );
}
