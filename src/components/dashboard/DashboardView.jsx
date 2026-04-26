import { useState } from 'react';
import useIncidentStore from '../../store/useIncidentStore';
import IncidentTile from './IncidentTile';
import FloorPlanCanvas from './FloorPlanCanvas';

export default function DashboardView() {
  const { 
    liveIncidents, incidentsLoading, dispatchResult, dispatchIncidentId,
    isProcessing, isScanning, 
    isEvacuationActive, setEvacuationActive 
  } = useIncidentStore();

  const [feedFilter, setFeedFilter] = useState('active');

  // Active alerts should include all ongoing incidents (active, dispatched, etc.)
  const totalActive    = liveIncidents.filter(i => i.status !== 'resolved').length;
  const totalCritical  = liveIncidents.filter(i => i.severity >= 8).length;
  const totalDispatched= liveIncidents.filter(i => i.status === 'dispatched').length;
  const totalResolved  = liveIncidents.filter(i => i.status === 'resolved').length;

  const filteredIncidents = liveIncidents.filter(i => 
    feedFilter === 'active' ? i.status !== 'resolved' : i.status === 'resolved'
  );

  return (
    <div className="cmd-dashboard">
      {/* ── Main Content: Floor Plan + Feed ──────────────────────────── */}
      <div className="cmd-body">
        {/* Left: Floor Plan (the main attraction) */}
        <div className="cmd-floorplan-area">
          <div style={{ flex: 1, position: 'relative', borderRadius: 'var(--radius-lg)', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
            
            {/* ── OVERLAY STATS (Top Left) ── */}
            <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 1200, display: 'flex', gap: 12 }}>
              <div style={{ background: 'rgba(28,28,34,0.92)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140, backdropFilter: 'blur(20px)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5 }}>ACTIVE ALERTS</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#a78bfa' }}>{totalActive.toString().padStart(2, '0')}</div>
              </div>
              <div style={{ background: 'rgba(28,28,34,0.92)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140, backdropFilter: 'blur(20px)', boxShadow: '0 12px 40px rgba(0,0,0,0.6)' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5 }}>ASSETS DEPLOYED</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#ffffff' }}>{totalDispatched.toString().padStart(2, '0')}</div>
              </div>
            </div>

            {/* ── OVERLAY DISPATCH BANNER (Top Center) ── */}
            {dispatchResult && dispatchIncidentId && liveIncidents.some(i => i.id === dispatchIncidentId && i.status === 'active') && (
              <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1200, background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)', borderRadius: 12, padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 12, backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(6,182,212,0.15)' }}>
                <span style={{ fontSize: 18 }}>🤖</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#06b6d4', letterSpacing: 2, fontWeight: 600 }}>AI RECOMMENDATION</div>
                  <div style={{ fontSize: 13, color: 'white', fontWeight: 600 }}>{dispatchResult}</div>
                </div>
              </div>
            )}

            {/* ── OVERLAY AI BADGE (Top Right) ── */}
            <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 1200 }}>
              <div className="cmd-ai-badge" style={{ background: 'rgba(139, 92, 246, 0.15)', border: '1px solid var(--color-primary)' }}>
                <span className="cmd-ai-dot" />
                GEMINI AI LINKED
              </div>
            </div>
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
          <div className="cmd-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="cmd-section-title">LIVE FEED</div>
              <div className="cmd-feed-count">{filteredIncidents.length}</div>
            </div>
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', padding: 2, borderRadius: 6 }}>
              <button 
                onClick={() => setFeedFilter('active')} 
                style={{ background: feedFilter === 'active' ? 'var(--color-primary)' : 'transparent', color: feedFilter === 'active' ? '#fff' : 'rgba(255,255,255,0.4)', border: 'none', padding: '4px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer', fontWeight: 700, letterSpacing: 1, transition: 'all 0.2s' }}
              >ACTIVE</button>
              <button 
                onClick={() => setFeedFilter('resolved')} 
                style={{ background: feedFilter === 'resolved' ? 'rgba(16,185,129,0.2)' : 'transparent', color: feedFilter === 'resolved' ? '#10b981' : 'rgba(255,255,255,0.4)', border: 'none', padding: '4px 8px', borderRadius: 4, fontSize: 10, cursor: 'pointer', fontWeight: 700, letterSpacing: 1, transition: 'all 0.2s' }}
              >RESOLVED</button>
            </div>
          </div>
          <div className="cmd-feed-scroll">
            {incidentsLoading ? (
              <div className="cmd-feed-empty">
                <Spinner />
                <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-mid)', letterSpacing: 2 }}>LOADING...</span>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="cmd-feed-empty">
                <div style={{ fontSize: 40 }}>✅</div>
                <div className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', letterSpacing: 3 }}>
                  {feedFilter === 'active' ? 'ALL CLEAR — STANDBY' : 'NO RESOLVED INCIDENTS'}
                </div>
              </div>
            ) : (
              filteredIncidents.map(i => <IncidentTile key={i.id} incident={i} />)
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
