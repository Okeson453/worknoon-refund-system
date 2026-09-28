import { formatRelative } from '../../utils/formatDate';
import type { ChatEntry } from '../../types/refund';

export interface MessageBubbleProps {
  entry: ChatEntry;
}

export function MessageBubble({ entry }: MessageBubbleProps): JSX.Element {
  const isCustomer = entry.role === 'customer';
  return (
    <article className={isCustomer ? 'message-bubble message-bubble--customer' : 'message-bubble message-bubble--system'}>
      <header className="message-bubble__author">{isCustomer ? 'You' : 'WORKNOON support'}</header>
      <p className="message-bubble__text">{entry.text}</p>
      <footer className="message-bubble__meta">{formatRelative(entry.createdAt)}</footer>
    </article>
  );
}
