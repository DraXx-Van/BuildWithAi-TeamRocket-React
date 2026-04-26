import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { streamDispatchForStaff, fetchStaff, releaseStaff } from '../../services/firebaseService';
import useIncidentStore from '../../store/useIncidentStore';
import useAuthStore from '../../store/useAuthStore';
import { kSeedStaff } from '../../services/staffData';

export default function ResponderHUD() {
  const navigate = useNavigate();
  const logout = useAuthStore(s => s.logout);

  // Login State
  const [currentUser, setCurrentUser] = useState(null);
  const [availableStaff, setAvailableStaff] = useState([]);
  
  // Incident State
  const [activeDispatch, setActiveDispatch] = useState(null);
  const [currentIncident, setCurrentIncident] = useState(null);
  const [activeTab, setActiveTab] = useState('missions'); // 'report', 'missions', 'comms', 'profile'
  
  // Chat State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  
  const processIncidentData = useIncidentStore(s => s.processIncidentData);
  const appendLogToIncident = useIncidentStore(s => s.appendLogToIncident);
  const liveIncidents = useIncidentStore(s => s.liveIncidents);
  const isProcessing = useIncidentStore(s => s.isProcessing);
  const resolveIncident = useIncidentStore(s => s.resolveIncident);
  
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);

  // 1. Fetch Staff for Login
  useEffect(() => {
    fetchStaff().then(staff => {
      setAvailableStaff(staff.length > 0 ? staff : kSeedStaff);
    });
  }, []);

  // 2. Stream Dispatch and Setup Recognition
  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = streamDispatchForStaff(currentUser.name, (data) => {
      setActiveDispatch(data);
    });

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
  }, [currentUser]);

  // 3. Keep currentIncident synced
  useEffect(() => {
    if (currentIncident) {
      const inc = liveIncidents.find(i => i.id === currentIncident.id);
      if (inc) setCurrentIncident(inc);
    }
  }, [liveIncidents, currentIncident?.id]);

  // 4. Auto-clear stuck dispatches (if incident was resolved but dispatch stayed in DB)
  useEffect(() => {
    if (activeDispatch && currentUser) {
      const inc = liveIncidents.find(i => i.id === activeDispatch.incidentId);
      if (!inc || inc.status === 'resolved') {
        releaseStaff(currentUser.id || null, currentUser.name);
      }
    }
  }, [activeDispatch, liveIncidents, currentUser]);

  // Scroll to bottom of signals
  useEffect(() => {
    if (scrollRef.current && currentIncident) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentIncident?.evidenceLogs, currentIncident]);

  const handleLogin = (staff) => setCurrentUser(staff);

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
    if (recognitionRef.current) recognitionRef.current.stop();
    handleSendMessage(transcript);
    setTranscript('');
  };

  const handleSendMessage = (messageOverride) => {
    const msg = typeof messageOverride === 'string' ? messageOverride : chatInput;
    if (!msg.trim() && !capturedImage) return;

    const logPrefix = `Responder: `;
    const fullMessage = `${logPrefix}${msg.trim()}`;

    if (currentIncident) {
      appendLogToIncident(currentIncident.id, fullMessage, capturedImage);
    } else {
      processIncidentData(fullMessage, capturedImage, currentUser.name, locationInput.trim() || null);
    }
    
    setChatInput('');
    setLocationInput('');
    setCapturedImage(null);
  };

  const handleResolve = () => {
    if (currentIncident && currentIncident.status !== 'resolved') {
      resolveIncident(currentIncident.id);
      handleSendMessage("[STATUS UPDATE] Mission accomplished. Incident resolved.");
    }
  };

  // ── RENDER LOGIN SCREEN ──
  if (!currentUser) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#09090b', color: '#fafafa', alignItems: 'center', position: 'relative' }}>
        
        {/* Back Button */}
        <button 
          onClick={async () => {
            if (logout) await logout();
            navigate('/login');
          }}
          style={{ position: 'absolute', top: 24, left: 24, background: 'transparent', border: '1px solid #27272a', color: '#a1a1aa', padding: '8px 16px', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, zIndex: 20 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          EXIT
        </button>

        {/* Header Block - Fixed at top */}
        <div style={{ width: '100%', maxWidth: 400, padding: '64px 32px 24px', flexShrink: 0 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, margin: 0 }}>AEGIS TACTICAL</h1>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#a1a1aa', letterSpacing: 2, marginTop: 8 }}>RESPONDER AUTHENTICATION</p>
          </div>
        </div>
        
        {/* Scrollable List Block */}
        <div style={{ width: '100%', maxWidth: 400, padding: '0 32px 32px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#a1a1aa', marginBottom: 4, position: 'sticky', top: 0, background: '#09090b', paddingBottom: 8, zIndex: 10 }}>SELECT PROFILE</div>
          
          {availableStaff.map((staff, idx) => (
            <button 
              key={staff.id || `staff-${idx}`}
              onClick={() => handleLogin(staff)}
              style={{ 
                background: '#18181b', border: '1px solid #27272a', padding: 16, borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', transition: 'all 0.2s', color: 'white', textAlign: 'left',
                flexShrink: 0
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{staff.name}</div>
                <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4 }}>{staff.role}</div>
              </div>
              <div style={{ fontSize: 20 }}>→</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Filter incidents to only those assigned to or reported by currentUser
  const myIncidents = liveIncidents.filter(inc => inc.assignedTo === currentUser.name || inc.reporterName === currentUser.name);

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#09090b', color: '#fafafa' }}>
      
      {/* ── HEADER ── */}
      <header style={{ padding: '16px 24px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#09090b', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeDispatch ? '#ef4444' : '#10b981', boxShadow: `0 0 12px ${activeDispatch ? '#ef4444' : '#10b981'}`, animation: 'blink 1.5s infinite' }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: activeDispatch ? '#ef4444' : '#10b981', letterSpacing: 2 }}>
            {activeDispatch ? 'DISPATCHED' : 'STANDBY'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'white' }}>{currentUser.name}</div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#a1a1aa', letterSpacing: 1 }}>{currentUser.role.toUpperCase()}</div>
        </div>
        <button 
          onClick={() => {
            setCurrentIncident(null);
            setActiveTab('missions');
          }}
          style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: (currentIncident || activeTab !== 'missions') ? 'pointer' : 'default', fontFamily: 'var(--font-mono)', fontSize: 10, opacity: (currentIncident || activeTab !== 'missions') ? 1 : 0 }}
        >
          BACK
        </button>
      </header>

      {/* ── NEW DISPATCH NOTIFICATION ── */}
      {activeDispatch &&
        liveIncidents.some(i => i.id === activeDispatch.incidentId && i.assignedTo === currentUser.name && i.status !== 'resolved') &&
        (!currentIncident || currentIncident.id !== activeDispatch.incidentId) && (
        <div style={{ 
          background: '#ef4444', color: 'white', padding: '12px 24px', 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: '1px solid #7f1d1d', zIndex: 9,
          animation: 'pulse 2s infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>🚨</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>NEW INCIDENT REPORTED: GO FAST</div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', opacity: 0.8, marginTop: 2 }}>You have been requested for immediate deployment.</div>
            </div>
          </div>
          <button 
             onClick={() => {
               const inc = liveIncidents.find(i => i.id === activeDispatch.incidentId);
               if (inc) {
                 setCurrentIncident(inc);
                 setActiveTab('comms');
               }
             }}
             style={{ 
               padding: '8px 16px', background: 'white', color: '#ef4444', 
               border: 'none', borderRadius: 6, fontWeight: 900, fontSize: 11,
               cursor: 'pointer', letterSpacing: 1
             }}
          >
            VIEW MISSION
          </button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* ── MAIN VIEW ── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#09090b', overflow: 'hidden' }}>
          
          {activeTab === 'report' && (
            <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🚨</div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#ef4444' }}>REPORT INCIDENT</h2>
                <div style={{ fontSize: 10, color: '#a1a1aa', fontFamily: 'var(--font-mono)', marginTop: 4 }}>TRANSMIT TO COMMAND CENTER</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 10, color: '#a1a1aa', fontFamily: 'var(--font-mono)' }}>LOCATION (OPTIONAL)</label>
                <input 
                  type="text" 
                  placeholder="e.g. 4th Floor Server Room"
                  value={locationInput}
                  onChange={e => setLocationInput(e.target.value)}
                  style={{ background: '#18181b', border: '1px solid #27272a', padding: 16, borderRadius: 8, color: 'white', fontSize: 14, outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 10, color: '#a1a1aa', fontFamily: 'var(--font-mono)' }}>DESCRIPTION</label>
                <textarea 
                  placeholder="Describe the emergency... or use voice"
                  value={chatInput || transcript}
                  onChange={e => setChatInput(e.target.value)}
                  style={{ background: '#18181b', border: '1px solid #27272a', padding: 16, borderRadius: 8, color: 'white', fontSize: 14, outline: 'none', minHeight: 100, resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  onPointerDown={startListening}
                  onPointerUp={() => {
                    setIsListening(false);
                    if (recognitionRef.current) recognitionRef.current.stop();
                    if (transcript) setChatInput(prev => prev ? prev + ' ' + transcript : transcript);
                    setTranscript('');
                  }}
                  onPointerLeave={() => {
                    if (isListening) {
                      setIsListening(false);
                      if (recognitionRef.current) recognitionRef.current.stop();
                      if (transcript) setChatInput(prev => prev ? prev + ' ' + transcript : transcript);
                      setTranscript('');
                    }
                  }}
                  style={{ flex: 1, padding: 16, borderRadius: 8, background: isListening ? '#ef4444' : '#27272a', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
                  {isListening ? 'LISTENING...' : 'HOLD TO SPEAK'}
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ flex: 1, padding: 16, borderRadius: 8, background: capturedImage ? '#10b981' : '#27272a', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  {capturedImage ? 'PHOTO ATTACHED' : 'ATTACH PHOTO'}
                </button>
              </div>

              <button 
                onClick={() => {
                  const msg = (chatInput || transcript).trim();
                  if (!msg && !capturedImage) return;
                  processIncidentData(msg, capturedImage, currentUser.name, locationInput.trim() || null);
                  setChatInput('');
                  setLocationInput('');
                  setCapturedImage(null);
                  setActiveTab('missions');
                }}
                disabled={!chatInput && !transcript && !capturedImage && !isProcessing}
                style={{ marginTop: 'auto', background: '#ef4444', color: 'white', border: 'none', padding: 20, borderRadius: 8, fontWeight: 800, fontSize: 16, cursor: 'pointer', opacity: (!chatInput && !transcript && !capturedImage) || isProcessing ? 0.5 : 1, transition: 'all 0.2s' }}
              >
                {isProcessing ? 'TRANSMITTING...' : 'TRANSMIT REPORT TO COMMAND'}
              </button>
            </div>
          )}

          {activeTab === 'missions' && (
            <div style={{ padding: 24, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
              {myIncidents.length > 0 ? (
                <>
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#a1a1aa', marginBottom: 16 }}>MY ACTIVE MISSIONS</div>
                  {myIncidents.map(inc => (
                    <div 
                      key={inc.id}
                      onClick={() => {
                        setCurrentIncident(inc);
                        setActiveTab('comms');
                      }}
                      style={{ background: '#18181b', border: '1px solid #27272a', padding: 16, borderRadius: 12, marginBottom: 12, cursor: 'pointer', transition: 'border-color 0.2s' }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = '#8b5cf6'}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = '#27272a'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, color: '#ef4444' }}>{inc.type.toUpperCase()}</div>
                        <div style={{ fontSize: 10, color: '#a1a1aa' }}>Lv {inc.severity}</div>
                      </div>
                      <div style={{ fontSize: 13, color: 'white' }}>{inc.location}</div>
                      {inc.status === 'resolved' ? (
                        <div style={{ marginTop: 8, fontSize: 10, color: '#10b981', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>✅ RESOLVED</div>
                      ) : (
                        <>
                          {inc.assignedTo === currentUser.name && (
                             <div style={{ marginTop: 8, fontSize: 10, color: '#10b981', fontFamily: 'var(--font-mono)' }}>ASSIGNED TO YOU</div>
                          )}
                          {inc.reporterName === currentUser.name && inc.assignedTo !== currentUser.name && (
                             <div style={{ marginTop: 8, fontSize: 10, color: '#8b5cf6', fontFamily: 'var(--font-mono)' }}>REPORTED BY YOU</div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                  <div style={{ fontSize: 48, marginBottom: 20 }}>🛡️</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: 3, color: '#a1a1aa', textAlign: 'center', lineHeight: 1.5 }}>
                    NO ASSIGNED MISSIONS
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'comms' && (
            !currentIncident ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                <div style={{ fontSize: 48, marginBottom: 20 }}>📡</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: 3, color: '#a1a1aa', textAlign: 'center', lineHeight: 1.5 }}>
                  NO ACTIVE COMM LINK<br/>Select a mission to communicate.
                </div>
              </div>
            ) : (
              <>
                {/* Mission Stats Bar */}
                <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid #27272a', display: 'flex', gap: 24, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#a1a1aa', marginBottom: 4 }}>OBJECTIVE</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>{currentIncident.type.toUpperCase()}</div>
                  </div>
                  <div style={{ width: 1, height: 24, background: '#27272a' }} />
                  <div style={{ flex: 2 }}>
                    <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#a1a1aa', marginBottom: 4 }}>LOCATION</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>{currentIncident.location}</div>
                  </div>
                  <button 
                    onClick={handleResolve}
                    disabled={currentIncident.status === 'resolved'}
                    style={{ 
                      background: currentIncident.status === 'resolved' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                      border: `1px solid ${currentIncident.status === 'resolved' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, 
                      color: currentIncident.status === 'resolved' ? '#10b981' : '#ef4444', 
                      padding: '6px 12px', 
                      borderRadius: 6, 
                      fontSize: 10, 
                      fontFamily: 'var(--font-mono)', 
                      cursor: currentIncident.status === 'resolved' ? 'default' : 'pointer', 
                      fontWeight: 700 
                    }}
                  >
                    {currentIncident.status === 'resolved' ? 'RESOLVED' : 'RESOLVE'}
                  </button>
                </div>

                {/* Quick Actions (only if assigned to current user and not resolved) */}
                {currentIncident.assignedTo === currentUser.name && currentIncident.status !== 'resolved' && (
                  <div style={{ padding: '8px 24px', display: 'flex', gap: 12, borderBottom: '1px solid #27272a', background: 'rgba(255,255,255,0.01)', overflowX: 'auto', flexShrink: 0 }}>
                    <button 
                      onClick={() => handleSendMessage("[STATUS UPDATE] EN ROUTE to location.")}
                      style={{ padding: '6px 12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 16, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      🏃‍♂️ EN ROUTE
                    </button>
                    <button 
                      onClick={() => handleSendMessage("[STATUS UPDATE] ARRIVED ON SCENE.")}
                      style={{ padding: '6px 12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 16, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      📍 ON SCENE
                    </button>
                    <button 
                      onClick={() => handleSendMessage("[STATUS UPDATE] Requesting BACKUP to this location.")}
                      style={{ padding: '6px 12px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 16, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      ⚠️ NEED BACKUP
                    </button>
                  </div>
                )}

                {/* Signal Stream (Chat Area) */}
                <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ textAlign: 'center', margin: '10px 0' }}>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', background: '#27272a', padding: '4px 12px', borderRadius: 20, color: '#a1a1aa' }}>
                      MISSION STARTED — {new Date(currentIncident.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '16px', borderRadius: '12px', marginBottom: '8px' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#ef4444', marginBottom: 8, fontWeight: 800, letterSpacing: 1 }}>TACTICAL BRIEFING</div>
                    <div style={{ fontSize: 13, color: 'white', lineHeight: 1.5 }}>{currentIncident.description}</div>
                    {currentIncident.requiredSkills?.length > 0 && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        {currentIncident.requiredSkills.map((skill, i) => (
                          <span key={i} style={{ background: '#27272a', color: '#a1a1aa', padding: '4px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)' }}>{skill}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {currentIncident.evidenceLogs.map((log, idx) => {
                    const isMe = log.startsWith('Responder:') || log.includes(currentUser.name);
                    const cleanLog = log.replace('Responder:', '').replace(currentUser.name + ':', '').trim();
                    return (
                      <div key={idx} style={{ 
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}>
                        <div style={{ 
                          fontSize: 8, 
                          fontFamily: 'var(--font-mono)', 
                          color: '#a1a1aa',
                          textAlign: isMe ? 'right' : 'left',
                          padding: '0 8px'
                        }}>
                          {isMe ? 'YOU' : 'COMMAND'}
                        </div>
                        <div style={{ 
                          background: isMe ? '#8b5cf6' : '#27272a',
                          color: 'white',
                          padding: '12px 16px',
                          borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                          fontSize: 13,
                          lineHeight: 1.5,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}>
                          {cleanLog}
                        </div>
                      </div>
                    );
                  })}

                  {isProcessing && (
                    <div style={{ alignSelf: 'flex-start', background: '#27272a', padding: '12px 16px', borderRadius: '16px 16px 16px 2px', display: 'flex', gap: 6 }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#a1a1aa', animation: 'blink 1s infinite 0.1s' }} />
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#a1a1aa', animation: 'blink 1s infinite 0.2s' }} />
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#a1a1aa', animation: 'blink 1s infinite 0.3s' }} />
                    </div>
                  )}
                </div>
              </>
            )
          )}

          {activeTab === 'profile' && (
            <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: '#18181b', border: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, marginBottom: 16 }}>
                🛡️
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{currentUser.name}</h2>
              <div style={{ fontSize: 12, color: '#a1a1aa', fontFamily: 'var(--font-mono)', marginTop: 8, letterSpacing: 1 }}>{currentUser.role.toUpperCase()}</div>
              
              <div style={{ background: '#18181b', border: '1px solid #27272a', padding: 20, borderRadius: 12, width: '100%', maxWidth: 300, marginTop: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#a1a1aa' }}>Status</span>
                  <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>ACTIVE DUTY</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#a1a1aa' }}>Clearance</span>
                  <span style={{ fontSize: 12, color: 'white', fontWeight: 700 }}>LEVEL 4</span>
                </div>
              </div>

              <button 
                onClick={() => {
                  setCurrentUser(null);
                  setCurrentIncident(null);
                  setActiveTab('missions');
                }}
                style={{ marginTop: 40, background: 'transparent', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '16px 32px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', width: '100%', maxWidth: 300, letterSpacing: 1 }}
              >
                END SHIFT
              </button>
            </div>
          )}

        </main>
      </div>

      {/* ── TACTICAL CHAT CONTROL ── */}
      {activeTab === 'comms' && currentIncident && currentIncident.status !== 'resolved' && (
      <footer style={{ padding: '16px 24px', background: '#09090b', borderTop: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        {isListening && (
          <div style={{ background: 'rgba(139,92,246,0.1)', padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(139,92,246,0.3)', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ fontSize: 12, color: 'white', fontStyle: 'italic' }}>
              {transcript || 'Listening...'}
            </div>
          </div>
        )}

        {/* ── ATTACHMENTS & OVERRIDES AREA ── */}
        <div style={{ display: 'flex', gap: 12, paddingLeft: 56, minHeight: 24, alignItems: 'center' }}>
          
          {/* Photo Attachment Pill */}
          {capturedImage && (
             <div style={{ 
               fontSize: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, 
               background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
               padding: '4px 10px', borderRadius: 16, fontFamily: 'var(--font-mono)', fontWeight: 600
             }}>
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
               PHOTO SECURED
               <button onClick={() => setCapturedImage(null)} style={{ background: 'none', border: 'none', color: '#10b981', marginLeft: 4, cursor: 'pointer', padding: 0, display: 'flex' }}>✕</button>
             </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />
          
          <button 
            onClick={() => fileInputRef.current?.click()} 
            style={{ 
              width: 44, height: 44, borderRadius: '50%', background: '#18181b', border: '1px solid #27272a', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' 
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
          </button>

          <input 
            type="text" 
            placeholder={"Send field update..."}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            style={{
              flex: 1, background: '#18181b', border: '1px solid #27272a', borderRadius: 24, padding: '12px 20px',
              color: 'white', fontSize: 14, outline: 'none'
            }}
          />

          {chatInput.trim() || capturedImage ? (
             <button 
               onClick={() => handleSendMessage()}
               style={{ 
                 width: 44, height: 44, borderRadius: '50%', background: '#8b5cf6', border: 'none', flexShrink: 0,
                 display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
               }}
             >
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
             </button>
          ) : (
            <button 
              onPointerDown={startListening}
              onPointerUp={stopListening}
              onPointerLeave={() => isListening && stopListening()}
              style={{ 
                width: 44, height: 44, borderRadius: '50%', 
                background: isListening ? '#ef4444' : '#18181b', 
                border: `1px solid ${isListening ? '#ef4444' : '#27272a'}`, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', 
                transition: 'all 0.2s', 
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={isListening ? 'white' : '#a1a1aa'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>
          )}
        </div>
      </footer>
      )}

      {/* ── BOTTOM NAVBAR ── */}
      <nav style={{ display: 'flex', background: '#09090b', borderTop: '1px solid #27272a', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <button 
          onClick={() => { setActiveTab('report'); setCurrentIncident(null); }} 
          style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: activeTab === 'report' ? '#ef4444' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', transition: 'color 0.2s' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>REPORT</span>
        </button>
        <button 
          onClick={() => { setActiveTab('missions'); setCurrentIncident(null); }} 
          style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: activeTab === 'missions' ? '#f59e0b' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', transition: 'color 0.2s' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>MISSIONS</span>
        </button>
        <button 
          onClick={() => setActiveTab('comms')} 
          style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: activeTab === 'comms' ? '#8b5cf6' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', transition: 'color 0.2s' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>COMMS</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')} 
          style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: activeTab === 'profile' ? '#10b981' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', transition: 'color 0.2s' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>PROFILE</span>
        </button>
      </nav>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
