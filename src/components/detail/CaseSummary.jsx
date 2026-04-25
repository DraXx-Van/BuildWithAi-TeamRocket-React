import { fullTimestamp, severityColor } from '../../models/incident';
import StatusBadge from '../incidents/StatusBadge';

export default function CaseSummary({ incident }) {
  const color = severityColor(incident.severity);
  
  return (
    <div className="card flex-col gap-24" style={{ 
      background: 'linear-gradient(135deg, rgba(20,20,25,0.7) 0%, rgba(10,10,15,0.8) 100%)',
      border: '1px solid rgba(255,255,255,0.05)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
    }}>
      {/* Header with Case ID */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="step-label">
          <span className="step-num" style={{ background: color }}>◉</span>
          CASE BRIEFING
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: 1 }}>
          REF: {incident.id.slice(0, 8).toUpperCase()}
        </div>
      </div>

      {/* Description Overhaul */}
      <div style={{ 
        padding: '20px 24px', 
        background: 'rgba(255,255,255,0.02)', 
        borderRadius: 16, 
        border: '1px solid rgba(255,255,255,0.03)',
        lineHeight: 1.8,
        position: 'relative'
      }}>
        <div style={{ position: 'absolute', top: 12, left: 12, width: 2, height: 12, background: color }} />
        <p style={{ 
          fontFamily: 'var(--font-body)', fontSize: 15, color: 'rgba(255,255,255,0.9)', 
          margin: 0, fontWeight: 400, letterSpacing: 0.2
        }}>
          {incident.description}
        </p>
      </div>

      {/* Structured Meta Grid */}
      <div style={{ 
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, 
        paddingTop: 8
      }}>
        <GlassMetric label="TARGET ZONE" value={incident.location} />
        <GlassMetric label="THREAT LEVEL" value={`${incident.severity}/10`} color={color} />
        <GlassMetric label="MISSION STATUS" value={<StatusBadge status={incident.status} />} />
        <GlassMetric label="ORCHESTRATION" value={fullTimestamp(incident.timestamp)} mono />
        <GlassMetric label="INTEL DEPTH" value={`${incident.signalCount} Signals Merged`} />
        {incident.assignedTo && <GlassMetric label="ASSIGNED UNIT" value={incident.assignedTo} color="var(--color-success)" />}
      </div>

      {/* Required skills */}
      {incident.requiredSkills?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, marginBottom: 12 }}>CRITICAL SKILLS REQUIRED</div>
          <div className="flex flex-wrap gap-8" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {incident.requiredSkills.map((s, i) => (
              <div key={i} style={{ 
                padding: '6px 14px', 
                background: 'rgba(139, 92, 246, 0.08)', 
                border: '1px solid rgba(139, 92, 246, 0.2)', 
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-primary)',
                letterSpacing: 0.5,
                textTransform: 'uppercase'
              }}>
                {s}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GlassMetric({ label, value, color, mono }) {
  return (
    <div style={{ 
      background: 'rgba(255,255,255,0.01)', 
      padding: '12px 14px', 
      borderRadius: 12, 
      border: '1px solid rgba(255,255,255,0.02)' 
    }}>
      <div style={{ 
        fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.25)', 
        letterSpacing: 1.5, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' 
      }}>
        {label}
      </div>
      <div style={{ 
        fontSize: 12, 
        color: color ?? 'white', 
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)', 
        fontWeight: 700,
        letterSpacing: mono ? 0 : 0.2
      }}>
        {value}
      </div>
    </div>
  );
}
