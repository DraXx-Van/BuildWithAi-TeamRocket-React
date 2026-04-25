import { useState } from 'react';
import useIncidentStore from '../../store/useIncidentStore';
import { severityColor } from '../../models/incident';

export default function FloorPlanCanvas({ fullBleed = false }) {
  const { 
    floorData,
    currentFloor,
    floors,
    setCurrentFloor,
    liveIncidents,
    setDispatchResult,
    confirmDispatch
  } = useIncidentStore();

  const [statusPopupId, setStatusPopupId] = useState(null);

  const currentFloorData = floorData[currentFloor];
  const rooms = currentFloorData?.rooms || [];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', borderRadius: fullBleed ? 0 : 'var(--radius-lg)', overflow: 'hidden' }}>
      
      {/* ── Floor Selection Sidebar ── */}
      {floors.length > 0 && (
        <div style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(20,20,22,0.8)', padding: 12, borderRadius: 20, border: '1px solid #27272a', backdropFilter: 'blur(20px)', zIndex: 1100, boxShadow: '0 12px 48px rgba(0,0,0,0.5)' }}>
          {floors.map(f => (
            <button key={f} onClick={() => setCurrentFloor(f)} style={{ width: 42, height: 42, borderRadius: 10, border: currentFloor === f ? '2px solid var(--color-primary)' : '1px solid #3f3f46', background: currentFloor === f ? 'rgba(139, 92, 246, 0.15)' : 'transparent', color: currentFloor === f ? 'white' : '#71717a', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{f.toUpperCase()}</button>
          ))}
        </div>
      )}

      {/* ── Floor Viewer ── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 40 }}>
        <div style={{ 
          position: 'relative', 
          width: '100%', 
          maxWidth: 1000, 
          aspectRatio: '16/9', 
          background: '#111116', 
          borderRadius: 16, 
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          {rooms.map(room => {
            // Match logic with incident
            const activeIncident = liveIncidents.find(i => {
              const loc = i.location.toLowerCase();
              const label = (room.name || '').toLowerCase();
              
              const digitMap = { '1':'one', '2':'two', '3':'three', '4':'four', '5':'five', '6':'six', '7':'seven', '8':'eight', '9':'nine' };
              const normalize = (s) => {
                let out = s.replace(/room|number|zone|floor/g, '').trim();
                Object.entries(digitMap).forEach(([d, w]) => {
                  out = out.replace(new RegExp(`\\b${w}\\b`, 'g'), d);
                });
                return out;
              };

              const normLoc = normalize(loc);
              const normLabel = normalize(label);
              
              const incidentFloor = i.location.match(/floor\s*(\d+)/i)?.[1] || i.location.match(/floor\s*(one|two|three|four)/i)?.[1] || '1';
              const zoneFloor = (currentFloor || '1').toString().toLowerCase();
              const floorMatch = incidentFloor.includes(zoneFloor) || zoneFloor.includes(normalize(incidentFloor));

              if (!floorMatch) return false;
              return normLoc.includes(normLabel) || normLabel.includes(normLoc) || i.id.includes(room.id);
            });

            const isAlert = Boolean(activeIncident);
            const alertColor = isAlert ? severityColor(activeIncident.severity) : null;
            const typeColor = getRoomTypeColor(room.type);
            const borderColor = isAlert ? alertColor : typeColor;
            
            // If AI provided points, use clip-path to draw exact shape
            let clipPathObj = {};
            if (room.points && room.points.length >= 3) {
              const pointsStr = room.points.map(p => {
                const px = (p.xPercent - room.xPercent) / room.widthPercent * 100;
                const py = (p.yPercent - room.yPercent) / room.heightPercent * 100;
                return `${px}% ${py}%`;
              }).join(', ');
              clipPathObj = { clipPath: `polygon(${pointsStr})` };
            }

            return (
              <div 
                key={room.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isAlert) setStatusPopupId(room.id);
                }}
                style={{
                  position: 'absolute',
                  left: `${room.xPercent * 100}%`,
                  top: `${room.yPercent * 100}%`,
                  width: `${(room.widthPercent || 0.08) * 100}%`,
                  height: `${(room.heightPercent || 0.12) * 100}%`,
                  border: isAlert ? `2px solid ${alertColor}` : `1px solid ${borderColor}`,
                  backgroundColor: isAlert ? 'rgba(10, 10, 12, 0.4)' : `${typeColor}15`,
                  borderRadius: 4,
                  cursor: isAlert ? 'pointer' : 'default',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isAlert ? `0 0 20px ${alertColor}44, inset 0 0 15px ${alertColor}22` : 'none',
                  backdropFilter: isAlert ? 'blur(4px)' : 'none',
                  animation: isAlert && activeIncident?.severity >= 8 ? 'criticalPulse 1.5s infinite' : isAlert ? 'pulseAlert 3s infinite' : 'none',
                  zIndex: isAlert ? 50 : 10,
                  ...clipPathObj
                }}
              >
                <div style={{ textAlign: 'center', padding: '4px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'white', textShadow: isAlert ? `0 0 10px ${alertColor}` : 'none' }}>
                    {room.name}
                  </div>
                  <div style={{ fontSize: 7, fontWeight: 800, color: typeColor, textTransform: 'uppercase', marginTop: 2 }}>
                    {room.type || 'ROOM'}
                  </div>
                </div>
                
                {isAlert && activeIncident && (
                  <div style={{ position: 'absolute', top: -12, right: -12, background: alertColor, color: 'white', padding: '4px 8px', borderRadius: 8, fontSize: 9, fontWeight: 900, boxShadow: `0 4px 15px ${alertColor}66` }}>
                    {(activeIncident?.hazard || 'INCIDENT').toUpperCase()}
                  </div>
                )}

                {/* ── Tactical HUD ── */}
                {statusPopupId === room.id && activeIncident && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)',
                      width: 260, background: 'rgba(15,15,18,0.95)', border: `1px solid ${alertColor}`,
                      borderRadius: 16, padding: 16, boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 30px ${alertColor}22`,
                      zIndex: 100, display: 'flex', flexDirection: 'column', gap: 12, backdropFilter: 'blur(20px)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: alertColor, animation: 'pulse 1s infinite' }} />
                        <span style={{ fontSize: 8, fontWeight: 900, color: alertColor, letterSpacing: 1.5 }}>LIVE INTEL</span>
                      </div>
                      <button onClick={() => setStatusPopupId(null)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                    </div>

                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'white' }}>{(activeIncident?.hazard || 'INCIDENT').toUpperCase()}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{room.name.toUpperCase()}</div>
                    </div>

                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 8 }}>
                      "{activeIncident?.description || 'No description available.'}"
                    </div>

                    <button 
                      onClick={() => { 
                        if (activeIncident && activeIncident.dispatchSuggestion) {
                          setDispatchResult(activeIncident.dispatchSuggestion, activeIncident.id);
                          confirmDispatch();
                        }
                        setStatusPopupId(null); 
                      }}
                      style={{ width: '100%', padding: '8px', background: alertColor, color: 'white', borderRadius: 8, border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: 10 }}
                    >
                      DEPLOY ASSETS
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes pulseAlert {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes criticalPulse {
          0% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.2); }
          50% { box-shadow: 0 0 40px rgba(239, 68, 68, 0.6); background: rgba(239, 68, 68, 0.25); }
          100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.2); }
        }
      `}</style>
    </div>
  );
}

// ── Type color mapping ───────────────────────────────────────────────────────
function getRoomTypeColor(type) {
  const colors = {
    room: '#8b5cf6',
    suite: '#a78bfa',
    lobby: '#3b82f6',
    corridor: '#6b7280',
    stair: '#3b82f6',
    exit: '#10b981',
    elevator: '#f59e0b',
    restaurant: '#ec4899',
    kitchen: '#f97316',
    utility: '#6b7280',
    pool: '#06b6d4',
    gym: '#14b8a6',
    bar: '#e11d48',
    conference: '#8b5cf6',
    garden: '#22c55e',
    shop: '#a855f7',
    lounge: '#6366f1',
  };
  return colors[(type || '').toLowerCase()] || '#8b5cf6';
}

