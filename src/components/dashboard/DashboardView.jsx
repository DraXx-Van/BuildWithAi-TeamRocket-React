import useIncidentStore from '../../store/useIncidentStore';
import IncidentTile from './IncidentTile';
import FloorPlanCanvas from './FloorPlanCanvas';

export default function DashboardView() {
  const { liveIncidents, incidentsLoading, dispatchResult } = useIncidentStore();

  const totalActive   = liveIncidents.filter(i => i.status === 'active').length;
  const totalCritical = liveIncidents.filter(i => i.severity >= 8).length;
  const totalDispatched = liveIncidents.filter(i => i.status === 'dispatched').length;

  return (
    <div className="flex-col" style={{ height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-header-title font-display">Command Dashboard</div>
          <div className="page-header-sub">Real-time incident monitoring & dispatch</div>
        </div>
        <div className="live-badge">
          <div className="live-dot" />
          LIVE
        </div>
      </div>

      <div className="page-body flex-col gap-24" style={{ overflow: 'auto' }}>
        {/* Dispatch Banner */}
        {dispatchResult && (
          <div className="dispatch-banner">
            <span style={{ fontSize: 20 }}>🚀</span>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-success)', letterSpacing: 2, marginBottom: 3 }}>RESPONDER DISPATCHED</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-hi)' }}>{dispatchResult}</div>
            </div>
          </div>
        )}

        {/* Main Dashboard Layout: 2 Columns */}
        <div style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>
          
          {/* Left Column: Feed & Metrics */}
          <div style={{ flex: '0 0 450px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', paddingRight: 12 }}>
            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <MetricCard label="ACTIVE" value={totalActive} valueColor="var(--color-error)" />
              <MetricCard label="CRITICAL" value={totalCritical} valueColor="var(--color-warning)" />
              <MetricCard label="DISPATCHED" value={totalDispatched} valueColor="var(--color-success)" />
            </div>

            {/* Live Feed */}
            <div style={{ flex: 1 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--color-text-hi)' }}>Live Incident Feed</div>
              </div>

              {incidentsLoading ? (
                <div className="flex items-center justify-center" style={{ padding: 40 }}>
                  <Spinner />
                </div>
              ) : liveIncidents.length === 0 ? (
                <div className="flex-col items-center" style={{ padding: 60, gap: 12, alignItems: 'center' }}>
                  <div style={{ fontSize: 40 }}>✅</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.15)', letterSpacing: 3 }}>STANDBY</div>
                </div>
              ) : (
                liveIncidents.map(i => <IncidentTile key={i.id} incident={i} />)
              )}
            </div>
          </div>

          {/* Right Column: Floor Plan Canvas */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-mid)', letterSpacing: 2, fontWeight: 600 }}>TACTICAL BLUEPRINT</div>
              <div style={{ padding: '4px 12px', background: 'rgba(139,92,246,0.1)', color: 'var(--color-primary)', borderRadius: 12, fontSize: 10, fontFamily: 'var(--font-mono)' }}>CONNECT AI LIVE</div>
            </div>
            <div style={{ flex: 1, minHeight: 400 }}>
              <FloorPlanCanvas />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, valueColor }) {
  return (
    <div style={{ background: 'rgba(39,39,42,0.7)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', padding: 20, backdropFilter: 'blur(12px)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--color-text-mid)', fontWeight: 600, letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: valueColor, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function Spinner() {
  return <div style={{ width: 28, height: 28, border: '3px solid var(--color-surface-3)', borderTop: '3px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />;
}
