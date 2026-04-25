import { useNavigate, useLocation } from 'react-router-dom';
import useIncidentStore from '../../store/useIncidentStore';
import useAuthStore from '../../store/useAuthStore';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', path: '/command', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )},
  { id: 'incidents', label: 'Incidents', path: '/command/incidents', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )},
  { id: 'resources', label: 'Resources', path: '/command/resources', icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )},
];

export default function Sidebar() {
  const { triggerTestIncident, isProcessing } = useIncidentStore();
  const { profile, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <div className="sidebar-brand-bar" />
          <span className="sidebar-brand-name">CRISISFLOW</span>
        </div>
        <div className="sidebar-brand-district">COMMAND CENTER</div>
      </div>

      {/* Navigation */}
      {NAV.map(item => (
        <div
          key={item.id}
          className={`nav-item ${currentPath === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          {item.icon}
          {item.label}
        </div>
      ))}

      {/* Bottom: operator + buttons */}
      <div className="sidebar-bottom">
        <div className="operator-card">
          <div className="operator-avatar">
            {(profile?.displayName || 'O').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="operator-name">{profile?.displayName || 'Operator'}</div>
            <div className="operator-status">{profile?.role === 'command' ? 'Command' : 'Staff'} · Active</div>
          </div>
        </div>
        <button
          className="btn-simulate"
          onClick={triggerTestIncident}
          disabled={isProcessing}
        >
          {isProcessing ? 'PROCESSING...' : '⚡ SIMULATE EMERGENCY'}
        </button>
        <button className="btn-deploy" onClick={logout}>
          🔒 SIGN OUT
        </button>
      </div>
    </aside>
  );
}
