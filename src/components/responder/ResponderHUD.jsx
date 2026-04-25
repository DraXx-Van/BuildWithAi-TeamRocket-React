import { useState, useEffect, useRef } from 'react';
import { streamDispatchForStaff, updateIncidentStatus } from '../../services/firebaseService';
import { sanitizeText, stripImageMetadata } from '../../services/dlpService';
import useIncidentStore from '../../store/useIncidentStore';
import useAuthStore from '../../store/useAuthStore';

export default function ResponderHUD() {
  const [dispatchAlert, setDispatchAlert] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [acknowledged, setAcknowledged] = useState(false);
  const [dispatchState, setDispatchState] = useState(null);

  const processIncidentData = useIncidentStore(s => s.processIncidentData);
  const isProcessing = useIncidentStore(s => s.isProcessing);
  const processingError = useIncidentStore(s => s.processingError);
  const liveIncidents = useIncidentStore(s => s.liveIncidents);
  const { profile, logout } = useAuthStore();

  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);

  const myName = profile?.displayName || 'Field Agent';
  const myId = profile?.uid;

  // Monitor connectivity
  useEffect(() => {
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Stream dispatch alerts
  useEffect(() => {
    const unsubscribe = streamDispatchForStaff(myName, (data) => {
      setDispatchAlert(data);
      if (!data) {
        setAcknowledged(false);
        setDispatchState(null);
      }
    });
    return () => unsubscribe();
  }, [myName]);

  // Setup speech recognition — ROBUST implementation
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[SPEECH] Speech Recognition API not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    // Accumulate final results properly
    let finalTranscript = '';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setTranscript((finalTranscript + interimTranscript).trim());
    };

    recognition.onerror = (event) => {
      console.warn('[SPEECH] Error:', event.error);
      // Don't stop on 'no-speech' — user just hasn't spoken yet
      if (event.error === 'no-speech') return;
      // Abort means another recognition started — ignore
      if (event.error === 'aborted') return;
      // For 'not-allowed' — permission denied
      if (event.error === 'not-allowed') {
        console.error('[SPEECH] Microphone permission denied');
        setIsListening(false);
        return;
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      // Auto-restart if still in listening mode (browser stops after silence)
      if (recognitionRef.current?._shouldBeListening) {
        try {
          recognition.start();
          console.log('[SPEECH] Auto-restarted after silence timeout');
        } catch (e) {
          console.warn('[SPEECH] Could not auto-restart:', e.message);
          setIsListening(false);
          recognitionRef.current._shouldBeListening = false;
        }
      }
    };

    recognition._shouldBeListening = false;
    recognition._resetFinalTranscript = () => { finalTranscript = ''; };
    recognitionRef.current = recognition;

    return () => {
      recognition._shouldBeListening = false;
      try { recognition.stop(); } catch { /* noop */ }
    };
  }, []);

  // Toggle-based start (tap to start, tap to stop)
  const toggleListening = async () => {
    if (isListening) {
      stopListening();
      return;
    }

    // Request microphone permission explicitly first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission granted — release the stream immediately (SpeechRecognition handles its own)
      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      console.error('[SPEECH] Microphone permission denied:', err);
      alert('Microphone access is required for voice input. Please allow microphone access in your browser settings.');
      return;
    }

    startListening();
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      console.warn('[SPEECH] SpeechRecognition not available');
      return;
    }
    setTranscript('');
    recognitionRef.current._resetFinalTranscript();
    recognitionRef.current._shouldBeListening = true;
    setIsListening(true);
    try {
      recognitionRef.current.start();
      console.log('[SPEECH] Started listening');
    } catch (e) {
      // Already started — ignore
      console.warn('[SPEECH] Start error (may already be running):', e.message);
    }
  };

  const stopListening = () => {
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current._shouldBeListening = false;
      try {
        recognitionRef.current.stop();
        console.log('[SPEECH] Stopped listening');
      } catch { /* noop */ }
    }
  };

  const handleImageCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const raw = reader.result.replace('data:', '').replace(/^.+,/, '');
      setCapturedPreview(reader.result);
      // Strip EXIF metadata for privacy
      const clean = await stripImageMetadata(raw);
      setCapturedImage(clean);
    };
    reader.readAsDataURL(file);
  };

  const submitReport = async () => {
    if (!transcript.trim() && !capturedImage) return;

    const { sanitized } = sanitizeText(transcript || 'Emergency reported via Staff HUD');
    await processIncidentData(sanitized, capturedImage);

    // Reset after submission
    setTranscript('');
    setCapturedImage(null);
    setCapturedPreview(null);
  };

  const handleAcknowledge = () => {
    setAcknowledged(true);
    setDispatchState('acknowledged');
    console.log('[STAFF] Acknowledged dispatch:', dispatchAlert?.incidentId);
  };

  const handleEnRoute = async () => {
    setDispatchState('en_route');
    await updateIncidentStatus(dispatchAlert?.incidentId, 'en_route');
  };

  const handleReached = async () => {
    setDispatchState('reached');
    await updateIncidentStatus(dispatchAlert?.incidentId, 'reached');
  };

  const handleSelfAssign = async (incidentId, location, description) => {
    const { assignStaffToIncident } = await import('../../services/firebaseService');
    await assignStaffToIncident(incidentId, { id: myId, name: myName, photoUrl: profile?.photoURL }, location, description);
  };

  const mySkills = profile?.skills || [];
  const myFloor = profile?.floor ?? '—';
  const myShift = profile?.shift || 'Not Assigned';
  const myDept = profile?.department || 'Operations';
  const myBadge = profile?.badgeNumber || myId?.substring(0, 8) || '---';
  const activeCount = liveIncidents.filter(i => i.status === 'active').length;
  const myAssigned = liveIncidents.filter(i => i.assignedTo === myName);

  return (
    <div className="staff-screen">
      {/* ── Identity Card Header ───────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, var(--color-surface-1) 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, var(--color-primary), #6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', border: '2px solid rgba(255,255,255,0.15)' }}>
                {myName.charAt(0)}
              </div>
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%', background: isOnline ? '#10b981' : '#ef4444', border: '2.5px solid var(--color-surface-1)' }} />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: 0.3 }}>{myName}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-mid)', marginTop: 2 }}>{myDept}</div>
            </div>
          </div>
          <button style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, color: '#fca5a5', fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5 }} onClick={logout}>
            SIGN OUT
          </button>
        </div>

        {/* Identity details row */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 20px', overflowX: 'auto' }}>
          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(139,92,246,0.12)', color: 'var(--color-primary)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', border: '1px solid rgba(139,92,246,0.2)' }}>
            🪪 {myBadge}
          </span>
          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', border: '1px solid rgba(16,185,129,0.2)' }}>
            📍 Floor {myFloor}
          </span>
          <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: '#fbbf24', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap', border: '1px solid rgba(245,158,11,0.2)' }}>
            🕐 {myShift}
          </span>
        </div>

        {/* Skills bar */}
        {mySkills.length > 0 && (
          <div style={{ display: 'flex', gap: 6, padding: '0 20px 14px', flexWrap: 'wrap' }}>
            {mySkills.map(s => (
              <span key={s} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', color: 'var(--color-text-mid)', fontWeight: 600, border: '1px solid rgba(255,255,255,0.08)' }}>
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Status strip */}
        <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: activeCount > 0 ? '#f59e0b' : '#10b981' }}>{activeCount}</div>
            <div style={{ fontSize: 9, color: 'var(--color-text-low)', fontWeight: 600, letterSpacing: 1, marginTop: 2 }}>ACTIVE</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: myAssigned.length > 0 ? 'var(--color-primary)' : 'var(--color-text-mid)' }}>{myAssigned.length}</div>
            <div style={{ fontSize: 9, color: 'var(--color-text-low)', fontWeight: 600, letterSpacing: 1, marginTop: 2 }}>MY TASKS</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: isOnline ? '#10b981' : '#ef4444' }}>{isOnline ? 'ON' : 'OFF'}</div>
            <div style={{ fontSize: 9, color: 'var(--color-text-low)', fontWeight: 600, letterSpacing: 1, marginTop: 2 }}>STATUS</div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="staff-body">
        {/* Dispatch Alert */}
        {dispatchAlert && !acknowledged ? (
          <div className="staff-dispatch-alert">
            <div className="staff-dispatch-header">
              <span className="staff-dispatch-icon">🚨</span>
              <span className="staff-dispatch-title">DISPATCH ALERT</span>
            </div>
            <p className="staff-dispatch-detail">
              You have been dispatched to:<br/>
              <strong>{dispatchAlert.incidentId || 'Active Incident'}</strong>
            </p>
            {dispatchAlert.location && (
              <p className="staff-dispatch-loc">📍 {dispatchAlert.location}</p>
            )}
            <button className="staff-dispatch-ack" onClick={handleAcknowledge}>
              ✓ ACKNOWLEDGE
            </button>
          </div>
        ) : dispatchAlert && acknowledged && dispatchState !== 'reached' ? (
          <div className="staff-dispatch-ack-state">
            <span className="staff-dispatch-ack-icon">✅</span>
            <span className="staff-dispatch-ack-text">DISPATCH ACKNOWLEDGED</span>
            <span className="staff-dispatch-ack-sub">Navigate to incident location</span>
            
            <div className="staff-dispatch-actions" style={{ marginTop: 24, display: 'flex', gap: 12 }}>
               <button className="staff-dispatch-enroute" style={{ flex: 1, padding: 12, borderRadius: 8, background: dispatchState === 'en_route' ? 'var(--color-surface-2)' : 'var(--color-primary)', border: 'none', color: '#fff', fontWeight: 600 }} onClick={handleEnRoute}>
                 🚗 EN ROUTE
               </button>
               <button className="staff-dispatch-reached" style={{ flex: 1, padding: 12, borderRadius: 8, background: 'var(--color-success)', border: 'none', color: '#fff', fontWeight: 600 }} onClick={handleReached} disabled={dispatchState !== 'en_route'}>
                 📍 I HAVE REACHED
               </button>
            </div>
          </div>
        ) : dispatchAlert && dispatchState === 'reached' ? (
          <div className="staff-dispatch-ack-state">
            <span className="staff-dispatch-ack-icon">📍</span>
            <span className="staff-dispatch-ack-text">ON SCENE</span>
            <span className="staff-dispatch-ack-sub">Assess and report situation</span>
          </div>
        ) : (
          <div className="staff-feed">
            <div className="staff-feed-header">
              <div className="staff-standby-icon" style={{ fontSize: 24, marginBottom: 8 }}>🛡️</div>
              <div className="staff-standby-label">ON STANDBY</div>
              <div className="staff-standby-sub">You can file a report below or claim an active incident</div>
            </div>
            
            <div className="staff-incident-list" style={{ marginTop: 24, paddingBottom: 80 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ color: 'var(--color-text-mid)', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>LIVE INCIDENTS</span>
                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 12, fontSize: 11, color: '#e4e4e7' }}>
                  {liveIncidents.length} Active
                </span>
              </div>

              {liveIncidents.length === 0 ? (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
                  <div style={{ color: 'var(--color-text-mid)', fontSize: 13, fontWeight: 500 }}>No active incidents</div>
                  <div style={{ color: 'var(--color-text-low)', fontSize: 11, marginTop: 4 }}>All clear on all floors.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {liveIncidents.map(inc => (
                    <div key={inc.id} style={{ 
                      background: inc.severity >= 8 ? 'linear-gradient(145deg, rgba(239, 68, 68, 0.1) 0%, rgba(20, 20, 25, 0.9) 100%)' : 'rgba(255,255,255,0.03)', 
                      backdropFilter: 'blur(10px)',
                      padding: 20, 
                      borderRadius: 16, 
                      border: `1px solid ${inc.severity >= 8 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                      transition: 'transform 0.2s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 800, color: 'var(--color-text-hi)', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 }}>{inc.type}</span>
                            {inc.severity >= 8 && <span style={{ background: 'var(--color-error)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, animation: 'pulseEvac 2s infinite' }}>CRITICAL</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--color-text-mid)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>📍</span> {inc.location}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', color: 'var(--color-text-mid)', fontWeight: 600, border: '1px solid rgba(255,255,255,0.05)' }}>
                          {new Date(inc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      
                      <div style={{ fontSize: 13, color: 'var(--color-text-hi)', marginBottom: 16, lineHeight: 1.5, background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                        {inc.description}
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: inc.status === 'active' ? 'var(--color-warning)' : 'var(--color-primary)' }} />
                          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: inc.status === 'active' ? 'var(--color-warning)' : 'var(--color-text-mid)' }}>
                            {inc.status.toUpperCase()}
                          </span>
                        </div>
                        
                        {inc.status === 'active' ? (
                          <button 
                            onClick={() => handleSelfAssign(inc.id, inc.location, inc.description)}
                            style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)', transition: 'all 0.2s' }}>
                            CLAIM ISSUE
                          </button>
                        ) : inc.assignedTo ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                              {inc.assignedTo.charAt(0)}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-mid)', fontWeight: 500 }}>
                              {inc.assignedTo}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Report Preview */}
        {(isListening || transcript || capturedPreview || isProcessing || processingError) && (
          <div className="staff-report-preview">
            <div className="staff-report-status">
              {isListening ? '🎙️ LISTENING...' :
               isProcessing ? '⚙️ ANALYZING...' :
               processingError ? '❌ ERROR' :
               (transcript || capturedPreview) ? '📝 REPORT READY' : ''}
            </div>

            {capturedPreview && (
              <div className="staff-report-image">
                <img src={capturedPreview} alt="Captured scene" />
                <button className="staff-report-remove" onClick={() => {
                  setCapturedImage(null);
                  setCapturedPreview(null);
                }}>✕</button>
              </div>
            )}

            {transcript && (
              <p className="staff-report-transcript">"{transcript}"</p>
            )}

            {processingError && (
              <p className="staff-report-error">{processingError}</p>
            )}

            {!isListening && !isProcessing && (transcript || capturedImage) && (
              <button className="staff-report-submit" onClick={submitReport}>
                ⚡ SUBMIT REPORT
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Action Bar — One-handed operation ────────────────────────────── */}
      <div className="staff-action-bar">
        <input type="file" accept="image/*" capture="environment"
          ref={fileInputRef} style={{ display: 'none' }}
          onChange={handleImageCapture}
        />

        {/* Camera button */}
        <button className="staff-action-btn staff-action-camera"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>

        {/* Voice input button — tap to start/stop */}
        <button
          className={`staff-action-btn staff-action-ptt ${isListening ? 'active' : ''}`}
          onClick={toggleListening}
        >
          {isListening ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path d="M19 10v2a7 7 0 01-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {/* Quick text report */}
        <button className="staff-action-btn staff-action-text"
          onClick={() => {
            const text = prompt('Quick report:');
            if (text) {
              setTranscript(text);
            }
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
