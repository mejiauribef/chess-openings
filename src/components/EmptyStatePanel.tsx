import type { ReactNode } from 'react';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface EmptyStatePanelProps {
  title: string;
  description: string;
  tips?: string[];
  actions?: EmptyStateAction[];
  icon?: ReactNode;
}

export function EmptyStatePanel({
  title,
  description,
  tips = [],
  actions = [],
  icon,
}: EmptyStatePanelProps) {
  return (
    <div className="empty-state-panel">
      {icon ? <div className="empty-state-panel__icon">{icon}</div> : null}
      <div className="empty-state-panel__copy">
        <h3>{title}</h3>
        <p className="empty-state">{description}</p>
      </div>

      {tips.length > 0 ? (
        <ul className="empty-state-panel__tips">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      ) : null}

      {actions.length > 0 ? (
        <div className="button-row">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={action.variant === 'secondary' ? 'secondary-button' : undefined}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
