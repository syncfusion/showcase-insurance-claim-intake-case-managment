import type { FC } from 'react';

export const LoadingState: FC<{ label: string; variant?: 'page' | 'overlay' | 'screen' }> = ({ label, variant = 'page' }) => (
  <div className={`app-loading${variant === 'page' ? '' : ` app-loading--${variant}`}`} role="status" aria-live="polite">
    <div className="app-loading__ring" aria-hidden="true" />
    <div>{label}</div>
  </div>
);