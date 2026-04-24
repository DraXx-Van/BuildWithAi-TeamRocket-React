import { fullTimestamp, severityColor } from '../../models/incident';
import CaseSummary from './CaseSummary';
import SignalIntel from './SignalIntel';
import SopList from './SopList';
import DispatchSection from './DispatchSection';

export default function IncidentProcessView({ incident }) {
  const color = severityColor(incident.severity);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header bar */}
      <div style={{
        padding: '18px 32px',
        background: 'var(--color-surface-1)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-primary)', letterSpacing: 2.5, marginBottom: 6 }}>
            INCIDENT COMMAND
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-text-hi)', letterSpacing: -0.3 }}>
            {incident.type.toUpperCase()} — {incident.location.toUpperCase()}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-text-mid)', letterSpacing: 1.5, marginBottom: 4 }}>TIMESTAMP</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-hi)' }}>{fullTimestamp(incident.timestamp)}</div>
        </div>
        {/* Severity pill */}
        <div style={{ padding: '6px 14px', background: `${color}18`, border: `1px solid ${color}50`, borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color, flexShrink: 0 }}>
          SEV {incident.severity}
        </div>
      </div>

      {/* 70 / 30 body */}
      <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden' }}>
        {/* LEFT — 70% Intelligence Plane */}
        <div style={{ flex: '0 0 70%', maxWidth: '70%', overflowY: 'auto', padding: '24px 20px 24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionTitle icon="🔍" label="INTELLIGENCE PLANE" />
          <CaseSummary incident={incident} />
          <SignalIntel incident={incident} />
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: 'var(--color-border)', flexShrink: 0 }} />

        {/* RIGHT — 30% Execution Plane */}
        <div style={{ flex: '0 0 30%', maxWidth: '30%', overflowY: 'auto', padding: '24px 20px 24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionTitle icon="⚙️" label="EXECUTION PLANE" />
          <SopList incident={incident} />
          <DispatchSection incident={incident} />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600, color: 'var(--color-text-mid)', letterSpacing: 2, textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}
