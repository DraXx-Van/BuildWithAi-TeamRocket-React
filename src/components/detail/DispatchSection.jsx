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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tactical Dispatch */}
      <div className="card flex-col gap-14" style={{ 
        background: 'rgba(20,20,25,0.4)', 
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.05)' 
      }}>
        <div className="step-label">
          <span className="step-num" style={{ background: '#06b6d4' }}>🚀</span>
          TACTICAL DISPATCH
        </div>

        {isThisIncident && dispatchResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ 
              padding: '16px', 
              background: 'rgba(6,182,212,0.05)', 
              border: '1px solid rgba(6,182,212,0.2)', 
              borderRadius: 12,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: '100%', background: '#06b6d4' }} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#06b6d4', letterSpacing: 2, marginBottom: 8, fontWeight: 800 }}>NEAREST QUALIFIED UNIT</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'white' }}>{dispatchResult}</div>
            </div>

            {!confirmed ? (
              <button
                onClick={handleConfirm}
                style={{ 
                  width: '100%', padding: '12px', background: '#10b981', color: 'white', 
                  border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 11, 
                  cursor: 'pointer', letterSpacing: 1.5, boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.target.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.target.style.transform = 'none'}
              >
                DEPLOY RESPONDER
              </button>
            ) : (
              <div style={{ 
                padding: '12px', background: 'rgba(16,185,129,0.1)', 
                border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: 10, textAlign: 'center', fontFamily: 'var(--font-mono)', 
                fontSize: 10, color: '#10b981', fontWeight: 800, letterSpacing: 1.5 
              }}>
                ✓ UNIT EN ROUTE
              </div>
            )}
          </div>
        ) : (
          <div style={{ 
            padding: '24px 16px', background: 'rgba(255,255,255,0.01)', 
            border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 12, 
            fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center',
            fontFamily: 'var(--font-mono)', letterSpacing: 1
          }}>
            {isProcessing ? 'CALCULATING VECTORS...' : 'NO ACTIVE DISPATCH'}
          </div>
        )}
      </div>

      {/* Resolution */}
      <div className="card flex-col gap-14" style={{ 
        background: 'rgba(20,20,25,0.4)', 
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.05)' 
      }}>
        <div className="step-label">
          <span className="step-num" style={{ background: '#ef4444' }}>⚡</span>
          INCIDENT CONTROL
        </div>
        <button
          onClick={handleResolve}
          disabled={resolving}
          style={{ 
            width: '100%', padding: '12px', background: 'transparent', 
            color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', 
            borderRadius: 10, fontWeight: 800, fontSize: 11, 
            cursor: resolving ? 'not-allowed' : 'pointer', letterSpacing: 1.5, 
            transition: 'all 0.2s', opacity: resolving ? 0.5 : 1,
            boxShadow: 'inset 0 0 10px rgba(239,68,68,0.02)'
          }}
          onMouseEnter={e => !resolving && (e.target.style.background = 'rgba(239,68,68,0.05)', e.target.style.borderColor = '#ef4444')}
          onMouseLeave={e => (e.target.style.background = 'transparent', e.target.style.borderColor = 'rgba(239,68,68,0.3)')}
        >
          {resolving ? 'TERMINATING CASE...' : 'RESOLVE INCIDENT'}
        </button>
        {incident.status === 'dispatched' && incident.assignedTo && (
          <div style={{ 
            fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.25)', 
            textAlign: 'center', letterSpacing: 1, fontWeight: 600,
            marginTop: 4
          }}>
            ACTIVE UNIT: {incident.assignedTo.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
