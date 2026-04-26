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
