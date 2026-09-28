export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function Spinner({ size = 'md', label }: SpinnerProps) {
  return (
    <span className={`spinner spinner--${size}`} role="status" aria-live="polite">
      <span className="visually-hidden">{label ?? 'Loading'}</span>
    </span>
  );
}
