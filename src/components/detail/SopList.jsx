import useIncidentStore from '../../store/useIncidentStore';
import { ClipboardList } from 'lucide-react';

export default function SopList({ incident }) {
  const { sopSteps, isProcessing } = useIncidentStore();
  
  return (
    <div className="card flex-col gap-20" style={{ 
      background: 'rgba(20,20,25,0.4)', 
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.05)' 
    }}>
      <div className="step-label">
        <span className="step-num" style={{ background: 'rgba(139, 92, 246, 0.1)' }}><ClipboardList size={14} color="#8b5cf6" /></span>
        AI RESPONSE PROTOCOL
      </div>

      {isProcessing ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#8b5cf6', fontFamily: 'var(--font-mono)', fontWeight: 800, letterSpacing: 2 }}>GEN PROTOCOL...</div>
          <div style={{ marginTop: 12, height: 2, background: 'rgba(139, 92, 246, 0.1)', width: '100%', position: 'relative', overflow: 'hidden', borderRadius: 1 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '40%', background: '#8b5cf6', animation: 'criticalPulse 1.5s infinite' }} />
          </div>
        </div>
      ) : sopSteps.length === 0 ? (
        <div style={{ padding: '24px 16px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.05)', borderRadius: 12, fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center', fontFamily: 'var(--font-mono)', letterSpacing: 0.5 }}>
          STANDBY — AWAITING INCIDENT VECTORS
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sopSteps.map((step, i) => (
            <div key={i} className="sop-item" style={{ 
              display: 'flex', gap: 16, 
              background: 'rgba(255,255,255,0.02)', 
              padding: '16px', borderRadius: 12, 
              border: '1px solid rgba(255,255,255,0.03)',
              transition: 'all 0.3s'
            }}>
              <div style={{ 
                width: 24, height: 24, borderRadius: '50%', 
                background: 'rgba(139, 92, 246, 0.1)', 
                border: '1px solid rgba(139, 92, 246, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 900, color: '#8b5cf6', flexShrink: 0, marginTop: 2
              }}>
                {i + 1}
              </div>
              <div style={{ 
                fontSize: 12, color: 'rgba(255,255,255,0.85)', 
                lineHeight: 1.6, fontWeight: 500, flex: 1 
              }}>
                {step}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div style={{ 
        marginTop: 4, padding: '8px 12px', 
        background: 'rgba(139, 92, 246, 0.03)', 
        borderRadius: 8, border: '1px solid rgba(139, 92, 246, 0.08)',
        fontSize: 8, color: 'rgba(139, 92, 246, 0.5)',
        textAlign: 'center', fontFamily: 'var(--font-mono)', letterSpacing: 1, fontWeight: 600
      }}>
        AEGIS-COGNITIVE V4.2 — PROTOCOL SECURED
      </div>
    </div>
  );
}
