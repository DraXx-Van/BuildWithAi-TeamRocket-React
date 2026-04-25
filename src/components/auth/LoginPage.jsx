import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';

export default function LoginPage() {
  const [mode, setMode] = useState('staff'); // 'staff' | 'resident' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const { loginAsStaff, loginAsResident, register, enterDemoMode, error, isLoading, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    await loginAsStaff(email, password);
  };

  const handleResidentLogin = async (e) => {
    e.preventDefault();
    await loginAsResident(roomNumber, displayName);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    await register(email, password, displayName, 'command');
  };

  return (
    <div className="login-screen">
      {/* Background grid */}
      <div className="login-grid-bg" />

      {/* Centered card */}
      <div className="login-card">
        {/* Brand */}
        <div className="login-brand">
          <div className="login-brand-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h1 className="login-title">CRISISFLOW</h1>
          <p className="login-subtitle">Rapid Crisis Response Command</p>
        </div>

        {/* ═══ QUICK ACCESS — Demo Mode ═══════════════════════════════════════ */}
        <div className="demo-access">
          <div className="demo-label">QUICK ACCESS</div>
          <div className="demo-buttons">
            <button className="demo-btn command" onClick={() => enterDemoMode('command')}>
              <span className="demo-btn-icon">🖥️</span>
              <span className="demo-btn-text">Command</span>
              <span className="demo-btn-role">Dashboard</span>
            </button>
            <button className="demo-btn staff" onClick={() => enterDemoMode('staff')}>
              <span className="demo-btn-icon">📱</span>
              <span className="demo-btn-text">Staff</span>
              <span className="demo-btn-role">Field Agent</span>
            </button>
            <button className="demo-btn resident" onClick={() => enterDemoMode('resident')}>
              <span className="demo-btn-icon">🚪</span>
              <span className="demo-btn-text">Resident</span>
              <span className="demo-btn-role">Room Guest</span>
            </button>
          </div>
        </div>

        <div className="login-divider">
          <span>OR SIGN IN</span>
        </div>

        {/* Mode Selector */}
        <div className="login-modes">
          <button
            className={`login-mode-btn ${mode === 'staff' ? 'active' : ''}`}
            onClick={() => { setMode('staff'); clearError(); }}
          >
            STAFF
          </button>
          <button
            className={`login-mode-btn ${mode === 'resident' ? 'active' : ''}`}
            onClick={() => { setMode('resident'); clearError(); }}
          >
            RESIDENT
          </button>
          <button
            className={`login-mode-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); clearError(); }}
          >
            REGISTER
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="login-error">
            <span>⚠</span> {error}
          </div>
        )}

        {/* Staff Login */}
        {mode === 'staff' && (
          <form onSubmit={handleStaffLogin} className="login-form">
            <div className="login-field">
              <label>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="operator@crisisflow.io" required autoComplete="email" />
            </div>
            <div className="login-field">
              <label>PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
            </div>
            <button type="submit" className="login-submit" disabled={isLoading}>
              {isLoading ? 'AUTHENTICATING...' : 'ENTER COMMAND CENTER'}
            </button>
          </form>
        )}

        {/* Resident Login */}
        {mode === 'resident' && (
          <form onSubmit={handleResidentLogin} className="login-form">
            <div className="login-field">
              <label>ROOM NUMBER</label>
              <input type="text" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="e.g. 304" required style={{ fontSize: 24, textAlign: 'center', letterSpacing: 8 }} />
            </div>
            <div className="login-field">
              <label>YOUR NAME (OPTIONAL)</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Guest name" autoComplete="name" />
            </div>
            <button type="submit" className="login-submit login-submit-resident" disabled={isLoading}>
              {isLoading ? 'CONNECTING...' : 'ACCESS ROOM SAFETY'}
            </button>
          </form>
        )}

        {/* Register */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="login-form">
            <div className="login-field">
              <label>DISPLAY NAME</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Command Officer" required autoComplete="name" />
            </div>
            <div className="login-field">
              <label>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="officer@crisisflow.io" required autoComplete="email" />
            </div>
            <div className="login-field">
              <label>PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} autoComplete="new-password" />
            </div>
            <button type="submit" className="login-submit" disabled={isLoading}>
              {isLoading ? 'CREATING ACCOUNT...' : 'CREATE COMMAND ACCOUNT'}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="login-footer">
          <span>Solution Challenge 2026</span>
          <span>·</span>
          <span>Powered by Google Cloud & Gemini AI</span>
        </div>
      </div>
    </div>
  );
}
