import { fullTimestamp, severityColor } from '../../models/incident';
import StatusBadge from '../incidents/StatusBadge';

export default function CaseSummary({ incident }) {
  const color = severityColor(incident.severity);
  return (
    <div className="card flex-col gap-16">
      {/* Section label */}
      <div className="step-label">
        <span className="step-num">◉</span>
        CASE BRIEFING
      </div>

      {/* Description */}
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--color-text-hi)', lineHeight: 1.7 }}>
        {incident.description}
      </p>

      {/* Meta grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
        <MetaRow label="LOCATION"  value={incident.location} />
        <MetaRow label="SEVERITY"  value={`${incident.severity} / 10`} valueColor={color} />
        <MetaRow label="TIMESTAMP" value={fullTimestamp(incident.timestamp)} mono />
        <MetaRow label="STATUS"    value={<StatusBadge status={incident.status} />} />
        <MetaRow label="SIGNAL COUNT" value={`${incident.signalCount} report${incident.signalCount > 1 ? 's' : ''} merged`} />
        {incident.assignedTo && <MetaRow label="ASSIGNED TO" value={incident.assignedTo} valueColor="var(--color-success)" />}
      </div>

      {/* Required skills */}
      {incident.requiredSkills?.length > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: 8 }}>REQUIRED SKILLS</div>
          <div className="flex flex-wrap gap-8" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {incident.requiredSkills.map((s, i) => (
              <span key={i} className="skill-chip">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value, valueColor, mono }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-mid)', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
      {typeof value === 'string'
        ? <div style={{ fontSize: 12, color: valueColor ?? 'var(--color-text-hi)', fontFamily: mono ? 'var(--font-mono)' : 'var(--font-body)', fontWeight: 500 }}>{value}</div>
        : value
      }
    </div>
  );
}
