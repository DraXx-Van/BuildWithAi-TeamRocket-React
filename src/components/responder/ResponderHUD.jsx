import { useState, useEffect, useRef } from 'react';
import { streamDispatchForStaff } from '../../services/firebaseService';
import useIncidentStore from '../../store/useIncidentStore';

export default function ResponderHUD() {
  const [dispatchAlert, setDispatchAlert] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  
  const processIncidentData = useIncidentStore(s => s.processIncidentData);
  const isProcessing = useIncidentStore(s => s.isProcessing);
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Hardcoded for demo, similar to Flutter
  const myName = 'Amit Sharma';

  useEffect(() => {
    const unsubscribe = streamDispatchForStaff(myName, (data) => {
      setDispatchAlert(data);
    });

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
  }, [myName]);

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
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', boxShadow: '0 0 10px var(--color-success)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--color-success)', letterSpacing: 1.5 }}>ONLINE</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-text-hi)' }}>{myName}</div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 20, justifyContent: 'center' }}>
        {dispatchAlert ? (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-error)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, animation: 'pulse 2s infinite' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>🚨</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--color-error)', letterSpacing: -0.5 }}>DISPATCH ALERT</span>
            </div>
            
            <div style={{ fontSize: 14, color: 'var(--color-text-hi)', lineHeight: 1.6 }}>
              You have been dispatched to incident:<br/>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-mid)' }}>{dispatchAlert.incidentId}</strong>
            </div>

            <button style={{ padding: '14px', background: 'var(--color-error)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: 14, cursor: 'pointer', letterSpacing: 1, marginTop: 10, boxShadow: '0 4px 14px rgba(239,68,68,0.3)' }}>
              ACKNOWLEDGE
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--color-surface-1)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🛡️</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-mid)', letterSpacing: 2 }}>STANDBY</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-mid)', marginTop: 8 }}>Awaiting dispatch...</div>
          </div>
        )}

        {/* PTT Status / Output */}
        {(isListening || isProcessing || transcript || capturedImage) && !dispatchAlert && (
          <div style={{ background: 'rgba(39,39,42,0.8)', padding: 16, borderRadius: 12, border: '1px solid var(--color-primary)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-primary)', marginBottom: 8, letterSpacing: 1 }}>
              {isListening ? '🎙️ LISTENING...' : isProcessing ? '⚙️ ANALYZING SCENE...' : '✅ READY TO SEND'}
            </div>
            {capturedImage && (
              <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📸</span> Image attached
                <button onClick={() => setCapturedImage(null)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: 10, padding: 2 }}>✕</button>
              </div>
            )}
            {transcript && <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--color-text-mid)' }}>"{transcript}"</div>}
          </div>
        )}
      </div>

      {/* Footer / PTT simulation */}
      <div style={{ padding: '20px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 24 }}>
        
        <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
        
        <button onClick={() => fileInputRef.current?.click()} style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-mid)' }}>
          📷
        </button>

        <button 
          onPointerDown={startListening}
          onPointerUp={stopListening}
          onPointerLeave={() => isListening && stopListening()}
          style={{ 
            width: 80, height: 80, borderRadius: '50%', 
            background: isListening ? 'rgba(239,68,68,0.2)' : 'var(--color-surface-2)', 
            border: `2px solid ${isListening ? 'var(--color-error)' : 'var(--color-primary)'}`, 
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', 
            transition: 'all 0.1s', 
            boxShadow: isListening ? '0 0 30px rgba(239,68,68,0.4)' : '0 0 20px rgba(139,92,246,0.2)',
            transform: isListening ? 'scale(0.95)' : 'scale(1)'
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={isListening ? 'var(--color-error)' : 'var(--color-primary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>

        <div style={{ width: 48 }} /> {/* Spacer to balance the layout */}
      </div>
    </div>
  );
}
