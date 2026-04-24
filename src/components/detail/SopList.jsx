import useIncidentStore from '../../store/useIncidentStore';

export default function SopList({ incident }) {
  const { sopSteps, isProcessing } = useIncidentStore();

  return (
    <div className="card flex-col gap-16">
      <div className="step-label">
        <span className="step-num">📋</span>
        AI RESPONSE PROTOCOL
      </div>

      {isProcessing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />
          ))}
        </div>
      ) : sopSteps.length === 0 ? (
        <div style={{ padding: '16px', background: 'rgba(139,92,246,0.05)', border: '1px dashed rgba(139,92,246,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-mid)', textAlign: 'center' }}>
          SOP will auto-generate when an incident is processed
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sopSteps.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.12)', borderRadius: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-hi)', lineHeight: 1.6, flex: 1 }}>{step}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
