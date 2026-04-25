import { useState, useEffect } from 'react';
import useIncidentStore from './store/useIncidentStore';
import DashboardShell from './components/layout/DashboardShell';
import ResponderHUD from './components/responder/ResponderHUD';
import './styles/index.css';

export default function App() {
  const [appMode, setAppMode] = useState('orchestrator'); // 'orchestrator' | 'responder'
  const initStore = useIncidentStore(s => s.init);
  const cleanupStore = useIncidentStore(s => s.cleanup);

  useEffect(() => {
    initStore();
    return () => cleanupStore();
  }, [initStore, cleanupStore]);

  return (
    <>
      {/* Mode toggle (development only) */}
      <div style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 9999, display: 'flex', gap: 5 }}>
        <button
          onClick={() => setAppMode('orchestrator')}
          style={{ padding: '4px 8px', fontSize: 10, background: appMode === 'orchestrator' ? 'var(--color-primary)' : 'var(--color-surface-2)', color: 'white', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer' }}
        >
          ORCHESTRATOR
        </button>
        <button
          onClick={() => setAppMode('responder')}
          style={{ padding: '4px 8px', fontSize: 10, background: appMode === 'responder' ? 'var(--color-success)' : 'var(--color-surface-2)', color: 'white', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer' }}
        >
          RESPONDER HUD
        </button>
      </div>

      {appMode === 'orchestrator' ? <DashboardShell /> : <ResponderHUD />}
    </>
  );
}
