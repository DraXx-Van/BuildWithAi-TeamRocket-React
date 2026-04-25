import { useEffect } from 'react';
import { fullTimestamp, severityColor } from '../../models/incident';
import CaseSummary from './CaseSummary';
import SignalIntel from './SignalIntel';
import SopList from './SopList';
import DispatchSection from './DispatchSection';
import useIncidentStore from '../../store/useIncidentStore';

export default function IncidentProcessView({ incident }) {
  const color = severityColor(incident.severity);
  const { regenerateIntelligence, isProcessing } = useIncidentStore();

  // Auto-recover intelligence if missing and active
  useEffect(() => {
    const hasSops = incident.sops?.length > 0;
    const hasDispatch = !!incident.dispatchSuggestion || !!incident.assignedTo;
    
    if (!isProcessing && (!hasSops || !hasDispatch) && incident.status === 'active') {
      console.log('[INTELLIGENCE] Auto-recovering missing vectors for', incident.id);
      regenerateIntelligence(incident);
    }
  }, [incident.id, incident.status, isProcessing]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-bg)' }}>
      {/* Premium Header Bar */}
      <div style={{
        padding: '24px 32px',
        background: 'rgba(20, 20, 25, 0.8)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0,
        zIndex: 10
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, animation: 'pulse 1.5s infinite' }} />
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, fontWeight: 700 }}>
              INCIDENT COMMAND CENTER
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'white', letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 12 }}>
            {incident.type.toUpperCase()}
            <span style={{ opacity: 0.2, fontWeight: 300 }}>/</span>
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{incident.location.toUpperCase()}</span>
          </div>
        </div>

        {/* Tactical Stepper Integration */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 40px' }}>
          <TacticalStepper incident={incident} isProcessing={isProcessing} />
        </div>

        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: 2, marginBottom: 4, fontWeight: 700 }}>SYSTEM TIME</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'white', fontWeight: 600 }}>{fullTimestamp(incident.timestamp)}</div>
          </div>
          
          {/* High-fidelity Severity Badge */}
          <div style={{ 
            padding: '8px 18px', 
            background: `linear-gradient(135deg, ${color}20 0%, ${color}10 100%)`, 
            border: `1px solid ${color}40`, 
            borderRadius: 12, 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: 80,
            boxShadow: `0 0 20px ${color}10`
          }}>
            <div style={{ fontSize: 8, fontWeight: 900, color: color, letterSpacing: 1, marginBottom: 2 }}>SEVERITY</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: color }}>LVL {incident.severity}</div>
          </div>
        </div>
      </div>

      {/* Main Tactical Grid */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT — Intelligence Plane (Observational Data) */}
        <div style={{ 
          flex: '0 0 68%', 
          maxWidth: '68%', 
          overflowY: 'auto', 
          padding: '32px 24px 40px 32px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 24,
          borderRight: '1px solid rgba(255,255,255,0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 12, height: 1, background: 'var(--color-primary)' }} />
            <SectionTitle icon="🔍" label="INTELLIGENCE PLANE" />
          </div>
          <CaseSummary incident={incident} />
          <SignalIntel incident={incident} />
        </div>

        {/* RIGHT — Execution Plane (Actionable Controls) */}
        <div style={{ 
          flex: '0 0 32%', 
          maxWidth: '32%', 
          overflowY: 'auto', 
          padding: '32px 32px 40px 20px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 24,
          background: 'rgba(255,255,255,0.01)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 12, height: 1, background: '#8b5cf6' }} />
            <SectionTitle icon="⚡" label="EXECUTION PLANE" />
          </div>
          <SopList incident={incident} />
          <DispatchSection incident={incident} />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ 
        fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, 
        color: 'rgba(255,255,255,0.4)', letterSpacing: 2.5 
      }}>{label}</span>
    </div>
  );
}

function TacticalStepper({ incident, isProcessing }) {
  const hasSops = (incident.sops?.length > 0) || (isProcessing && !incident.sops?.length);
  const hasDispatch = !!incident.dispatchSuggestion || !!incident.assignedTo;
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%', maxWidth: 400 }}>
      <Step icon="✓" label="ANALYZE" active={true} complete={true} />
      <Connector active={hasSops} />
      <Step icon={isProcessing && !incident.sops?.length ? "●" : "✓"} label="PROTOCOL" active={isProcessing} complete={incident.sops?.length > 0} />
      <Connector active={hasDispatch} />
      <Step icon={isProcessing && incident.sops?.length && !hasDispatch ? "●" : "✓"} label="DISPATCH" active={isProcessing && incident.sops?.length > 0} complete={hasDispatch} />
    </div>
  );
}

function Step({ icon, label, active, complete }) {
  const color = complete ? '#10b981' : active ? '#8b5cf6' : 'rgba(255,255,255,0.1)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative' }}>
      <div style={{ 
        width: 28, height: 28, borderRadius: '50%', 
        background: complete ? '#10b981' : 'transparent',
        border: `2px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, color: complete ? 'white' : color,
        fontWeight: 900,
        boxShadow: active ? `0 0 15px ${color}40` : 'none',
        animation: active && !complete ? 'pulse 1.5s infinite' : 'none'
      }}>
        {icon}
      </div>
      <div style={{ 
        fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 800, 
        color: complete ? 'white' : active ? 'white' : 'rgba(255,255,255,0.2)',
        letterSpacing: 1.5
      }}>{label}</div>
    </div>
  );
}

function Connector({ active }) {
  return (
    <div style={{ 
      flex: 1, height: 2, background: active ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.05)',
      margin: '0 -4px 18px -4px', zIndex: 0 
    }}>
      {active && <div style={{ height: '100%', width: '100%', background: 'var(--color-primary)', animation: 'shimmer 2s infinite' }} />}
    </div>
  );
}
