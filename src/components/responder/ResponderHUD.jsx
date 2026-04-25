import { useState, useEffect, useRef } from 'react';
import { streamDispatchForStaff, updateIncidentStatus, assignStaffToIncident } from '../../services/firebaseService';
import { sanitizeText, stripImageMetadata } from '../../services/dlpService';
import useIncidentStore from '../../store/useIncidentStore';
import useAuthStore from '../../store/useAuthStore';

export default function ResponderHUD() {
  const [dispatchAlert, setDispatchAlert] = useState(null);
  const [currentIncident, setCurrentIncident] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedPreview, setCapturedPreview] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [acknowledged, setAcknowledged] = useState(false);
  const [dispatchState, setDispatchState] = useState(null);

  const processIncidentData = useIncidentStore(s => s.processIncidentData);
  const liveIncidents = useIncidentStore(s => s.liveIncidents);
  const isProcessing = useIncidentStore(s => s.isProcessing);
  const processingError = useIncidentStore(s => s.processingError);
  const { profile, logout } = useAuthStore();

  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

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
        setCurrentIncident(null);
      }
    });
    return () => unsubscribe();
  }, [myName]);

  // Sync current incident from live feed
  useEffect(() => {
    if (dispatchAlert) {
      const inc = liveIncidents.find(i => i.id === dispatchAlert.incidentId);
      setCurrentIncident(inc);
    } else {
      const myClaimed = liveIncidents.find(i => i.assignedTo === myName);
      setCurrentIncident(myClaimed || null);
    }
  }, [dispatchAlert, liveIncidents, myName]);

  // Scroll to bottom of signals
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentIncident?.evidenceLogs]);

  // Setup speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

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
      if (event.error === 'no-speech') return;
      if (event.error === 'aborted') return;
      setIsListening(false);
    };

    recognition.onend = () => {
      if (recognitionRef.current?._shouldBeListening) {
        try { recognition.start(); } catch { setIsListening(false); }
      }
    };

    recognitionRef.current = recognition;
    recognitionRef.current._resetFinalTranscript = () => { finalTranscript = ''; };
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current._shouldBeListening = false;
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isListening) {
      setIsListening(false);
      recognitionRef.current._shouldBeListening = false;
      recognitionRef.current.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setTranscript('');
      recognitionRef.current._resetFinalTranscript();
      recognitionRef.current._shouldBeListening = true;
      setIsListening(true);
      recognitionRef.current.start();
    } catch (err) {
      alert('Microphone access required.');
    }
  };

  const handleImageCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const raw = reader.result.replace('data:', '').replace(/^.+,/, '');
      setCapturedPreview(reader.result);
      const clean = await stripImageMetadata(raw);
      setCapturedImage(clean);
    };
    reader.readAsDataURL(file);
  };

  const submitReport = async () => {
    if (!transcript.trim() && !capturedImage) return;
    const { sanitized } = sanitizeText(transcript || 'Emergency reported via Staff HUD');
    await processIncidentData(sanitized, capturedImage);
    setTranscript('');
    setCapturedImage(null);
    setCapturedPreview(null);
    setIsListening(false);
    if (recognitionRef.current) recognitionRef.current._shouldBeListening = false;
  };

  const handleAcknowledge = () => {
    setAcknowledged(true);
    setDispatchState('acknowledged');
  };

  const handleEnRoute = async () => {
    setDispatchState('en_route');
    await updateIncidentStatus(dispatchAlert?.incidentId, 'en_route');
  };

  const handleReached = async () => {
    setDispatchState('reached');
    await updateIncidentStatus(dispatchAlert?.incidentId, 'reached');
  };

  const handleSelfAssign = async (inc) => {
    await assignStaffToIncident(inc.id, { id: myId, name: myName, photoUrl: profile?.photoURL }, inc.location, inc.description);
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

        <div style={{ display: 'flex', gap: 6, padding: '12px 20px', overflowX: 'auto' }}>
          <span className="skill-chip">🪪 {myBadge}</span>
          <span className="skill-chip" style={{ background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', borderColor: 'rgba(16,185,129,0.2)' }}>📍 Floor {myFloor}</span>
          <span className="skill-chip" style={{ background: 'rgba(245,158,11,0.1)', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.2)' }}>🕐 {myShift}</span>
        </div>

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
      <div className="staff-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Mission Intelligence Plane (Chat Stream) */}
        {currentIncident ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
             {/* Objective Header */}
             <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 16 }}>
               <div>
                 <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--color-text-mid)', marginBottom: 2 }}>OBJECTIVE</div>
                 <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444' }}>{currentIncident.type.toUpperCase()}</div>
               </div>
               <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
               <div>
                 <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--color-text-mid)', marginBottom: 2 }}>LOCATION</div>
                 <div style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{currentIncident.location}</div>
               </div>
             </div>

             {/* Signal Stream */}
             <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {currentIncident.evidenceLogs?.map((log, idx) => {
                  const isMe = log.startsWith('Responder:') || log.includes(myName);
                  return (
                    <div key={idx} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: 'var(--color-text-mid)', textAlign: isMe ? 'right' : 'left', padding: '0 4px 2px' }}>
                        {isMe ? 'YOU' : 'COMMAND'}
                      </div>
                      <div style={{ 
                        background: isMe ? 'var(--color-primary)' : 'var(--color-surface-2)', 
                        color: '#fff', padding: '10px 14px', borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                        fontSize: 13, lineHeight: 1.4, boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}>
                        {log.replace('Responder:', '').replace(myName + ':', '').trim()}
                      </div>
                    </div>
                  );
                })}
                {isProcessing && (
                  <div style={{ alignSelf: 'flex-start', background: 'var(--color-surface-2)', padding: '10px 14px', borderRadius: '16px 16px 16px 2px', display: 'flex', gap: 4 }}>
                    <div className="live-dot" style={{ width: 4, height: 4 }} />
                    <div className="live-dot" style={{ width: 4, height: 4, animationDelay: '0.2s' }} />
                    <div className="live-dot" style={{ width: 4, height: 4, animationDelay: '0.4s' }} />
                  </div>
                )}
             </div>

             {/* Tactical Controls when Reached */}
             {dispatchState === 'reached' || currentIncident.status === 'reached' ? (
                <div style={{ padding: '12px 20px', background: 'rgba(16,185,129,0.05)', borderTop: '1px solid rgba(16,185,129,0.1)', textAlign: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#10b981', letterSpacing: 1 }}>📍 ON SCENE — REPORTING ACTIVE</span>
                </div>
             ) : (
                <div style={{ padding: '16px', display: 'flex', gap: 10 }}>
                   <button 
                     style={{ flex: 1, padding: 12, borderRadius: 12, background: dispatchState === 'en_route' ? 'var(--color-surface-2)' : 'var(--color-primary)', color: '#fff', fontWeight: 700, border: 'none' }}
                     onClick={handleEnRoute}
                     disabled={dispatchState === 'en_route'}
                   >
                     🚗 EN ROUTE
                   </button>
                   <button 
                     style={{ flex: 1, padding: 12, borderRadius: 12, background: 'var(--color-success)', color: '#fff', fontWeight: 700, border: 'none' }}
                     onClick={handleReached}
                     disabled={dispatchState !== 'en_route'}
                   >
                     📍 ARRIVED
                   </button>
                </div>
             )}
          </div>
        ) : (
          /* Standby Feed */
          <div className="staff-feed" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {dispatchAlert && !acknowledged ? (
              <div className="staff-dispatch-alert">
                <div className="staff-dispatch-header">
                  <span className="staff-dispatch-icon">🚨</span>
                  <span className="staff-dispatch-title">DISPATCH ALERT</span>
                </div>
                <p className="staff-dispatch-detail">
                  Target: <strong>{dispatchAlert.incidentId}</strong><br/>
                  Location: <strong>{dispatchAlert.location}</strong>
                </p>
                <button className="staff-dispatch-ack" onClick={handleAcknowledge}>✓ ACKNOWLEDGE MISSION</button>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🛡️</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: 1 }}>COMMAND STANDBY</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-low)', marginTop: 4 }}>No active missions assigned to you.</div>
                </div>

                <div style={{ marginTop: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-text-mid)', letterSpacing: 1 }}>LIVE INCIDENTS</span>
                    <span className="skill-chip">{liveIncidents.length} ACTIVE</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {liveIncidents.length === 0 ? (
                      <div style={{ padding: 32, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 16 }}>
                        <div style={{ color: 'var(--color-text-low)', fontSize: 11 }}>All areas secure.</div>
                      </div>
                    ) : (
                      liveIncidents.map(inc => (
                        <div key={inc.id} style={{ background: 'var(--color-surface-2)', padding: 16, borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontWeight: 800, color: '#fff', fontSize: 13 }}>{inc.type.toUpperCase()}</span>
                            <span style={{ fontSize: 10, color: 'var(--color-text-low)' }}>{inc.location}</span>
                          </div>
                          <p style={{ fontSize: 12, color: 'var(--color-text-mid)', marginBottom: 12, lineHeight: 1.4 }}>{inc.description}</p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: inc.status === 'active' ? 'var(--color-warning)' : 'var(--color-primary)' }}>
                              ● {inc.status.toUpperCase()}
                            </span>
                            {inc.status === 'active' && (
                              <button 
                                onClick={() => handleSelfAssign(inc)}
                                style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}
                              >
                                CLAIM
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Report Status Preview Overlay */}
        {(isListening || transcript || capturedPreview || isProcessing) && (
          <div style={{ 
            position: 'absolute', bottom: 100, left: 16, right: 16, 
            background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', 
            borderRadius: 16, padding: 16, boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            animation: 'slideUp 0.3s ease-out'
          }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
               <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--color-primary)', letterSpacing: 1 }}>
                 {isListening ? '🎙️ LISTENING...' : '📝 REPORT PREVIEW'}
               </span>
               {(transcript || capturedPreview) && !isProcessing && (
                 <button onClick={() => { setTranscript(''); setCapturedPreview(null); setCapturedImage(null); }} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 10, fontWeight: 800 }}>CANCEL</button>
               )}
             </div>

             {capturedPreview && (
               <div style={{ position: 'relative', height: 100, width: 100, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                 <img src={capturedPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
               </div>
             )}

             {transcript && (
               <p style={{ fontSize: 13, color: '#fff', fontStyle: 'italic', marginBottom: 16 }}>"{transcript}"</p>
             )}

             {!isListening && !isProcessing && (
               <button 
                 onClick={submitReport}
                 style={{ width: '100%', padding: 12, borderRadius: 12, background: 'var(--color-success)', color: '#fff', fontWeight: 700, border: 'none' }}
               >
                 ⚡ SEND INTEL
               </button>
             )}
          </div>
        )}

        {/* ── Action Bar — One-handed operation ────────────────────────────── */}
        <div className="staff-action-bar">
          <input type="file" accept="image/*" capture="environment" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageCapture} />
          
          <button className="staff-action-btn staff-action-camera" onClick={() => fileInputRef.current?.click()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          <button className={`staff-action-btn staff-action-ptt ${isListening ? 'active' : ''}`} onClick={toggleListening}>
            {isListening ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          <button className="staff-action-btn staff-action-text" onClick={() => { const t = prompt('Report detail:'); if(t) setTranscript(t); }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
