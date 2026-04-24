import useIncidentStore from '../../store/useIncidentStore';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )},
  { id: 'incidents', label: 'Incidents', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )},
  { id: 'resources', label: 'Resources', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )},
];

export default function Sidebar() {
  const { currentPage, setCurrentPage, triggerTestIncident, isProcessing } = useIncidentStore();

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <div className="sidebar-brand-bar" />
          <span className="sidebar-brand-name">ORCHESTRATOR</span>
        </div>
        <div className="sidebar-brand-district">DISTRICT 04</div>
      </div>

      {/* Navigation */}
      {NAV.map(item => (
        <div
          key={item.id}
          className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
          onClick={() => setCurrentPage(item.id)}
        >
          {item.icon}
          {item.label}
        </div>
      ))}

      {/* Bottom: operator + buttons */}
      <div className="sidebar-bottom">
        <div className="operator-card">
          <div className="operator-avatar">O</div>
          <div>
            <div className="operator-name">Operator 72</div>
            <div className="operator-status">Active Duty</div>
          </div>
        </div>
        <button
          className="btn-simulate"
          onClick={triggerTestIncident}
          disabled={isProcessing}
        >
          {isProcessing ? 'PROCESSING...' : 'SIMULATE EMERGENCY'}
        </button>
        <button className="btn-deploy">DEPLOY ASSETS</button>
      </div>
    </aside>
  );
}
