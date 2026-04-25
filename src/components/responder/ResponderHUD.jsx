import { useState, useEffect, useRef } from 'react';
import { streamDispatchForStaff, streamLiveIncidents } from '../../services/firebaseService';
import useIncidentStore from '../../store/useIncidentStore';

export default function ResponderHUD() {
  const [activeDispatch, setActiveDispatch] = useState(null);
  const [currentIncident, setCurrentIncident] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  
  const processIncidentData = useIncidentStore(s => s.processIncidentData);
  const liveIncidents = useIncidentStore(s => s.liveIncidents);
  const isProcessing = useIncidentStore(s => s.isProcessing);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  
  // Hardcoded for demo, similar to Flutter
  const myName = 'Amit Sharma';

  useEffect(() => {
    const unsubscribe = streamDispatchForStaff(myName, (data) => {
      setActiveDispatch(data);
    });

    // Auto-sync incident details when dispatched
    if (activeDispatch) {
      const inc = liveIncidents.find(i => i.id === activeDispatch.incidentId);
      setCurrentIncident(inc);
    } else {
      setCurrentIncident(null);
    }

    // Scroll to bottom of signals
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }

    // Setup speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
        }
        setTranscript(fullTranscript);
      };
      recognitionRef.current = recognition;
    }

    return () => unsubscribe();
  }, [myName, activeDispatch, liveIncidents]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.replace('data:', '').replace(/^.+,/, '');
        setCapturedImage(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const startListening = () => {
    setTranscript('');
    setIsListening(true);
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch (e) {}
    }
  };

  const stopListening = () => {
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (transcript.trim() || capturedImage) {
      processIncidentData(transcript || 'Emergency reported via HUD', capturedImage);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#09090b', color: '#fafafa' }}>
      
      {/* ── HEADER ── */}
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#09090b', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 12px #10b981', animation: 'blink 1.5s infinite' }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#10b981', letterSpacing: 2 }}>MISSION ACTIVE</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'white' }}>{myName}</div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#a1a1aa', letterSpacing: 1 }}>TACTICAL RESPONDER</div>
        </div>
        <div style={{ width: 60 }} /> {/* balance */}
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* ── MISSION INTELLIGENCE PLANE ── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#09090b' }}>
          
          {/* Mission Stats Bar */}
          {currentIncident && (
            <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid #27272a', display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#a1a1aa', marginBottom: 4 }}>OBJECTIVE</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{currentIncident.type.toUpperCase()}</div>
              </div>
              <div style={{ width: 1, background: '#27272a' }} />
              <div>
                <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#a1a1aa', marginBottom: 4 }}>LOCATION</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{currentIncident.location}</div>
              </div>
            </div>
          )}

          {/* Signal Stream (Chat Area) */}
          <div 
            ref={scrollRef}
            style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {!currentIncident ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                <div style={{ fontSize: 48, marginBottom: 20 }}>🛡️</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: 3, color: '#a1a1aa' }}>AWAITING DISPATCH</div>
                <div style={{ fontSize: 11, marginTop: 8 }}>Secure channel active. Standby.</div>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', margin: '10px 0' }}>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', background: '#27272a', padding: '4px 12px', borderRadius: 20, color: '#a1a1aa' }}>
                    MISSION STARTED — {new Date(currentIncident.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {currentIncident.evidenceLogs.map((log, idx) => (
                  <div key={idx} style={{ 
                    alignSelf: log.startsWith('Responder:') || log.includes(myName) ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}>
                    <div style={{ 
                      fontSize: 8, 
                      fontFamily: 'var(--font-mono)', 
                      color: '#a1a1aa',
                      textAlign: log.startsWith('Responder:') || log.includes(myName) ? 'right' : 'left',
                      padding: '0 8px'
                    }}>
                      {log.startsWith('Responder:') || log.includes(myName) ? 'YOU' : 'COMMAND'}
                    </div>
                    <div style={{ 
                      background: log.startsWith('Responder:') || log.includes(myName) ? '#8b5cf6' : '#27272a',
                      color: 'white',
                      padding: '12px 16px',
                      borderRadius: log.startsWith('Responder:') || log.includes(myName) ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                      fontSize: 13,
                      lineHeight: 1.5,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                      {log.replace('Responder:', '').replace(myName + ':', '')}
                    </div>
                  </div>
                ))}

                {isProcessing && (
                  <div style={{ alignSelf: 'flex-start', background: '#27272a', padding: '12px 16px', borderRadius: '16px 16px 16px 2px', display: 'flex', gap: 6 }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#a1a1aa', animation: 'blink 1s infinite 0.1s' }} />
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#a1a1aa', animation: 'blink 1s infinite 0.2s' }} />
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#a1a1aa', animation: 'blink 1s infinite 0.3s' }} />
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* ── TACTICAL PTT CONTROL ── */}
      <footer style={{ padding: '24px', background: '#09090b', borderTop: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Live Transcript Preview */}
        {isListening && (
          <div style={{ background: 'rgba(139,92,246,0.1)', padding: '12px 20px', borderRadius: 12, border: '1px solid rgba(139,92,246,0.3)', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'blink 1s infinite' }} />
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#8b5cf6', letterSpacing: 1 }}>LIVE TRANSCRIPT</div>
            </div>
            <div style={{ fontSize: 13, color: 'white', fontStyle: 'italic' }}>
              {transcript || 'Speaking...'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32 }}>
          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
          
          <button 
            onClick={() => fileInputRef.current?.click()} 
            style={{ 
              width: 54, height: 54, borderRadius: '50%', background: '#18181b', border: '1px solid #27272a', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' 
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
          </button>

          <button 
            onPointerDown={startListening}
            onPointerUp={stopListening}
            onPointerLeave={() => isListening && stopListening()}
            style={{ 
              width: 84, height: 84, borderRadius: '50%', 
              background: isListening ? 'rgba(239,68,68,0.2)' : '#18181b', 
              border: `2px solid ${isListening ? '#ef4444' : '#8b5cf6'}`, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', 
              transition: 'all 0.2s', 
              boxShadow: isListening ? '0 0 40px rgba(239,68,68,0.4)' : '0 0 20px rgba(139,92,246,0.1)',
              transform: isListening ? 'scale(0.92)' : 'scale(1)'
            }}
          >
            <div style={{ 
              width: 64, height: 64, borderRadius: '50%', 
              background: isListening ? '#ef4444' : '#8b5cf6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isListening ? 'none' : 'inset 0 0 20px rgba(255,255,255,0.2)'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </div>
          </button>

          <button 
            style={{ 
              width: 54, height: 54, borderRadius: '50%', background: '#18181b', border: '1px solid #27272a', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
              opacity: currentIncident ? 1 : 0.3, pointerEvents: currentIncident ? 'auto' : 'none'
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </button>
        </div>
      </footer>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
