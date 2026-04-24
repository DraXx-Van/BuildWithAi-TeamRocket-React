import { fullTimestamp } from '../../models/incident';

export default function SignalIntel({ incident }) {
  const logs = incident.evidenceLogs ?? [];
  return (
    <div className="card flex-col gap-16">
      <div className="step-label">
        <span className="step-num">📡</span>
        SIGNAL INTELLIGENCE
      </div>
      {logs.length === 0 ? (
        <div style={{ color: 'var(--color-text-mid)', fontSize: 12 }}>No signals recorded.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {logs.map((log, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Timeline dot */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
                {i < logs.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 16, background: 'var(--color-border)', marginTop: 4 }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-mid)', letterSpacing: 1, marginBottom: 3 }}>
                  SIGNAL #{i + 1}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-hi)', lineHeight: 1.6, background: 'rgba(39,39,42,0.6)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px' }}>
                  {log}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
