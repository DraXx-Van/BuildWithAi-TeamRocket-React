import { useState, useEffect } from 'react';
import useIncidentStore from '../../store/useIncidentStore';
import { Rocket, Zap, UserCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchStaff } from '../../services/firebaseService';
import { confirmDispatch as fbConfirmDispatch } from '../../services/firebaseService';

export default function DispatchSection({ incident }) {
  const { dispatchResult, dispatchIncidentId, confirmDispatch, resolveIncident, isProcessing, setDispatchResult } = useIncidentStore();
  const [confirmed, setConfirmed] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [manualConfirmed, setManualConfirmed] = useState(false);

  const isThisIncident = dispatchIncidentId === incident.id;

  useEffect(() => {
    fetchStaff().then(staff => setStaffList(staff));
  }, []);

  // Reset confirmed state if dispatch changes
  useEffect(() => {
    setConfirmed(false);
    setManualConfirmed(false);
    setSelectedStaff(null);
  }, [incident.id]);

  const handleConfirm = async () => {
    await confirmDispatch();
    setConfirmed(true);
  };

  const handleManualDeploy = async () => {
    if (!selectedStaff) return;
    const dispatchStr = `${selectedStaff.name} (${selectedStaff.role}) — Manual Assignment`;
    await fbConfirmDispatch(incident.id, selectedStaff.name);
    // Update store so the card refreshes
    useIncidentStore.setState({ 
      dispatchResult: dispatchStr, 
      dispatchIncidentId: incident.id 
    });
    setManualConfirmed(true);
    setShowManual(false);
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
          <span className="step-num" style={{ background: 'rgba(6, 182, 212, 0.1)' }}><Rocket size={14} color="#06b6d4" /></span>
          TACTICAL DISPATCH
        </div>

        {/* AI Suggested Unit */}
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
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#06b6d4', letterSpacing: 2, marginBottom: 8, fontWeight: 800 }}>AI RECOMMENDED UNIT</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: 'white' }}>{dispatchResult}</div>
            </div>

            {!confirmed && !manualConfirmed ? (
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
            padding: '20px 16px', background: 'rgba(255,255,255,0.01)', 
            border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 12, 
            fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center',
            fontFamily: 'var(--font-mono)', letterSpacing: 1
          }}>
            {isProcessing ? 'CALCULATING VECTORS...' : 'NO ACTIVE DISPATCH'}
          </div>
        )}

        {/* Manual Override Section */}
        {!confirmed && !manualConfirmed && (
          <>
            <button
              onClick={() => setShowManual(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '10px', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
                color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)',
                fontSize: 10, fontWeight: 700, letterSpacing: 1.5, cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
            >
              <UserCheck size={12} />
              MANUAL OVERRIDE
              {showManual ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showManual && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, marginBottom: 4 }}>
                  SELECT UNIT MANUALLY
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                  {staffList.map(staff => (
                    <button
                      key={staff.id}
                      onClick={() => setSelectedStaff(staff)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: selectedStaff?.id === staff.id ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${selectedStaff?.id === staff.id ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.05)'}`,
                        borderRadius: 8, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{staff.name}</div>
                        <div style={{ fontSize: 10, color: '#a1a1aa', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{staff.role}</div>
                        <div style={{ fontSize: 9, color: '#6b7280', marginTop: 4 }}>
                          {staff.skills?.slice(0, 2).join(' · ')}
                        </div>
                      </div>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%',
                        border: `2px solid ${selectedStaff?.id === staff.id ? '#8b5cf6' : 'rgba(255,255,255,0.1)'}`,
                        background: selectedStaff?.id === staff.id ? '#8b5cf6' : 'transparent',
                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {selectedStaff?.id === staff.id && (
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {selectedStaff && (
                  <button
                    onClick={handleManualDeploy}
                    style={{
                      width: '100%', padding: '12px', background: '#8b5cf6', color: 'white',
                      border: 'none', borderRadius: 10, fontWeight: 800, fontSize: 11,
                      cursor: 'pointer', letterSpacing: 1.5, marginTop: 4,
                      boxShadow: '0 4px 20px rgba(139,92,246,0.3)'
                    }}
                  >
                    DEPLOY {selectedStaff.name.split(' ')[0].toUpperCase()}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Resolution */}
      <div className="card flex-col gap-14" style={{ 
        background: 'rgba(20,20,25,0.4)', 
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.05)' 
      }}>
        <div className="step-label">
          <span className="step-num" style={{ background: 'rgba(239, 68, 68, 0.1)' }}><Zap size={14} color="#ef4444" /></span>
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
