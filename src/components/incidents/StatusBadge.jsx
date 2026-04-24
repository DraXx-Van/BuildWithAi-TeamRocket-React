import { severityColor } from '../../models/incident';

const STATUS_COLORS = {
  active:     'var(--color-error)',
  dispatched: 'var(--color-warning)',
  resolved:   'var(--color-success)',
  cancelled:  'var(--color-text-mid)',
};

export default function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] ?? 'var(--color-text-mid)';
  return (
    <span className="status-badge" style={{ color, background: `${color}18`, border: `1px solid ${color}50` }}>
      {status}
    </span>
  );
}
