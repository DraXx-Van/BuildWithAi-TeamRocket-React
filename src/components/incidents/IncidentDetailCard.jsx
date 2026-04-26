import useIncidentStore from '../../store/useIncidentStore';
import { severityColor, fullTimestamp } from '../../models/incident';
import StatusBadge from './StatusBadge';

export default function IncidentDetailCard({ incident }) {
  const setFocusedIncidentId = useIncidentStore(s => s.setFocusedIncidentId);
  const color = severityColor(incident.severity);

  return (
    <div
      onClick={() => setFocusedIncidentId(incident.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 18px', marginBottom: 12,
        background: 'rgba(39,39,42,0.5)',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${color}40`,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(63,63,70,0.5)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(39,39,42,0.5)'}
    >
      {/* Severity badge */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: `${color}18`, border: `1px solid ${color}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color,
      }}>
        {incident.severity}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-hi)', marginBottom: 3 }}>
          {incident.type.toUpperCase()} — {incident.location}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {incident.description}
        </div>
      </div>

      <StatusBadge status={incident.status} />

      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-mid)" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  );
}
