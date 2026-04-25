import useIncidentStore from '../../store/useIncidentStore';
import IncidentTile from './IncidentTile';
import FloorPlanCanvas from './FloorPlanCanvas';

export default function DashboardView() {
  const { liveIncidents, incidentsLoading, dispatchResult, isProcessing, isScanning } = useIncidentStore();

  const totalActive = liveIncidents.length;
  const totalCritical = liveIncidents.filter(i => i.severity >= 8).length;
  const totalDispatched = liveIncidents.filter(i => i.status === 'dispatched').length;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: 'var(--color-bg)' }}>
      
      {/* Center Column: Floor Plan Canvas (Full Height) */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        
        {/* Floating Header / Metrics */}
        <div style={{ position: 'absolute', top: 32, left: 32, zIndex: 10, display: 'flex', gap: 16 }}>
          <MetricCard label="ACTIVE ALERTS" value={totalActive < 10 && totalActive > 0 ? '0' + totalActive : totalActive} valueColor="var(--color-primary)" />
          <MetricCard label="ASSETS DEPLOYED" value={totalDispatched < 10 && totalDispatched > 0 ? '0' + totalDispatched : totalDispatched} valueColor="white" />
        </div>

        {/* Floating Dispatch Banner */}
        {dispatchResult && (
          <div style={{ position: 'absolute', top: 32, right: 32, zIndex: 10, padding: '16px 24px', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--color-success)', borderRadius: 'var(--radius-md)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 24 }}>🚀</div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-success)', fontWeight: 700, letterSpacing: 1.5, marginBottom: 4 }}>RESPONDER DISPATCHED</div>
              <div style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>{dispatchResult}</div>
            </div>
          </div>
        )}

        {/* Global AI Processing Status */}
        {(isProcessing || isScanning) && (
          <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 100, padding: '12px 24px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid var(--color-primary)', borderRadius: 100, backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 32px rgba(139, 92, 246, 0.2)', animation: 'slideUp 0.4s ease-out' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-primary)', boxShadow: '0 0 10px var(--color-primary)', animation: 'pulse 1.5s infinite' }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'white', fontWeight: 600, letterSpacing: 1 }}>
              {isScanning ? 'GEMINI IS RECONSTRUCTING BLUEPRINT...' : 'GEMINI IS ANALYZING TACTICAL DATA...'}
            </div>
            <style>{`
              @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
              @keyframes pulse { 0% { opacity: 0.4; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } 100% { opacity: 0.4; transform: scale(0.8); } }
            `}</style>
          </div>
        )}

        <div style={{ flex: 1, position: 'relative' }}>
          <FloorPlanCanvas fullBleed={true} />
        </div>
      </div>

      {/* Right Column: Live Incident Feed */}
      <div style={{ width: 400, background: 'var(--color-surface-1)', borderLeft: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '32px 24px 16px 24px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--color-text-hi)', letterSpacing: 1.5, marginBottom: 16 }}>LIVE INCIDENT FEED</div>
          <div className="flex gap-8">
            {['All', 'Critical', 'Warning'].map(f => (
              <span key={f} style={{ padding: '6px 16px', borderRadius: 20, background: f === 'All' ? 'var(--color-primary)' : 'var(--color-surface-2)', color: f === 'All' ? 'white' : 'var(--color-text-mid)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {incidentsLoading ? (
            <div className="flex items-center justify-center" style={{ padding: 40 }}>
              <Spinner />
            </div>
          ) : liveIncidents.length === 0 ? (
            <div className="flex-col items-center justify-center" style={{ padding: 60, gap: 16, alignItems: 'center', flex: 1, display: 'flex' }}>
              <div style={{ fontSize: 40, opacity: 0.5 }}>🛡️</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-mid)', letterSpacing: 2 }}>STANDBY</div>
            </div>
          ) : (
            liveIncidents.map(i => <IncidentTile key={i.id} incident={i} />)
          )}
        </div>
      </div>

    </div>
  );
}

function MetricCard({ label, value, valueColor }) {
  return (
    <div style={{ 
      background: 'rgba(39,39,42,0.85)', 
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.05)', 
      borderRadius: 'var(--radius-lg)', 
      padding: '16px 20px',
      minWidth: 140,
      boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--color-text-mid)', letterSpacing: 1.5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: valueColor, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid var(--color-surface-3)', borderTopColor: 'var(--color-primary)', animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
