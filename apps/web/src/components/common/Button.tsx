import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'default' | 'ghost';
type Size = 'default' | 'small';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'default', size = 'default', block = false, className, type = 'button', children, ...rest }: ButtonProps) {
  const classes = [
    'button',
    variant === 'primary' ? 'button--primary' : '',
    variant === 'ghost' ? 'button--ghost' : '',
    size === 'small' ? 'button--small' : '',
    block ? 'button--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
