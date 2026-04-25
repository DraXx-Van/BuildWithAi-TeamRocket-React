import { useState } from 'react';
import { Radio, Send } from 'lucide-react';
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

const SOURCES = ['VOICE RECON', 'SENSOR MESH', 'NEURAL LINK', 'OPERATOR OVERRIDE'];

export default function SignalIntel({ incident }) {
  const { appendLogToIncident } = useIncidentStore();
  const [chatInput, setChatInput] = useState('');
  const logs = incident.evidenceLogs ?? [];

  const handleSend = (e) => {
    if (e && e.type === 'keydown' && e.key !== 'Enter') return;
    if (!chatInput.trim()) return;
    appendLogToIncident(incident.id, `Command: ${chatInput.trim()}`);
    setChatInput('');
  };
  
  return (
    <div className="card flex-col gap-20" style={{ background: 'rgba(15,15,20,0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
      <div className="step-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="step-num" style={{ background: 'var(--color-primary)', animation: 'pulse 2s infinite' }}><Radio size={14} color="white" /></span>
          <span style={{ letterSpacing: 3, fontWeight: 800 }}>SIGNAL INTELLIGENCE</span>
        </div>
        <div style={{ fontSize: 8, color: 'var(--color-text-mid)', fontFamily: 'var(--font-mono)' }}>ENCRYPTED CHANNEL 7-A</div>
      </div>

      {logs.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(255,255,255,0.1)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: 1 }}>
          SEARCHING FOR SIGNALS...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {logs.map((log, i) => {
            const source = SOURCES[i % SOURCES.length];
            const cleanedText = cleanSignal(log);
            
            return (
              <div key={i} className="signal-entry" style={{ 
                display: 'flex', gap: 16, 
                background: 'rgba(255,255,255,0.02)', 
                padding: '12px 16px', borderRadius: 12, 
                border: '1px solid rgba(255,255,255,0.03)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Source Indicator */}
                <div style={{ 
                  width: 3, height: '70%', background: i === 0 ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)', 
                  position: 'absolute', left: 0, top: '15%', borderRadius: '0 4px 4px 0' 
                }} />

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--color-primary)', fontWeight: 800, letterSpacing: 1.5 }}>
                      {source} — SIG #{i + 1}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>
                      DECRYPTED AT 14:24:{45 + i}
                    </div>
                  </div>
                  <div style={{ 
                    fontSize: 13, color: 'white', lineHeight: 1.5, 
                    fontFamily: 'var(--font-mono)', letterSpacing: -0.2,
                    fontWeight: 500
                  }}>
                    <span style={{ opacity: 0.3, marginRight: 8 }}>&gt;</span>
                    {cleanedText}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Chat Input for Command */}
      <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={handleSend}
          placeholder="Transmit order to field units..."
          style={{
            flex: 1, padding: '12px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
            color: 'white', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!chatInput.trim()}
          style={{
            padding: '0 20px', borderRadius: 12, border: 'none',
            background: chatInput.trim() ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
            color: 'white', cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <Send size={16} />
        </button>
      </div>

      {/* Footer Visuals */}
      <div style={{ display: 'flex', gap: 4, height: 2, marginTop: 4 }}>
        {[...Array(20)].map((_, i) => (
          <div key={i} style={{ flex: 1, background: `rgba(139, 92, 246, ${Math.random() * 0.3})` }} />
        ))}
      </div>
    </div>
  );
}
