import { useState } from 'react';
import useIncidentStore from '../../store/useIncidentStore';
import IncidentDetailCard from './IncidentDetailCard';
import IncidentProcessView from '../detail/IncidentProcessView';

export default function IncidentsPage() {
  const { liveIncidents, incidentsLoading, focusedIncidentId, setFocusedIncidentId } = useIncidentStore();
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'resolved'

  const focusedIncident = focusedIncidentId
    ? liveIncidents.find(i => i.id === focusedIncidentId) ?? liveIncidents[0]
    : null;

  const filteredIncidents = liveIncidents.filter(inc => {
    if (filter === 'active') return inc.status !== 'resolved';
    if (filter === 'resolved') return inc.status === 'resolved';
    return true;
  });

  return (
    <div className="flex-col" style={{ height: '100%', overflow: 'hidden' }}>
      {/* Page Header */}
      <div className="page-header">
        {focusedIncident && (
          <button className="btn-back" onClick={() => setFocusedIncidentId(null)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        <div>
          <div className="page-header-title font-display">
            {focusedIncident ? 'Incident Details' : 'Incident Log'}
          </div>
          <div className="page-header-sub">
            {focusedIncident ? 'Deep dive and orchestration context' : 'All active and historical incidents'}
          </div>
        </div>

        {/* Filter Bar */}
        {!focusedIncident && (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', paddingRight: 32 }}>
            <div style={{ display: 'flex', background: 'var(--color-surface-2)', borderRadius: 8, padding: 4, gap: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
              {['all', 'active', 'resolved'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '6px 16px',
                    background: filter === f ? 'var(--color-surface-3)' : 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    color: filter === f ? '#fff' : 'var(--color-text-mid)',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: filter === f ? '0 2px 8px rgba(0,0,0,0.2)' : 'none'
                  }}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="live-badge">
          <div className="live-dot" />
          LIVE
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {incidentsLoading ? (
          <div className="flex items-center justify-center" style={{ height: '100%' }}>
            <Spinner />
          </div>
        ) : focusedIncident ? (
          <IncidentProcessView incident={focusedIncident} />
        ) : filteredIncidents.length === 0 ? (
          <div className="flex-col items-center justify-center" style={{ height: '100%', gap: 12, alignItems: 'center', justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'rgba(255,255,255,0.15)', letterSpacing: 2, fontWeight: 700 }}>NO {filter !== 'all' ? filter.toUpperCase() : 'ACTIVE'} INCIDENTS</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.08)' }}>System on Standby</div>
          </div>
        ) : (
          <div style={{ padding: '20px 28px', overflowY: 'auto', height: '100%' }}>
            {filteredIncidents.map(i => <IncidentDetailCard key={i.id} incident={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ width: 28, height: 28, border: '3px solid var(--color-surface-3)', borderTop: '3px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  );
}
