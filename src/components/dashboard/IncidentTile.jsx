import { useState } from 'react';
import useIncidentStore from '../../store/useIncidentStore';
import { fullTimestamp } from '../../models/incident';
import DispatchPanel from './DispatchPanel';
import { ISSUE_CATEGORIES } from '../../services/staffData';

export default function IncidentTile({ incident }) {
  const { selectedIncidentId, setSelectedIncidentId, setCurrentPage, setFocusedIncidentId } = useIncidentStore();
  const [showDispatch, setShowDispatch] = useState(false);
  const isSelected = selectedIncidentId === incident.id;
  const isCritical = incident.severity >= 8;
  const cat = ISSUE_CATEGORIES[incident.type];
  const isCrisis = cat?.isCrisis || isCritical;
  const accent = isCritical ? 'var(--color-error)' : isCrisis ? 'var(--color-warning)' : 'var(--color-primary)';

  const handleClick = () => setSelectedIncidentId(incident.id);
  const handleViewDetails = (e) => {
    e.stopPropagation();
    setFocusedIncidentId(incident.id);
    setCurrentPage('incidents');
  };

  return (
    <>
      <div
        onClick={handleClick}
        style={{
          position: 'relative',
          marginBottom: 16,
          background: isSelected ? 'rgba(63,63,70,0.4)' : 'rgba(39,39,42,0.5)',
          borderRadius: 'var(--radius-lg)',
          border: `${isSelected ? 2 : 1}px solid ${isSelected ? 'var(--color-primary)' : 'rgba(63,63,70,0.5)'}`,
          cursor: 'pointer',
          transition: 'all 0.15s',
          overflow: 'hidden',
        }}
      >
        {/* Severity accent stripe */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accent, borderRadius: '12px 0 0 12px' }} />

        <div style={{ padding: 20, paddingLeft: 24 }}>
          {/* Top row */}
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <div className="flex items-center gap-8">
              <span style={{ padding: '2px 8px', background: `${accent}18`, borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: accent }}>
                PRIORITY {String(incident.severity).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-mid)' }}>
                {fullTimestamp(incident.timestamp)}
              </span>
              {incident.signalCount > 1 && (
                <span style={{ padding: '1px 6px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--color-warning)' }}>
                  ×{incident.signalCount}
                </span>
              )}
              {/* Category label */}
              {cat && (
                <span style={{ padding: '1px 6px', background: 'rgba(147,130,220,0.1)', border: '1px solid rgba(147,130,220,0.3)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--color-primary)' }}>
                  {cat.icon} {cat.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-8">
              {incident.assignedTo && (
                <span style={{ padding: '2px 8px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: 'var(--color-success)' }}>
                  ▶ {incident.assignedTo}
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--color-text-hi)', marginBottom: 4 }}>
            {incident.type.toUpperCase()} — {incident.description.split(' ').slice(0, 4).join(' ')}...
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-mid)', lineHeight: 1.5, marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {incident.description}
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: 'var(--color-text-mid)' }}>
              📍 {incident.location.toUpperCase()}
            </span>
            <div className="flex items-center gap-8">
              {/* Assign button — only if not yet dispatched */}
              {!incident.assignedTo && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDispatch(true); }}
                  style={{ padding: '5px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: 10, cursor: 'pointer', letterSpacing: 0.5 }}
                >
                  ASSIGN STAFF ↗
                </button>
              )}
              {isCritical
                ? <button onClick={handleViewDetails} style={{ padding: '5px 12px', background: 'var(--color-surface-3)', color: 'var(--color-text-hi)', border: 'none', borderRadius: 4, fontWeight: 700, fontSize: 10, cursor: 'pointer', letterSpacing: 0.5 }}>OPEN SOP ↗</button>
                : <button onClick={handleViewDetails} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 10, fontWeight: 700, cursor: 'pointer', letterSpacing: 1 }}>VIEW DETAILS →</button>
              }
            </div>
          </div>
        </div>
      </div>

      {/* Dispatch Panel Overlay */}
      {showDispatch && (
        <div className="dispatch-overlay" onClick={(e) => e.target === e.currentTarget && setShowDispatch(false)}>
          <DispatchPanel incident={incident} onClose={() => setShowDispatch(false)} />
        </div>
      )}
    </>
  );
}
