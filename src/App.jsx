import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import useAuthStore from './store/useAuthStore';
import useIncidentStore from './store/useIncidentStore';

// ── Surfaces ─────────────────────────────────────────────────────────────────
import DashboardShell from './components/layout/DashboardShell';
import ResponderHUD from './components/responder/ResponderHUD';
import LoginPage from './components/auth/LoginPage';
import RoomTab from './components/room/RoomTab';
import TacticalView from './components/tactical/TacticalView';

import './styles/index.css';

// ── Role-based redirect helper ───────────────────────────────────────────────
function RoleRedirect() {
  const role = useAuthStore(s => s.role);
  if (role === 'resident') return <Navigate to="/room" replace />;
  if (role === 'staff')    return <Navigate to="/staff" replace />;
  return <Navigate to="/command" replace />;
}

export default function App() {
  const initAuth = useAuthStore(s => s.init);
  const cleanupAuth = useAuthStore(s => s.cleanup);
  const user = useAuthStore(s => s.user);
  const role = useAuthStore(s => s.role);
  const isLoading = useAuthStore(s => s.isLoading);

  const initStore = useIncidentStore(s => s.init);
  const cleanupStore = useIncidentStore(s => s.cleanup);

  // Initialize auth observer on mount
  useEffect(() => {
    initAuth();
    return () => cleanupAuth();
  }, [initAuth, cleanupAuth]);

  // Initialize incident store when authenticated
  useEffect(() => {
    if (user) {
      initStore();
      return () => cleanupStore();
    }
  }, [user, initStore, cleanupStore]);

  // Loading screen
  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-brand">
          <div className="loading-bar" />
          <span className="loading-title">CRISISFLOW</span>
        </div>
        <div className="loading-sub">Initializing secure connection...</div>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/tactical/:keyId" element={<TacticalView />} />
      <Route path="/login" element={
        user ? <RoleRedirect /> : <LoginPage />
      } />

      {/* Protected: Command Dashboard (the main experience) */}
      <Route path="/command/*" element={
        user ? <DashboardShell /> : <Navigate to="/login" replace />
      } />

      {/* Protected: Staff HUD */}
      <Route path="/staff" element={
        user ? <ResponderHUD /> : <Navigate to="/login" replace />
      } />

      {/* Protected: Room Tab */}
      <Route path="/room" element={
        user ? <RoomTab /> : <Navigate to="/login" replace />
      } />

      {/* Root: redirect based on role */}
      <Route path="/" element={
        user ? <RoleRedirect /> : <Navigate to="/login" replace />
      } />

      {/* Catch-all: redirect to role-based surface */}
      <Route path="*" element={
        user ? <RoleRedirect /> : <Navigate to="/login" replace />
      } />
    </Routes>
  );
}
