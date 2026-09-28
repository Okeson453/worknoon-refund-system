import type { ReactNode } from 'react';

export interface PageContainerProps {
  children: ReactNode;
  narrow?: boolean;
}

export function PageContainer({ children, narrow = false }: PageContainerProps): JSX.Element {
  return <main className={narrow ? 'page-container page-container--narrow' : 'page-container'}>{children}</main>;
}
