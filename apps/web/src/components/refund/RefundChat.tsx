import { useEffect, useRef } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Spinner } from '../common/Spinner';
import { MessageBubble } from './MessageBubble';
import { MESSAGE_MAX_LENGTH } from '../../types/refund';
import type { ChatEntry } from '../../types/refund';

export interface RefundChatProps {
  entries: ChatEntry[];
  message: string;
  onMessageChange: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  validationMessage: string | null;
}

export function RefundChat({
  entries,
  message,
  onMessageChange,
  onSubmit,
  onReset,
  isSubmitting,
  canSubmit,
  validationMessage,
}: RefundChatProps): JSX.Element {
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [entries.length]);

  const remaining = MESSAGE_MAX_LENGTH - message.length;

  return (
    <Card
      title="4. Describe the problem"
      hint="The AI reads this text. It never decides the outcome."
      className="chat"
      bodyClassName=""
    >
      <div className="chat__thread" ref={threadRef} aria-live="polite" aria-label="Conversation">
        {entries.length === 0 ? (
          <p className="state-block__description">
            Pick a customer, an order and the affected items, then describe what went wrong.
          </p>
        ) : (
          entries.map((entry) => <MessageBubble key={entry.id} entry={entry} />)
        )}
        {isSubmitting ? (
          <div className="message-bubble message-bubble--system" role="status">
            <Spinner size="sm" label="Deciding" />
            <p className="message-bubble__text">Checking the order record and running the refund policy…</p>
          </div>
        ) : null}
      </div>

      <form
        className="chat__composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="form-field">
          <label className="form-field__label" htmlFor="refund-message">
            What is wrong with the item?
          </label>
          <textarea
            id="refund-message"
            className="form-field__control"
            value={message}
            maxLength={MESSAGE_MAX_LENGTH}
            placeholder="For example: the headphones arrived damaged and I would like a refund."
            onChange={(event) => onMessageChange(event.target.value)}
            disabled={isSubmitting}
            aria-describedby="refund-message-hint"
          />
          <p id="refund-message-hint" className={remaining < 0 ? 'chat__counter chat__counter--over' : 'chat__counter'}>
            {remaining} characters remaining
          </p>
        </div>

        {validationMessage !== null ? (
          <p className="field-error" role="alert">
            {validationMessage}
          </p>
        ) : null}

        <div className="chat__composer-row">
          <Button type="submit" variant="primary" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send refund request'}
          </Button>
          <Button variant="ghost" onClick={onReset} disabled={isSubmitting || entries.length === 0}>
            Start a new request
          </Button>
        </div>
      </form>
    </Card>
  );
}
