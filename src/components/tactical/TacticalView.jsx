import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { validateTacticalKey } from '../../services/tacticalKeyService';
import { streamLiveIncidents } from '../../services/firebaseService';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../../firebase';
import { loadDynamicFloors, getAllLocalFloors, featureToRect, filterByType } from '../../services/floorPlanService';
import { findMultiFloorRoute, getMultiFloorGraph } from '../../services/navigationService';
import { analyzeTriageImage } from '../../services/geminiService';

export default function TacticalView() {
  const { keyId } = useParams();
  const [keyData, setKeyData] = useState(null);
  const [isValid, setIsValid] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [roomStatuses, setRoomStatuses] = useState({});
  const [activeFloor, setActiveFloor] = useState('0');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [clock, setClock] = useState(new Date());

  // Dynamic floor data
  const [allFloors, setAllFloors] = useState(() => getAllLocalFloors());
  const [isLoadingFloors, setIsLoadingFloors] = useState(true);

  // Load floors dynamically
  useEffect(() => {
    let cancelled = false;
    setIsLoadingFloors(true);
    // You could pass a specific hotelId here if the tactical key contained it
    loadDynamicFloors('hotel_default').then(({ floors }) => {
      if (cancelled) return;
      setAllFloors(floors);
      setIsLoadingFloors(false);
      // Switch active floor if current is not in new data
      const keys = Object.keys(floors);
      if (keys.length > 0 && !floors[activeFloor]) {
        setActiveFloor(keys[0]);
      }
    });
    return () => { cancelled = true; };
  }, [activeFloor]);

  // Image Triage State
  const [triageImage, setTriageImage] = useState(null);
  const [triageAnalysis, setTriageAnalysis] = useState(null);
  const [isTriaging, setIsTriaging] = useState(false);

  // Clock tick
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Validate the tactical key
  useEffect(() => {
    (async () => {
      const data = await validateTacticalKey(keyId);
      setKeyData(data);
      setIsValid(data !== null);
    })();
  }, [keyId]);

  // Stream live data if key is valid
  useEffect(() => {
    if (!isValid) return;
    const unsubIncidents = streamLiveIncidents(setIncidents);
    const roomRef = ref(rtdb, 'room_status');
    const unsubRooms = onValue(roomRef, (snap) => {
      setRoomStatuses(snap.exists() ? snap.val() : {});
    });
    return () => { unsubIncidents(); unsubRooms(); };
  }, [isValid]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result.split(',')[1];
      setTriageImage(reader.result);
      setIsTriaging(true);
      setTriageAnalysis(null);

      try {
        const context = selectedRoom ? `Room/Zone ${selectedRoom} on Floor ${activeFloor}` : `Floor ${activeFloor}`;
        const analysis = await analyzeTriageImage(base64String, context);
        setTriageAnalysis(analysis);
      } catch (err) {
        console.error(err);
        setTriageAnalysis({ error: "Failed to analyze image." });
      } finally {
        setIsTriaging(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Floor data
  const geojson = allFloors[activeFloor];

  // Derive room status map
  const statusMap = useMemo(() => {
    const m = {};
    // Default all rooms to 'unknown'
    if (geojson) {
      for (const f of geojson.features) {
        if (f.properties.type === 'room' || f.properties.type === 'suite') {
          m[f.properties.id] = 'unknown';
        }
      }
    }
    // Override from realtime
    for (const [key, val] of Object.entries(roomStatuses)) {
      const zoneId = `z_${key}`;
      if (m[zoneId] !== undefined) m[zoneId] = val.status || 'unknown';
    }
    // Mark incident rooms as danger
    for (const inc of incidents) {
      if (inc.status === 'resolved') continue;
      if (geojson) {
        for (const f of geojson.features) {
          const loc = inc.location?.toLowerCase() || '';
          const name = f.properties.name?.toLowerCase() || '';
          if (loc.includes(name) || name.includes(loc.split(',')[0]?.trim())) {
            m[f.properties.id] = inc.severity >= 8 ? 'critical' : 'danger';
          }
        }
      }
    }
    return m;
  }, [geojson, roomStatuses, incidents]);

  const activeIncidents = incidents.filter(i => i.status === 'active');
  const isCalamity = activeIncidents.some(i => i.severity >= 8);
  const totalUnaccounted = Object.values(statusMap).filter(s => s === 'unknown').length;
  const panicCount = Object.values(statusMap).filter(s => s === 'panic' || s === 'critical').length;
  const safeCount = Object.values(statusMap).filter(s => s === 'safe').length;

  // Evac route for selected room
  const evacRoute = useMemo(() => {
    if (!selectedRoom) return null;
    const graph = getMultiFloorGraph();
    const nodeEntry = Object.entries(graph.nodes).find(([_, n]) => n.zoneId === selectedRoom);
    if (!nodeEntry) return null;
    return findMultiFloorRoute(nodeEntry[0], { isCalamity, blockedZones: new Set() });
  }, [selectedRoom, isCalamity]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isValid === null) {
    return (
      <div className="tac-screen">
        <div className="tac-center">
          <div className="loading-spinner" />
          <div className="tac-load-text">VALIDATING TACTICAL ACCESS KEY...</div>
        </div>
      </div>
    );
  }

  // ── Invalid ────────────────────────────────────────────────────────────────
  if (!isValid) {
    return (
      <div className="tac-screen">
        <div className="tac-center">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div className="tac-denied-title">ACCESS DENIED</div>
          <div className="tac-denied-sub">
            Tactical key invalid or expired.<br />Contact Command for a new link.
          </div>
        </div>
      </div>
    );
  }

  // ── Render heatmap colors ──────────────────────────────────────────────────
  const getHeatColor = (zoneId) => {
    const status = statusMap[zoneId];
    if (status === 'safe') return { fill: 'rgba(16,185,129,0.25)', stroke: 'rgba(16,185,129,0.7)' };
    if (status === 'panic' || status === 'critical') return { fill: 'rgba(239,68,68,0.35)', stroke: '#ef4444' };
    if (status === 'danger') return { fill: 'rgba(245,158,11,0.3)', stroke: '#f59e0b' };
    return { fill: 'rgba(100,100,120,0.15)', stroke: 'rgba(100,100,120,0.3)' };
  };

  const viewport = geojson?.metadata?.viewport ?? { width: 680, height: 400 };

  return (
    <div className="tac-screen">
      {/* ── Header Bar ───────────────────────────────────────────────────── */}
      <div className="tac-header">
        <div className="tac-header-left">
          <div className="tac-live-badge">
            <span className="tac-live-dot" />
            LIVE — TACTICAL HQ
          </div>
          <div className="tac-title">CrisisFlow First Responder Portal</div>
        </div>
        <div className="tac-header-right">
          <div className="tac-clock">{clock.toLocaleTimeString()}</div>
          <div className="tac-key-label">KEY: {keyId.slice(0, 8)}...</div>
        </div>
      </div>

      {/* ── Stats Strip ──────────────────────────────────────────────────── */}
      <div className="tac-stats">
        <div className="tac-stat tac-stat-crit">
          <div className="tac-stat-val">{activeIncidents.length}</div>
          <div className="tac-stat-lbl">ACTIVE INCIDENTS</div>
        </div>
        <div className="tac-stat tac-stat-warn">
          <div className="tac-stat-val">{totalUnaccounted}</div>
          <div className="tac-stat-lbl">UNACCOUNTED</div>
        </div>
        <div className="tac-stat tac-stat-dang">
          <div className="tac-stat-val">{panicCount}</div>
          <div className="tac-stat-lbl">PANIC / CRITICAL</div>
        </div>
        <div className="tac-stat tac-stat-ok">
          <div className="tac-stat-val">{safeCount}</div>
          <div className="tac-stat-lbl">CONFIRMED SAFE</div>
        </div>
        {isCalamity && (
          <div className="tac-stat tac-stat-calam">
            <div className="tac-stat-val">⚠</div>
            <div className="tac-stat-lbl">CALAMITY MODE</div>
          </div>
        )}
      </div>

      {/* ── Main Body ────────────────────────────────────────────────────── */}
      <div className="tac-body">
        {/* Left: Heatmap */}
        <div className="tac-map-col">
          <div className="tac-map-title">
            FLOOR HEATMAP — {geojson?.metadata?.label ?? 'Unknown'}
          </div>
          <svg viewBox={`0 0 ${viewport.width} ${viewport.height}`}
            className="tac-svg" preserveAspectRatio="xMidYMid meet">
            <defs>
              <filter id="tacGlow">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {/* Background image if available */}
            {geojson?.metadata?.imageUrl ? (
              <image
                href={geojson.metadata.imageUrl}
                x="0" y="0"
                width={viewport.width} height={viewport.height}
                preserveAspectRatio="xMidYMid slice"
                opacity="0.85"
              />
            ) : null}
            {/* Rooms with heatmap colors */}
            {geojson?.features?.filter(f =>
              !['hallway', 'stair', 'exit', 'elevator'].includes(f.properties.type)
            ).map(f => {
              const r = featureToRect(f);
              const heat = getHeatColor(f.properties.id);
              const isPanic = statusMap[f.properties.id] === 'panic' || statusMap[f.properties.id] === 'critical';
              return (
                <g key={f.properties.id}
                  onClick={() => setSelectedRoom(f.properties.id)}
                  style={{ cursor: 'pointer' }}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h}
                    fill={heat.fill} stroke={heat.stroke}
                    strokeWidth={isPanic ? 2 : 1} rx="3"
                    className={isPanic ? 'tac-flash' : ''} />
                  <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 4}
                    fill="rgba(255,255,255,0.7)" fontSize="10"
                    fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
                    {f.properties.name}
                  </text>
                  {/* Status icon */}
                  <text x={r.x + r.w - 8} y={r.y + 12} fontSize="8" textAnchor="end">
                    {statusMap[f.properties.id] === 'safe' ? '✅' :
                     isPanic ? '🆘' :
                     statusMap[f.properties.id] === 'danger' ? '⚠️' : '❓'}
                  </text>
                </g>
              );
            })}
            {/* Stairs */}
            {filterByType(geojson, 'stair')?.map(f => {
              const r = featureToRect(f);
              return (
                <g key={f.properties.id}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h}
                    fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.5)" strokeWidth="1" strokeDasharray="3 2" rx="2" />
                  <text x={r.x + r.w / 2} y={r.y + r.h + 12}
                    fill="rgba(59,130,246,0.6)" fontSize="7" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
                    {f.properties.name}
                  </text>
                </g>
              );
            })}
            {/* Exits */}
            {filterByType(geojson, 'exit')?.map(f => {
              const r = featureToRect(f);
              return (
                <g key={f.properties.id}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h}
                    fill="rgba(16,185,129,0.3)" stroke="rgba(16,185,129,0.6)" strokeWidth="1.5" rx="3" />
                  <text x={r.x + r.w / 2} y={r.y + r.h / 2} fill="#10b981" fontSize="12" textAnchor="middle" dominantBaseline="central">→</text>
                  <text x={r.x + r.w / 2} y={r.y + r.h + 12}
                    fill="rgba(16,185,129,0.5)" fontSize="7" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
                    {f.properties.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Floor selector */}
          <div className="tac-floor-sel">
            {Object.keys(allFloors).map(key => (
              <button key={key}
                className={`tac-floor-btn ${activeFloor === key ? 'active' : ''}`}
                onClick={() => { setActiveFloor(key); setSelectedRoom(null); }}>
                {allFloors[key]?.metadata?.label ?? `Level ${key}`}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Incident Feed + Selected Room Info */}
        <div className="tac-feed-col">
          {/* Selected room evac info */}
          {selectedRoom && evacRoute && (
            <div className="tac-section tac-evac-card">
              <div className="tac-section-title">🧭 EVACUATION ROUTE</div>
              <div className="tac-evac-dest">→ {evacRoute.exitLabel} · ~{evacRoute.estimatedSeconds}s</div>
              {evacRoute.floorsTraversed?.length > 1 && (
                <div className="tac-evac-multi">
                  ⚡ {evacRoute.floorsTraversed.map(f => f === 0 ? 'G' : `F${f}`).join(' → ')}
                </div>
              )}
              <div className="tac-evac-steps">
                {evacRoute.instructions?.map((step, i) => (
                  <div key={i} className={`tac-step tac-step-${step.type}`}>
                    <span className="tac-step-icon">{step.icon}</span>
                    <span>{step.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active incidents */}
          <div className="tac-section">
            <div className="tac-section-title">🚨 ACTIVE INCIDENTS</div>
            {activeIncidents.length === 0 ? (
              <div className="tac-empty">No active incidents</div>
            ) : (
              activeIncidents.map(incident => (
                <div key={incident.id} className="tac-inc-card">
                  <div className="tac-inc-header">
                    <span className="tac-inc-type">{incident.type?.toUpperCase()}</span>
                    <span className="tac-inc-sev" style={{
                      color: incident.severity >= 8 ? '#ef4444' :
                             incident.severity >= 5 ? '#f59e0b' : '#8b5cf6'
                    }}>
                      SEV {incident.severity}
                    </span>
                  </div>
                  <div className="tac-inc-desc">{incident.description}</div>
                  <div className="tac-inc-loc">📍 {incident.location}</div>
                  {incident.assignedTo && (
                    <div className="tac-inc-assigned">▶ Assigned: {incident.assignedTo}</div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* AI Image Triage */}
          <div className="tac-section">
            <div className="tac-section-title">🤖 AI IMAGE TRIAGE</div>
            <div className="tac-ai-container" style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
              {!triageImage ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <label style={{ cursor: 'pointer', display: 'inline-block', padding: '8px 16px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '4px', fontSize: '12px' }}>
                    📷 UPLOAD SITUATION PHOTO
                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                  </label>
                  <div style={{ fontSize: 10, color: '#52525b', marginTop: 8 }}>
                    Gemini 3 Flash will assess hazard and passability
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ position: 'relative' }}>
                    <img src={triageImage} alt="Triage upload" style={{ width: '100%', borderRadius: '4px', border: '1px solid #3f3f46' }} />
                    <button onClick={() => { setTriageImage(null); setTriageAnalysis(null); }} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '10px' }}>✕ CLEAR</button>
                  </div>
                  
                  {isTriaging ? (
                    <div style={{ color: '#8b5cf6', fontSize: '12px', textAlign: 'center', fontFamily: "'JetBrains Mono', monospace" }}>
                      ⟳ Analyzing spatial context...
                    </div>
                  ) : triageAnalysis ? (
                    triageAnalysis.error ? (
                      <div style={{ color: '#ef4444', fontSize: '12px' }}>{triageAnalysis.error}</div>
                    ) : (
                      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: triageAnalysis.hazard_detected ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                            {triageAnalysis.hazard_detected ? `⚠ ${triageAnalysis.hazard_type?.toUpperCase() || 'HAZARD'} DETECTED` : '✅ CLEAR'}
                          </span>
                          <span style={{ color: '#a1a1aa' }}>CONFIDENCE: {Math.round(triageAnalysis.confidence_score * 100)}%</span>
                        </div>
                        <div style={{ marginBottom: '8px', color: '#e4e4e7' }}>
                          {triageAnalysis.description}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#a1a1aa' }}>ROUTE STATUS:</span>
                          <span style={{ padding: '2px 6px', borderRadius: '2px', background: triageAnalysis.is_passable ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: triageAnalysis.is_passable ? '#10b981' : '#ef4444' }}>
                            {triageAnalysis.is_passable ? 'PASSABLE' : 'BLOCKED'}
                          </span>
                        </div>
                      </div>
                    )
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="tac-footer">
        READ-ONLY TACTICAL ACCESS · Data updates in real-time · Generated by CrisisFlow Command ·
        Expires: {keyData?.expiresAt ? new Date(keyData.expiresAt).toLocaleTimeString() : 'N/A'}
      </div>
    </div>
  );
}
