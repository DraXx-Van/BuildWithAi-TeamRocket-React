import { useState } from 'react';
import useIncidentStore from '../../store/useIncidentStore';

export default function DispatchSection({ incident }) {
  const { dispatchResult, dispatchIncidentId, confirmDispatch, resolveIncident, isProcessing } = useIncidentStore();
  const [confirmed, setConfirmed] = useState(false);
  const [resolving, setResolving] = useState(false);

  const isThisIncident = dispatchIncidentId === incident.id;

  const handleConfirm = async () => {
    await confirmDispatch();
    setConfirmed(true);
  };

  const handleResolve = async () => {
    setResolving(true);
    await resolveIncident(incident.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Tactical Dispatch */}
      <div className="card flex-col gap-14">
        <div className="step-label">
          <span className="step-num">🚀</span>
          TACTICAL DISPATCH
        </div>

        {isThisIncident && dispatchResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '12px 16px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-success)', letterSpacing: 2, marginBottom: 6 }}>NEAREST QUALIFIED RESPONDER</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-hi)' }}>{dispatchResult}</div>
            </div>

            {!confirmed ? (
              <button
                onClick={handleConfirm}
                style={{ width: '100%', padding: '11px', background: 'var(--color-success)', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: 0.5, boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}
              >
                ✓ CONFIRM DISPATCH
              </button>
            ) : (
              <div style={{ padding: '10px', background: 'rgba(16,185,129,0.1)', borderRadius: 8, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-success)', fontWeight: 600, letterSpacing: 1 }}>
                ✓ DISPATCH CONFIRMED
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '14px', background: 'rgba(39,39,42,0.6)', border: '1px dashed var(--color-border)', borderRadius: 8, fontSize: 12, color: 'var(--color-text-mid)', textAlign: 'center' }}>
            {isProcessing ? 'Finding nearest responder...' : 'No active dispatch for this incident'}
          </div>
        )}
      </div>

      {/* Resolution */}
      <div className="card flex-col gap-14">
        <div className="step-label">
          <span className="step-num">⚡</span>
          INCIDENT CONTROL
        </div>
        <button
          onClick={handleResolve}
          disabled={resolving}
          style={{ width: '100%', padding: '11px', background: 'transparent', color: 'var(--color-error)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: resolving ? 'not-allowed' : 'pointer', letterSpacing: 0.5, transition: 'all 0.15s', opacity: resolving ? 0.5 : 1 }}
          onMouseEnter={e => !resolving && (e.target.style.background = 'rgba(239,68,68,0.08)')}
          onMouseLeave={e => (e.target.style.background = 'transparent')}
        >
          {resolving ? 'RESOLVING...' : '✕ RESOLVE INCIDENT'}
        </button>
        {incident.status === 'dispatched' && incident.assignedTo && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-mid)', textAlign: 'center', letterSpacing: 1 }}>
            ASSIGNED: {incident.assignedTo}
          </div>
        )}
      </div>
    </div>
  );
}
