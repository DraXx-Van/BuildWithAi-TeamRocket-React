import { useState, useEffect } from 'react';
import { fetchStaff } from '../../services/firebaseService';
import StaffCard from './StaffCard';

export default function ResourcesPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadStaff = async () => {
    setLoading(true);
    const data = await fetchStaff();
    setStaff(data);
    setLoading(false);
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const availableCount = staff.filter(s => s.isAvailable).length;

  return (
    <div className="flex-col" style={{ height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="page-header-title font-display">STAFF RESOURCES</div>
          <div className="page-header-sub">Hotel staff roster and skill assignments</div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            padding: '6px 12px',
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)' }} />
            <span style={{ color: 'var(--color-success)', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
              {availableCount} AVAILABLE
            </span>
          </div>
          
          <button onClick={loadStaff} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 1015-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12A9 9 0 106 18.7L3 16"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Spinner />
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {staff.map(s => <StaffCard key={s.id} member={s} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return <div style={{ width: 28, height: 28, border: '3px solid var(--color-surface-3)', borderTop: '3px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />;
}
