import { useState } from 'react';
import { Send, CheckCircle2, AlertCircle, ShieldAlert, Radio, Check } from 'lucide-react';
import useIncidentStore from '../../store/useIncidentStore';

const CLEAN_PATTERNS = [
  /hellothere/gi,
  /smith mendes/gi,
  /we need immediate help/gi,
  /\b(regards|best|thanks)\b.*$/gi
];

function cleanSignal(text) {
  let cleaned = text;
  CLEAN_PATTERNS.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  return cleaned.trim() || text;
}

export default function SignalIntel({ incident }) {
  const { appendLogToIncident } = useIncidentStore();
  const [chatInput, setChatInput] = useState('');
  
  const logs = incident.evidenceLogs ?? [];
  const reportedLog = logs[0] ? cleanSignal(logs[0]) : 'Initial report received.';
  const fieldLogs = logs.slice(1);

  const handleSend = (e) => {
    if (e && e.type === 'keydown' && e.key !== 'Enter') return;
    if (!chatInput.trim()) return;
    appendLogToIncident(incident.id, `Command: ${chatInput.trim()}`);
    setChatInput('');
  };

  // Build Timeline Steps
  const steps = [];

  // 1. Reported
  steps.push({
    id: 'reported',
    title: 'Incident Reported',
    time: new Date(incident.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    description: reportedLog,
    icon: <AlertCircle size={16} />,
    status: 'completed',
    color: '#ef4444' // red
  });

  // 2. Protocol & Analysis
  if (incident.sops && incident.sops.length > 0) {
    steps.push({
      id: 'analyzed',
      title: 'AI Protocol Secured',
      time: '',
      description: `Threat level assessed at ${incident.severity}/10. Action plan generated.`,
      icon: <CheckCircle2 size={16} />,
      status: 'completed',
      color: '#10b981' // green
    });
  }

  // 3. Dispatch
  if (incident.assignedTo) {
    steps.push({
      id: 'dispatched',
      title: 'Responder Dispatched',
      time: '',
      description: `${incident.assignedTo} has been deployed to the target zone.`,
      icon: <ShieldAlert size={16} />,
      status: 'completed',
      color: '#3b82f6' // blue
    });
  }

  // 4. Field Communications
  if (fieldLogs.length > 0 || !incident.status || incident.status !== 'resolved') {
    steps.push({
      id: 'communications',
      title: 'Field Communications',
      time: '',
      description: fieldLogs.length > 0 ? `${fieldLogs.length} updates recorded.` : 'Awaiting field updates.',
      icon: <Radio size={16} />,
      status: incident.status === 'resolved' ? 'completed' : 'active',
      color: '#8b5cf6', // purple
      logs: fieldLogs
    });
  }

  // 5. Resolution
  if (incident.status === 'resolved') {
    steps.push({
      id: 'resolved',
      title: 'Incident Resolved',
      time: '',
      description: 'The incident has been closed and area secured.',
      icon: <Check size={16} />,
      status: 'completed',
      color: '#10b981' // green
    });
  } else {
    steps.push({
      id: 'resolved_pending',
      title: 'Resolution Pending',
      time: '',
      description: 'Awaiting field unit clearance.',
      icon: <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a1a1aa' }} />,
      status: 'pending',
      color: '#3f3f46' // gray
    });
  }

  return (
    <div className="card flex-col gap-20" style={{ background: 'rgba(15,15,20,0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
      <div className="step-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="step-num" style={{ background: 'var(--color-primary)' }}><Radio size={14} color="white" /></span>
          <span style={{ letterSpacing: 3, fontWeight: 800 }}>INCIDENT TIMELINE</span>
        </div>
        <div style={{ fontSize: 8, color: 'var(--color-text-mid)', fontFamily: 'var(--font-mono)' }}>LIVE EVENT TRACKER</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 0 10px 10px' }}>
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isActive = step.status === 'active';
          const isPending = step.status === 'pending';

          return (
            <div key={step.id} style={{ display: 'flex', position: 'relative', opacity: isPending ? 0.5 : 1 }}>
              
              {/* Left Column: Icon & Line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 30, flexShrink: 0 }}>
                <div style={{ 
                  width: 24, height: 24, borderRadius: '50%', background: step.color, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                  boxShadow: isActive ? `0 0 12px ${step.color}` : 'none',
                  zIndex: 2
                }}>
                  {step.icon}
                </div>
                {!isLast && (
                  <div style={{ 
                    width: 2, flex: 1, minHeight: 40,
                    background: isPending ? '#27272a' : (isActive ? `linear-gradient(${step.color}, #3f3f46)` : step.color),
                    opacity: 0.5, marginTop: 4, marginBottom: 4
                  }} />
                )}
              </div>

              {/* Right Column: Content */}
              <div style={{ paddingBottom: isLast ? 0 : 24, paddingLeft: 16, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: 0.5 }}>{step.title}</div>
                  {step.time && <div style={{ fontSize: 10, color: '#a1a1aa', fontFamily: 'var(--font-mono)' }}>{step.time}</div>}
                </div>
                <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4, lineHeight: 1.4 }}>
                  {step.description}
                </div>

                {/* Sub-content: Field Logs */}
                {step.logs && step.logs.length > 0 && (
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {step.logs.map((log, i) => {
                      const isMe = log.startsWith('Command:');
                      const cleanTxt = cleanSignal(log.replace('Command:', '').replace('Responder:', ''));
                      return (
                        <div key={i} style={{ 
                          background: isMe ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.03)', 
                          borderLeft: `2px solid ${isMe ? '#8b5cf6' : '#52525b'}`,
                          padding: '8px 12px', borderRadius: '0 8px 8px 0',
                          fontSize: 11, color: 'white', fontFamily: 'var(--font-mono)'
                        }}>
                          <span style={{ color: isMe ? '#a78bfa' : '#a1a1aa', marginRight: 8, fontSize: 9 }}>{isMe ? 'CMD' : 'FLD'}</span>
                          {cleanTxt}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Sub-content: Chat Input (only in active communications) */}
                {isActive && step.id === 'communications' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={handleSend}
                      placeholder="Transmit order..."
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                        color: 'white', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none'
                      }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!chatInput.trim()}
                      style={{
                        padding: '0 16px', borderRadius: 8, border: 'none',
                        background: chatInput.trim() ? '#8b5cf6' : 'rgba(255,255,255,0.05)',
                        color: 'white', cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      <Send size={14} />
                    </button>
                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
