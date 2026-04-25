import useIncidentStore from '../../store/useIncidentStore';
import IncidentTile from './IncidentTile';
import FloorPlanCanvas from './FloorPlanCanvas';

export default function DashboardView() {
  const { 
    liveIncidents, incidentsLoading, dispatchResult, 
    isProcessing, isScanning, 
    isEvacuationActive, setEvacuationActive 
  } = useIncidentStore();

  const totalActive    = liveIncidents.filter(i => i.status === 'active').length;
  const totalCritical  = liveIncidents.filter(i => i.severity >= 8).length;
  const totalDispatched= liveIncidents.filter(i => i.status === 'dispatched').length;
  const totalResolved  = liveIncidents.filter(i => i.status === 'resolved').length;

  return (
    <div className="cmd-dashboard">
      {/* ── Header Bar ───────────────────────────────────────────────── */}
      <div className="cmd-header">
        <div className="cmd-header-left">
          <div className="cmd-header-title">Command Dashboard</div>
          <div className="cmd-header-sub">Real-time situational awareness & incident response</div>
        </div>
        <div className="cmd-header-right">
          <div className="cmd-header-time font-mono">
            {new Date().toLocaleTimeString('en-US', { hour12: false })}
          </div>
          <button 
            className={`cmd-evac-toggle ${isEvacuationActive ? 'active' : ''}`}
            onClick={() => setEvacuationActive(!isEvacuationActive)}
          >
            {isEvacuationActive ? 'CANCEL EVACUATION' : 'INITIATE EVACUATION'}
          </button>
          <div className="live-badge">
            <div className="live-dot" />
            LIVE
          </div>
        </div>
      </div>

      {/* ── Metrics Strip ────────────────────────────────────────────── */}
      <div className="cmd-metrics">
        <MetricCard label="ACTIVE INCIDENTS" value={totalActive} color="var(--color-error)" icon="🔴" />
        <MetricCard label="CRITICAL" value={totalCritical} color="var(--color-warning)" icon="⚠️" />
        <MetricCard label="DISPATCHED" value={totalDispatched} color="#3b82f6" icon="🚀" />
        <MetricCard label="RESOLVED" value={totalResolved} color="var(--color-success)" icon="✅" />
      </div>

      {/* ── Dispatch Banner ──────────────────────────────────────────── */}
      {dispatchResult && (
        <div className="cmd-dispatch-banner">
          <span className="cmd-dispatch-icon">🚀</span>
          <div>
            <div className="cmd-dispatch-label">RESPONDER DISPATCHED</div>
            <div className="cmd-dispatch-text">{dispatchResult}</div>
          </div>
        </div>
      )}

      {/* ── Main Content: Floor Plan + Feed ──────────────────────────── */}
      <div className="cmd-body">
        {/* Left: Floor Plan (the main attraction) */}
        <div className="cmd-floorplan-area">
          <div className="cmd-section-header">
            <div className="cmd-section-title">TACTICAL BLUEPRINT</div>
            <div className="cmd-ai-badge">
              <span className="cmd-ai-dot" />
              GEMINI AI LINKED
            </div>
          </div>
          
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-lg)', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--color-border)' }}>
            <FloorPlanCanvas fullBleed={true} />

            {/* Global AI Processing Status */}
            {(isProcessing || isScanning) && (
              <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 100, padding: '12px 24px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid var(--color-primary)', borderRadius: 100, backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 32px rgba(139, 92, 246, 0.2)', animation: 'slideUp 0.4s ease-out' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-primary)', boxShadow: '0 0 10px var(--color-primary)', animation: 'pulseAlert 1.5s infinite' }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'white', fontWeight: 600, letterSpacing: 1 }}>
                  {isScanning ? 'GEMINI IS RECONSTRUCTING BLUEPRINT...' : 'GEMINI IS ANALYZING TACTICAL DATA...'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Incident Feed */}
        <div className="cmd-feed-area">
          <div className="cmd-section-header">
            <div className="cmd-section-title">LIVE FEED</div>
            <div className="cmd-feed-count">{liveIncidents.length}</div>
          </div>
          <div className="cmd-feed-scroll">
            {incidentsLoading ? (
              <div className="cmd-feed-empty">
                <Spinner />
                <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-mid)', letterSpacing: 2 }}>LOADING...</span>
              </div>
            ) : liveIncidents.length === 0 ? (
              <div className="cmd-feed-empty">
                <div style={{ fontSize: 40 }}>✅</div>
                <div className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', letterSpacing: 3 }}>ALL CLEAR — STANDBY</div>
              </div>
            ) : (
              liveIncidents.map(i => <IncidentTile key={i.id} incident={i} />)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color, icon }) {
  return (
    <div className="cmd-metric-card">
      <div className="cmd-metric-top">
        <span className="cmd-metric-icon">{icon}</span>
        <span className="cmd-metric-label">{label}</span>
      </div>
      <div className="cmd-metric-value" style={{ color }}>{value}</div>
    </div>
  );
}

function Spinner() {
  return <div className="loading-spinner" style={{ width: 24, height: 24 }} />;
}
