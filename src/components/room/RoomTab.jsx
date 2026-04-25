import { useState, useEffect, useMemo } from 'react';
import useAuthStore from '../../store/useAuthStore';
import useIncidentStore from '../../store/useIncidentStore';
import { ISSUE_CATEGORIES } from '../../services/staffData';
import FloorPlanSVG from '../dashboard/FloorPlanSVG';
import { findRouteForRoom } from '../../services/navigationService';

export default function RoomTab() {
  const { profile, logout } = useAuthStore();
  const { liveIncidents, processIncidentData, isProcessing } = useIncidentStore();
  const [isPanicked, setIsPanicked] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [reportStep, setReportStep] = useState('category');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [reportDetail, setReportDetail] = useState('');
  const [reportLocation, setReportLocation] = useState('My Room');
  const [evacFloorIdx, setEvacFloorIdx] = useState(0);

  const { isEvacuationActive } = useIncidentStore();

  const hasCrisis = liveIncidents.some(i =>
    (i.status === 'active' || i.status === 'dispatched') &&
    ISSUE_CATEGORIES[i.type]?.isCrisis
  );
  const roomNumber = profile?.roomNumber || profile?.displayName || '—';
  const roomFloor = Math.floor(parseInt(roomNumber) / 100) || 1;

  const myIncidents = liveIncidents.filter(i => 
    i.location?.includes(roomNumber) && 
    (i.status === 'active' || i.status === 'dispatched' || i.status === 'en_route')
  );
  const activeIncident = myIncidents.length > 0 ? myIncidents[0] : null;

  // ── Compute evacuation route from this room ─────────────────────────────────
  const evacRoute = useMemo(() => {
    if (!isEvacuationActive || roomNumber === '—') return null;
    try {
      return findRouteForRoom(roomNumber, { isCalamity: true });
    } catch (e) {
      console.warn('[EVAC] Route computation failed:', e);
      return null;
    }
  }, [isEvacuationActive, roomNumber]);

  const evacFloors = evacRoute?.floorsTraversed || [];

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Reset floor step when evacuation activates
  useEffect(() => {
    if (isEvacuationActive) setEvacFloorIdx(0);
  }, [isEvacuationActive]);

  const timeStr = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateStr = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const handlePanic = () => {
    setIsPanicked(true);
    console.log('[ROOM] PANIC signal from room:', roomNumber);
  };

  const handleCancelPanic = () => {
    setIsPanicked(false);
    console.log('[ROOM] PANIC cancelled from room:', roomNumber);
  };

  const handleSelectCategory = (key) => {
    setSelectedCategory(key);
    setReportStep('detail');
  };

  const handleSubmitReport = async () => {
    if (!selectedCategory) return;
    const cat = ISSUE_CATEGORIES[selectedCategory];
    const detail = reportDetail.trim() || cat.label;
    const locString = reportLocation === 'My Room' ? `Room ${roomNumber}` : reportLocation;
    const transcript = `${cat.label} reported in ${locString}, Floor ${roomFloor}. ${detail}`;

    await processIncidentData(transcript);
    setReportStep('sent');
    setTimeout(() => {
      setShowReportMenu(false);
      setReportStep('category');
      setSelectedCategory(null);
      setReportDetail('');
    }, 3000);
  };

  const resetReport = () => {
    setShowReportMenu(false);
    setReportStep('category');
    setSelectedCategory(null);
    setReportDetail('');
  };

  // ── Helper: floor label ──────────────────────────────────────────────────────
  const floorLabel = (f) => f === 0 ? 'Ground Floor' : `Floor ${f}`;
  const floorGuidance = (f, idx, total) => {
    if (idx === 0) return `Exit Room ${roomNumber} and follow the corridor to the nearest stairwell.`;
    if (idx === total - 1) return `You are on the Ground Floor. Proceed to the nearest exit immediately.`;
    return `Continue descending via the stairwell. Do NOT use elevators.`;
  };

  // ── CRISIS ACTIVE MODE ──────────────────────────────────────────────────────
  if (isEvacuationActive) {
    const calamityIncidents = liveIncidents.filter(i => i.severity >= 8 && i.status !== 'resolved');
    const primaryReason = calamityIncidents.length > 0 
      ? `${calamityIncidents[0].type.toUpperCase()} detected at ${calamityIncidents[0].location}`
      : 'Critical Emergency';
    const currentEvacFloor = evacFloors[evacFloorIdx] ?? roomFloor;

    return (
      <div className="rt-screen rt-crisis" style={{ padding: 0 }}>
        <div className="rt-evac-overlay">
          {/* Header */}
          <div className="rt-evac-header">
            <div className="rt-evac-pulse" />
            <div className="rt-evac-badge">MANDATORY EVACUATION</div>
          </div>
          
          {/* Reason banner */}
          <div style={{ background: '#7f1d1d', padding: '10px 20px', textAlign: 'center', fontSize: 12, fontWeight: 700, letterSpacing: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            ⚠ {primaryReason}
          </div>

          {/* Floor stepper */}
          {evacFloors.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => setEvacFloorIdx(Math.max(0, evacFloorIdx - 1))}
                disabled={evacFloorIdx === 0}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(57,255,20,0.3)', background: evacFloorIdx === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(57,255,20,0.1)', color: evacFloorIdx === 0 ? '#555' : '#39ff14', fontWeight: 700, fontSize: 12, cursor: evacFloorIdx === 0 ? 'not-allowed' : 'pointer' }}
              >
                ◀ PREV
              </button>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {evacFloors.map((f, i) => (
                  <button key={f}
                    onClick={() => setEvacFloorIdx(i)}
                    style={{
                      width: 32, height: 32, borderRadius: 8, border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer',
                      background: i === evacFloorIdx ? '#39ff14' : i < evacFloorIdx ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)',
                      color: i === evacFloorIdx ? '#000' : i < evacFloorIdx ? '#6ee7b7' : '#666',
                      transition: 'all 0.2s',
                    }}
                  >
                    {f === 0 ? 'G' : `${f}`}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setEvacFloorIdx(Math.min(evacFloors.length - 1, evacFloorIdx + 1))}
                disabled={evacFloorIdx === evacFloors.length - 1}
                style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(57,255,20,0.3)', background: evacFloorIdx === evacFloors.length - 1 ? 'rgba(255,255,255,0.03)' : 'rgba(57,255,20,0.1)', color: evacFloorIdx === evacFloors.length - 1 ? '#555' : '#39ff14', fontWeight: 700, fontSize: 12, cursor: evacFloorIdx === evacFloors.length - 1 ? 'not-allowed' : 'pointer' }}
              >
                NEXT ▶
              </button>
            </div>
          )}

          {/* Current floor instruction */}
          <div style={{ padding: '10px 20px', background: 'rgba(57,255,20,0.05)', borderBottom: '1px solid rgba(57,255,20,0.1)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#39ff14', fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>
              STEP {evacFloorIdx + 1} OF {Math.max(evacFloors.length, 1)} — {floorLabel(currentEvacFloor).toUpperCase()}
            </div>
            <div style={{ fontSize: 13, color: '#e4e4e7', fontWeight: 500 }}>
              {floorGuidance(currentEvacFloor, evacFloorIdx, evacFloors.length)}
            </div>
          </div>

          {/* Map for current floor */}
          <div className="rt-evac-map-container" style={{ flex: 1, minHeight: 0 }}>
            <FloorPlanSVG
              forceEvacZone={`z_${roomNumber}`}
              hideControls={true}
              isEvacMode={true}
              forceFloor={currentEvacFloor}
              key={`evac-floor-${currentEvacFloor}`}
            />
          </div>

          {/* Footer with ETA */}
          <div className="rt-evac-footer" style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.7)', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            {evacRoute && (
              <div style={{ fontSize: 13, color: '#39ff14', fontWeight: 700, marginBottom: 6 }}>
                🏃 EXIT: {evacRoute.exitLabel} · ~{evacRoute.estimatedSeconds}s
              </div>
            )}
            <div style={{ fontSize: 11, color: '#a1a1aa' }}>
              Leave all belongings. Do NOT use elevators. Follow green path.
            </div>
            <button className="rt-footer-logout" style={{ marginTop: 10, fontSize: 11 }} onClick={logout}>Sign Out</button>
          </div>
        </div>
      </div>
    );
  }

  if (hasCrisis || isPanicked) {
    return (
      <div className="rt-screen rt-crisis">
        <div className="rt-crisis-header">
          <div className="rt-crisis-pulse" />
          <div className="rt-crisis-badge">⚠ EMERGENCY ACTIVE</div>
          <div className="rt-crisis-time">{timeStr}</div>
        </div>

        <div className="rt-crisis-instructions">
          <div className="rt-crisis-inst-icon">🔒</div>
          <h2 className="rt-crisis-inst-title">STAY IN YOUR ROOM</h2>
          <p className="rt-crisis-inst-text">
            Lock your door. Move away from windows.
            Help is being coordinated. You will receive updates here.
          </p>
        </div>

        {liveIncidents.filter(i => i.status !== 'resolved').map(incident => (
          <div key={incident.id} className="rt-crisis-card">
            <div className="rt-crisis-card-header">
              <span className="rt-crisis-card-type">{incident.type?.toUpperCase() || 'INCIDENT'}</span>
              <span className="rt-crisis-card-sev" style={{
                color: incident.severity >= 8 ? 'var(--color-error)' :
                       incident.severity >= 5 ? 'var(--color-warning)' : 'var(--color-text-mid)'
              }}>SEV {incident.severity}/10</span>
            </div>
            <p className="rt-crisis-card-desc">{incident.description}</p>
            {incident.location && (
              <p className="rt-crisis-card-loc">📍 {incident.location}</p>
            )}
            {incident.assignedTo && (
              <p className="rt-crisis-card-assigned">✓ Responder: {incident.assignedTo}</p>
            )}
          </div>
        ))}

        {isPanicked ? (
          <div className="rt-panic-active">
            <div className="rt-panic-active-icon">🚨</div>
            <div className="rt-panic-active-text">HELP SIGNAL SENT</div>
            <div className="rt-panic-active-sub">
              Your location has been marked. Staff has been notified.
              <br />Stay calm — help is on the way.
            </div>
            <button className="rt-btn-cancel" onClick={handleCancelPanic}>
              ✓ I'M SAFE — CANCEL ALERT
            </button>
          </div>
        ) : (
          <div className="rt-crisis-actions">
            <button className="rt-btn-panic" onClick={handlePanic}>
              <span className="rt-btn-panic-icon">🚨</span>
              <span className="rt-btn-panic-label">I NEED HELP</span>
              <span className="rt-btn-panic-sub">Alert staff to your location</span>
            </button>
            <button className="rt-btn-safe" onClick={() => console.log('[ROOM] Safe signal')}>
              <span className="rt-btn-safe-icon">✅</span>
              <span className="rt-btn-safe-label">I'M SAFE</span>
              <span className="rt-btn-safe-sub">Confirm you are okay</span>
            </button>
          </div>
        )}

        <div className="rt-footer">
          <span>Room {roomNumber}</span>
          <button className="rt-footer-logout" onClick={logout}>Sign Out</button>
        </div>
      </div>
    );
  }

  // ── REPORT ISSUE OVERLAY ────────────────────────────────────────────────────
  const reportOverlay = showReportMenu && (
    <div className="rt-report-overlay" onClick={(e) => e.target === e.currentTarget && resetReport()}>
      <div className="rt-report-sheet">
        {reportStep === 'category' && (
          <>
            <h2 className="rt-report-title">What do you need?</h2>
            <p className="rt-report-sub">Room {roomNumber} · Floor {roomFloor}</p>

            <div className="rt-report-section-label">🔧 Maintenance & Utility</div>
            <div className="rt-report-grid">
              {Object.entries(ISSUE_CATEGORIES)
                .filter(([, v]) => !v.isCrisis)
                .map(([key, cat]) => (
                  <button key={key} className="rt-report-option" onClick={() => handleSelectCategory(key)}>
                    <span className="rt-report-option-icon">{cat.icon}</span>
                    <span className="rt-report-option-label">{cat.label}</span>
                  </button>
                ))
              }
            </div>

            <div className="rt-report-section-label">🚨 Emergency</div>
            <div className="rt-report-grid">
              {Object.entries(ISSUE_CATEGORIES)
                .filter(([, v]) => v.isCrisis)
                .map(([key, cat]) => (
                  <button key={key} className="rt-report-option emergency" onClick={() => handleSelectCategory(key)}>
                    <span className="rt-report-option-icon">{cat.icon}</span>
                    <span className="rt-report-option-label">{cat.label}</span>
                  </button>
                ))
              }
            </div>

            <button className="rt-report-close" onClick={resetReport}>Cancel</button>
          </>
        )}

        {reportStep === 'detail' && selectedCategory && (
          <>
            <h2 className="rt-report-title">
              {ISSUE_CATEGORIES[selectedCategory].icon} {ISSUE_CATEGORIES[selectedCategory].label}
            </h2>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--color-text-mid)', marginBottom: 8, fontWeight: 600 }}>Location</label>
              <select 
                value={reportLocation} 
                onChange={(e) => setReportLocation(e.target.value)}
                style={{ width: '100%', padding: 12, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 14 }}
              >
                <option value="My Room">My Room ({roomNumber})</option>
                <option value="Hallway">Hallway outside room</option>
                <option value="Gym">Gym</option>
                <option value="Lobby">Lobby</option>
                <option value="Pool">Pool Area</option>
                <option value="Restaurant">Restaurant</option>
              </select>
            </div>

            <textarea
              className="rt-report-textarea"
              placeholder="Add details (optional)... e.g. 'Bathroom tap is leaking heavily'"
              value={reportDetail}
              onChange={e => setReportDetail(e.target.value)}
              rows={4}
            />

            <button
              className="rt-report-submit"
              onClick={handleSubmitReport}
              disabled={isProcessing}
            >
              {isProcessing ? '⚙️ Sending...' : `Send ${ISSUE_CATEGORIES[selectedCategory].isCrisis ? 'Emergency' : 'Request'}`}
            </button>

            <button className="rt-report-back" onClick={() => setReportStep('category')}>
              ← Back
            </button>
          </>
        )}

        {reportStep === 'sent' && (
          <div className="rt-report-sent">
            <div className="rt-report-sent-icon">✅</div>
            <h2 className="rt-report-sent-title">Report Sent</h2>
            <p className="rt-report-sent-sub">
              Management has been notified. A staff member will be assigned shortly.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // ── NORMAL MODE — Hotel iPad Experience ─────────────────────────────────────
  return (
    <div className="rt-screen rt-normal" style={{ backgroundImage: 'url(/hotel_bg.png)' }}>
      <div className="rt-normal-overlay" />
      
      <div className="rt-luxury-content">
        {reportOverlay}

        {/* ── Assistance Banners ── */}
        {activeIncident && (activeIncident.status === 'dispatched' || activeIncident.status === 'en_route') && (
          <div className="rt-assistance-banner">
            <div className="rt-assistance-avatar" style={{ backgroundImage: `url(${activeIncident.assignedStaffPhotoUrl || ''})`, backgroundSize: 'cover', backgroundColor: 'var(--color-surface-3)' }}>
               {!activeIncident.assignedStaffPhotoUrl && activeIncident.assignedTo?.charAt(0)}
            </div>
            <div className="rt-assistance-info">
              <div className="rt-assistance-title">Assistance En Route</div>
              <div className="rt-assistance-name">{activeIncident.assignedTo} is coming to help</div>
            </div>
          </div>
        )}
        {activeIncident && activeIncident.status === 'active' && (
          <div className="rt-assistance-banner pending">
            <div className="rt-assistance-info">
              <div className="rt-assistance-title">Request Received</div>
              <div className="rt-assistance-name">Assigning staff shortly...</div>
            </div>
          </div>
        )}

        {/* ── Luxury Header ── */}
        <div className="rt-lux-header">
          <div className="rt-lux-brand">CRISISFLOW <span style={{fontWeight: 300}}>RESORT</span></div>
          <div className="rt-lux-room-badge">SUITE {roomNumber}</div>
        </div>

        {/* ── Greeting ── */}
        <div className="rt-lux-welcome">
          <div className="rt-lux-greeting">Welcome{profile?.displayName ? `, ${profile.displayName}` : ''}.</div>
          <div className="rt-lux-time">{timeStr} · {dateStr}</div>
        </div>

        {/* ── Quick Status ── */}
        <div className="rt-lux-status-bar">
          <div className="rt-lux-status-item"><span className="rt-lux-status-icon">🌡️</span> 22°C Perfect</div>
          <div className="rt-lux-status-item"><span className="rt-lux-status-icon">📶</span> Premium Wi-Fi</div>
          <div className="rt-lux-status-item"><span className="rt-lux-status-icon">🛎️</span> Concierge Online</div>
        </div>

        {/* ── Services Grid ── */}
        <div className="rt-lux-services">
          <div className="rt-lux-services-title">HOW CAN WE ASSIST YOU TODAY?</div>
          <div className="rt-lux-grid">
            <button className="rt-lux-card" onClick={() => { setShowReportMenu(true); handleSelectCategory('roomService'); }}>
              <span className="rt-lux-icon">🍽️</span><span className="rt-lux-label">In-Room Dining</span>
            </button>
            <button className="rt-lux-card" onClick={() => { setShowReportMenu(true); handleSelectCategory('cleaning'); }}>
              <span className="rt-lux-icon">🧹</span><span className="rt-lux-label">Housekeeping</span>
            </button>
            <button className="rt-lux-card" onClick={() => { setShowReportMenu(true); handleSelectCategory('maintenance'); }}>
              <span className="rt-lux-icon">🔧</span><span className="rt-lux-label">Maintenance</span>
            </button>
            <button className="rt-lux-card" onClick={() => { setShowReportMenu(true); handleSelectCategory('electrical'); }}>
              <span className="rt-lux-icon">💡</span><span className="rt-lux-label">Lighting & Power</span>
            </button>
            <button className="rt-lux-card" onClick={() => { setShowReportMenu(true); handleSelectCategory('hvac'); }}>
              <span className="rt-lux-icon">❄️</span><span className="rt-lux-label">Climate Control</span>
            </button>
            <button className="rt-lux-card" onClick={() => setShowReportMenu(true)}>
              <span className="rt-lux-icon">📋</span><span className="rt-lux-label">Other Request</span>
            </button>
          </div>
        </div>

        {/* ── Footer Actions ── */}
        <div className="rt-lux-footer">
          <button className="rt-lux-btn-danger" onClick={handlePanic}>
            <span style={{ fontSize: '1.2rem', marginRight: 8 }}>🚨</span> EMERGENCY
          </button>
          <button className="rt-lux-btn-outline" onClick={logout}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value, valueColor }) {
  return (
    <div className="rt-info-tile">
      <span className="rt-info-tile-icon">{icon}</span>
      <div>
        <div className="rt-info-tile-label">{label}</div>
        <div className="rt-info-tile-value" style={{ color: valueColor }}>{value}</div>
      </div>
    </div>
  );
}

function ServiceBtn({ icon, label, onClick }) {
  return (
    <button className="rt-service-btn" onClick={onClick}>
      <span className="rt-service-icon">{icon}</span>
      <span className="rt-service-label">{label}</span>
    </button>
  );
}
