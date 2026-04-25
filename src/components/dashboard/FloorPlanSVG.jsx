import { useState, useMemo } from 'react';
import useIncidentStore from '../../store/useIncidentStore';
import { DANGER_COLORS } from '../../models/building';
import { deriveDangerZones } from '../../models/crisisState';
import { SEED_ZONES } from '../../models/building';

// ── GeoJSON Data Layer (Spatial-First Architecture) ──────────────────────────
import { getAllLocalFloors, featureToRect, filterByType } from '../../services/floorPlanService';
// ── Multi-Floor Navigation (Dijkstra across floors) ─────────────────────────
import { findMultiFloorRoute, pathCoordsToSvgPath, getMultiFloorGraph } from '../../services/navigationService';

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT — GeoJSON-driven Floor Plan Renderer with Multi-Floor Routing
// ═══════════════════════════════════════════════════════════════════════════════
export default function FloorPlanSVG({ onZoneClick, forceEvacZone, hideControls, isEvacMode, forceFloor }) {
  const [activeFloor, setActiveFloor] = useState(
    forceFloor != null ? String(forceFloor) :
    forceEvacZone ? Math.floor(parseInt(forceEvacZone.replace('z_', '')) / 100).toString() : '0'
  );
  const [hoveredZone, setHoveredZone] = useState(null);
  const [selectedZone, setSelectedZone] = useState(forceEvacZone || null);
  const [showEvacRoute, setShowEvacRoute] = useState(!!forceEvacZone);

  const liveIncidents = useIncidentStore(s => s.liveIncidents);

  // ── Load GeoJSON for current floor ────────────────────────────────────────
  const allFloors = useMemo(() => getAllLocalFloors(), []);
  const floorKeys = Object.keys(allFloors);
  const geojson = allFloors[activeFloor];

  // ── Derive danger from live incidents ─────────────────────────────────────
  const dangerZones = useMemo(() => deriveDangerZones(liveIncidents, SEED_ZONES), [liveIncidents]);
  const dangerMap = useMemo(() => {
    const m = new Map();
    for (const dz of dangerZones) m.set(dz.zoneId, dz);
    return m;
  }, [dangerZones]);

  // ── Detect calamity from live incidents (any severity >= 8) ───────────────
  const isCalamity = useMemo(() =>
    liveIncidents.some(i => i.status !== 'resolved' && i.severity >= 8), [liveIncidents]);

  // ── Blocked zones for pathfinding ─────────────────────────────────────────
  const blockedZoneIds = useMemo(() => {
    const blocked = new Set();
    for (const inc of liveIncidents) {
      if (inc.status === 'resolved') continue;
      if (inc.severity >= 7) {
        if (geojson) {
          for (const f of geojson.features) {
            const loc = inc.location.toLowerCase();
            const name = f.properties.name.toLowerCase();
            if (loc.includes(name) || name.includes(loc.split(',')[0]?.trim())) {
              blocked.add(f.properties.id);
            }
          }
        }
      }
    }
    return blocked;
  }, [liveIncidents, geojson]);

  // ── Multi-floor evacuation route ──────────────────────────────────────────
  const evacRoute = useMemo(() => {
    if (!showEvacRoute || !selectedZone) return null;
    const graph = getMultiFloorGraph();
    const nodeEntry = Object.entries(graph.nodes).find(([_, n]) => n.zoneId === selectedZone);
    if (!nodeEntry) return null;

    return findMultiFloorRoute(nodeEntry[0], { isCalamity, blockedZones: blockedZoneIds });
  }, [showEvacRoute, selectedZone, activeFloor, blockedZoneIds, isCalamity]);

  if (!geojson) return <div style={{ color: '#666', padding: 20 }}>No floor plan data for this level.</div>;

  // ── Classify features ─────────────────────────────────────────────────────
  const rooms = geojson.features.filter(f => ['room', 'suite', 'lobby', 'restaurant', 'shop', 'lounge', 'conference', 'garden', 'kitchen', 'utility', 'pool', 'gym', 'bar'].includes(f.properties.type));
  const corridors = filterByType(geojson, 'hallway');
  const stairs = filterByType(geojson, 'stair');
  const exits = filterByType(geojson, 'exit');
  const elevators = filterByType(geojson, 'elevator');

  const getZoneDangerColor = (zoneId, zoneName) => {
    for (const incident of liveIncidents) {
      if (incident.status === 'resolved') continue;
      const loc = incident.location.toLowerCase();
      const name = zoneName.toLowerCase();
      if (loc.includes(name) || name.includes(loc.split(',')[0]?.trim())) {
        if (incident.severity >= 8) return { color: DANGER_COLORS.critical, level: 'CRITICAL', pulse: true };
        if (incident.severity >= 5) return { color: DANGER_COLORS.danger, level: 'DANGER', pulse: true };
        return { color: DANGER_COLORS.caution, level: 'CAUTION', pulse: false };
      }
    }
    const danger = dangerMap.get(zoneId);
    if (danger) return { color: DANGER_COLORS[danger.level], level: danger.level.toUpperCase(), pulse: danger.level === 'critical' };
    return null;
  };

  const handleZoneClick = (feature) => {
    const id = feature.properties.id;
    setSelectedZone(id === selectedZone ? null : id);
    if (onZoneClick) onZoneClick({ id, name: feature.properties.name, type: feature.properties.type });
  };

  const viewport = geojson.metadata?.viewport ?? { width: 680, height: 400 };

  return (
    <div className="floorplan-container">
      {/* ── SVG Map ──────────────────────────────────────────────────── */}
      <div className="floorplan-viewport">
        <svg viewBox={`0 0 ${viewport.width} ${viewport.height}`} className="floorplan-svg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
            </pattern>
            <filter id="dangerGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Neon green glow for evacuation paths */}
            <filter id="routeGlow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id="avatarClip">
              <circle cx="10" cy="10" r="10" />
            </clipPath>
          </defs>

          {/* Background */}
          <rect width={viewport.width} height={viewport.height} fill="#111116" />
          <rect width={viewport.width} height={viewport.height} fill="url(#grid)" />
          <rect x="40" y="40" width={viewport.width - 80} height={viewport.height - 60} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" rx="4" />

          {/* ── Corridors ────────────────────────────────────────────── */}
          {corridors.map(f => {
            const r = featureToRect(f);
            return <rect key={f.properties.id} x={r.x} y={r.y} width={r.w} height={r.h}
              fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />;
          })}

          {/* ── Rooms / Zones ────────────────────────────────────────── */}
          {rooms.map(f => {
            const p = f.properties;
            const r = featureToRect(f);
            const danger = getZoneDangerColor(p.id, p.name);
            const isHovered = hoveredZone === p.id;
            const isSelected = selectedZone === p.id;
            const isRoom = p.type === 'room' || p.type === 'suite';
            const fillColor = danger ? danger.color : isHovered ? '#3f3f46' : isSelected ? '#3b3b45' : (p.color || '#252530');
            const fillOpacity = danger ? 0.35 : isHovered ? 1 : 0.9;
            
            // Check if any staff is here
            const staffIncident = liveIncidents.find(inc => 
              (inc.status === 'reached' || inc.status === 'en_route') && 
              inc.location && inc.location.toLowerCase().includes(p.name.toLowerCase())
            );

            return (
              <g key={p.id}
                onMouseEnter={() => setHoveredZone(p.id)}
                onMouseLeave={() => setHoveredZone(null)}
                onClick={() => handleZoneClick(f)}
                style={{ cursor: 'pointer' }}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h}
                  fill={fillColor} fillOpacity={fillOpacity}
                  stroke={danger ? danger.color : isSelected ? '#8b5cf6' : isHovered ? '#71717a' : 'rgba(255,255,255,0.08)'}
                  strokeWidth={isSelected ? 2 : danger ? 1.5 : 0.7} rx="3"
                  filter={danger?.pulse ? 'url(#dangerGlow)' : undefined} />
                {danger?.pulse && (
                  <rect x={r.x} y={r.y} width={r.w} height={r.h}
                    fill={danger.color} fillOpacity="0.15" rx="3" className="danger-pulse-rect" />
                )}
                
                {staffIncident && staffIncident.status === 'reached' && (
                  <g transform={`translate(${r.x + r.w / 2 - 10}, ${r.y + r.h / 2 - 18})`}>
                    <circle cx="10" cy="10" r="10" fill="#18181b" stroke="#10b981" strokeWidth="1.5" />
                    {staffIncident.assignedStaffPhotoUrl ? (
                      <image href={staffIncident.assignedStaffPhotoUrl} x="0" y="0" width="20" height="20" clipPath="url(#avatarClip)" preserveAspectRatio="xMidYMid slice" />
                    ) : (
                      <text x="10" y="11" fill="#fff" fontSize="10" textAnchor="middle" dominantBaseline="middle" fontFamily="var(--font-display)" fontWeight="700">
                        {staffIncident.assignedTo?.charAt(0)}
                      </text>
                    )}
                    <circle cx="17" cy="17" r="3" fill="#10b981" />
                  </g>
                )}

                <text x={r.x + r.w / 2} y={r.y + r.h / 2 + (isRoom && staffIncident ? 6 : isRoom ? 0 : -5)}
                  fill={danger ? '#fff' : isHovered ? '#fafafa' : '#a1a1aa'}
                  fontSize={isRoom ? 11 : r.w < 80 ? 8 : 10}
                  fontFamily="'Space Grotesk', sans-serif" fontWeight={isRoom ? 600 : 500}
                  textAnchor="middle" dominantBaseline="middle">
                  {p.name}
                </text>
                {!isRoom && r.w >= 100 && (
                  <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 12}
                    fill="rgba(161,161,170,0.5)" fontSize="7"
                    fontFamily="'JetBrains Mono', monospace" fontWeight="500"
                    textAnchor="middle" dominantBaseline="middle" letterSpacing="1">
                    {p.type.toUpperCase()}
                  </text>
                )}
                {danger && !staffIncident && (
                  <rect x={r.x + r.w - 6} y={r.y - 4} width={8} height={8}
                    fill={danger.color} rx="4" />
                )}
              </g>
            );
          })}

          {/* ── Stairs ───────────────────────────────────────────────── */}
          {stairs.map(f => {
            const r = featureToRect(f);
            return (
              <g key={f.properties.id}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(59,130,246,0.12)"
                  stroke="rgba(59,130,246,0.4)" strokeWidth="1" rx="4" strokeDasharray="3 2" />
                <path d={`M${r.x + 10} ${r.y + r.h - 8} L${r.x + 14} ${r.y + r.h - 14} L${r.x + 18} ${r.y + r.h - 8} L${r.x + 22} ${r.y + 12} L${r.x + 26} ${r.y + 18} L${r.x + 26} ${r.y + 6}`}
                  fill="none" stroke="rgba(59,130,246,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                <text x={r.x + r.w / 2} y={r.y + r.h + 12} fill="rgba(59,130,246,0.6)" fontSize="7"
                  fontFamily="'JetBrains Mono', monospace" textAnchor="middle" letterSpacing="0.5">
                  {f.properties.name}
                </text>
              </g>
            );
          })}

          {/* ── Exits ────────────────────────────────────────────────── */}
          {exits.map(f => {
            const r = featureToRect(f);
            const cx = r.x + r.w / 2;
            const cy = r.y + r.h / 2;
            return (
              <g key={f.properties.id}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(16,185,129,0.15)"
                  stroke="rgba(16,185,129,0.5)" strokeWidth="1.5" rx="4" />
                <path d={`M${cx - 4} ${cy} L${cx + 4} ${cy} M${cx + 1} ${cy - 4} L${cx + 5} ${cy} L${cx + 1} ${cy + 4}`}
                  fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
                <text x={cx} y={r.y + r.h + 14} fill="rgba(16,185,129,0.6)" fontSize="7"
                  fontFamily="'JetBrains Mono', monospace" textAnchor="middle" letterSpacing="0.5">
                  {f.properties.name}
                </text>
              </g>
            );
          })}

          {/* ── Elevators ────────────────────────────────────────────── */}
          {elevators.map(f => {
            const r = featureToRect(f);
            const cx = r.x + r.w / 2;
            const cy = r.y + r.h / 2;
            return (
              <g key={f.properties.id}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h}
                  fill="rgba(245,158,11,0.12)" stroke="rgba(245,158,11,0.4)" strokeWidth="1" rx="4" />
                <path d={`M${cx - 4} ${cy - 5} L${cx} ${cy - 9} L${cx + 4} ${cy - 5}`}
                  fill="none" stroke="rgba(245,158,11,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                <path d={`M${cx - 4} ${cy + 5} L${cx} ${cy + 9} L${cx + 4} ${cy + 5}`}
                  fill="none" stroke="rgba(245,158,11,0.7)" strokeWidth="1.5" strokeLinecap="round" />
                <text x={cx} y={r.y + r.h + 14} fill="rgba(245,158,11,0.5)" fontSize="7"
                  fontFamily="'JetBrains Mono', monospace" textAnchor="middle" letterSpacing="0.5">
                  Elevator
                </text>
              </g>
            );
          })}

          {/* ── Evacuation Route (Neon Green Path) — per-floor segment ─── */}
          {evacRoute && (() => {
            // Get the segment for the currently active floor
            const floorNum = parseInt(activeFloor);
            const segment = evacRoute.segments?.find(s => s.floor === floorNum);
            if (!segment || segment.pathCoords.length < 2) return null;
            const svgPath = pathCoordsToSvgPath(segment.pathCoords);
            return (
              <g>
                {/* Glow underlay */}
                <path d={svgPath}
                  fill="none" stroke="#39ff14" strokeWidth="6" strokeOpacity="0.2"
                  strokeLinecap="round" strokeLinejoin="round" filter="url(#routeGlow)" />
                {/* Main path */}
                <path d={svgPath}
                  fill="none" stroke="#39ff14" strokeWidth="2.5" strokeOpacity="0.9"
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="8 4" className="evac-route-animated" />
                {/* Waypoint dots */}
                {segment.pathCoords.map((c, i) => (
                  <circle key={i} cx={c.x} cy={c.y}
                    r={i === 0 ? 5 : i === segment.pathCoords.length - 1 ? 6 : 2.5}
                    fill={i === 0 ? '#8b5cf6' : i === segment.pathCoords.length - 1 ? '#39ff14' : 'rgba(57,255,20,0.5)'}
                    stroke={i === segment.pathCoords.length - 1 ? '#39ff14' : 'none'}
                    strokeWidth="2" strokeOpacity="0.4" />
                ))}
                {/* Start label */}
                <text x={segment.pathCoords[0].x} y={segment.pathCoords[0].y + 16}
                  fill="#8b5cf6" fontSize="7" fontFamily="'JetBrains Mono', monospace" textAnchor="middle">
                  ~{evacRoute.estimatedSeconds}s to exit
                </text>
                {/* End-of-segment label */}
                <text x={segment.pathCoords.at(-1).x} y={segment.pathCoords.at(-1).y - 12}
                  fill="#39ff14" fontSize="8" fontFamily="'JetBrains Mono', monospace"
                  textAnchor="middle" fontWeight="700">
                  {floorNum === 0 ? `EXIT → ${evacRoute.exitLabel}` : '↓ STAIRS DOWN'}
                </text>
              </g>
            );
          })()}

          {/* Floor label watermark */}
          <text x={viewport.width - 40} y={viewport.height - 20} fill="rgba(255,255,255,0.04)" fontSize="48"
            fontFamily="'Space Grotesk', sans-serif" fontWeight="700"
            textAnchor="end" dominantBaseline="auto">
            {geojson.metadata?.short ?? ''}
          </text>
        </svg>
      </div>

      {/* ── Controls ──────────────────────────────────────────────────── */}
      {!hideControls && (
        <div className="floorplan-controls" style={isEvacMode ? { top: 'auto', bottom: 16, right: 16, left: 16, background: 'transparent', boxShadow: 'none', border: 'none', padding: 0 } : {}}>
          <div className="floorplan-level-selector" style={isEvacMode ? { display: 'flex', gap: 8, overflowX: 'auto', background: 'rgba(0,0,0,0.8)', padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' } : {}}>
          {(isEvacMode && evacRoute ? evacRoute.floorsTraversed.map(f => f.toString()) : floorKeys).map(key => (
            <button key={key}
              className={`floorplan-level-btn ${activeFloor === key ? 'active' : ''}`}
              style={isEvacMode ? { padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 700 } : {}}
              onClick={() => { setActiveFloor(key); if (!showEvacRoute) { setSelectedZone(null); } }}>
              {activeFloor === key && !isEvacMode && <span className="floorplan-level-arrow">→</span>}
              {allFloors[key]?.metadata?.label ?? `Level ${key}`}
            </button>
          ))}
        </div>

        {/* Legend */}
        {!isEvacMode && (
          <div className="floorplan-legend">
            <div className="floorplan-legend-title">LEGEND</div>
            <div className="floorplan-legend-item">
              <span className="floorplan-legend-swatch" style={{ background: 'rgba(59,130,246,0.4)', border: '1px dashed rgba(59,130,246,0.6)' }} />
              <span>Stairs</span>
            </div>
            <div className="floorplan-legend-item">
              <span className="floorplan-legend-swatch" style={{ background: 'rgba(16,185,129,0.3)', border: '1px solid rgba(16,185,129,0.5)' }} />
              <span>Exit</span>
            </div>
            <div className="floorplan-legend-item">
              <span className="floorplan-legend-swatch" style={{ background: 'rgba(245,158,11,0.3)', border: '1px solid rgba(245,158,11,0.5)' }} />
              <span>Elevator</span>
            </div>
            <div className="floorplan-legend-item">
              <span className="floorplan-legend-swatch" style={{ background: DANGER_COLORS.critical }} />
              <span>Critical</span>
            </div>
            <div className="floorplan-legend-item">
              <span className="floorplan-legend-swatch" style={{ background: DANGER_COLORS.danger }} />
              <span>Danger</span>
            </div>
            <div className="floorplan-legend-item">
              <span className="floorplan-legend-swatch" style={{ background: DANGER_COLORS.caution }} />
              <span>Caution</span>
            </div>
            {activeFloor === '1' && (
              <div className="floorplan-legend-item">
                <span className="floorplan-legend-swatch" style={{ background: '#39ff14', boxShadow: '0 0 6px #39ff14' }} />
                <span>Evac Route</span>
              </div>
            )}
          </div>
        )}

        {/* Selected zone info + Evac toggle + Step-by-step */}
        {(selectedZone || isEvacMode) && (() => {
          const feature = selectedZone ? geojson.features.find(f => f.properties.id === selectedZone) : null;
          const p = feature ? feature.properties : null;
          const danger = p ? getZoneDangerColor(p.id, p.name) : null;
          return (
            <div className="floorplan-zone-info" style={isEvacMode ? { background: 'rgba(0,0,0,0.8)', border: '1px solid rgba(57,255,20,0.3)', marginTop: 12, padding: 16 } : {}}>
              {!isEvacMode && p && (
                <>
                  <div className="floorplan-zone-info-name">{p.name}</div>
                  <div className="floorplan-zone-info-type">{p.type.toUpperCase()}</div>
                  {p.capacity && <div style={{ color: '#71717a', fontSize: 11 }}>Capacity: {p.capacity}</div>}
                  {danger && (
                    <div className="floorplan-zone-info-danger" style={{ color: danger.color }}>
                      ⚠ {danger.level}
                    </div>
                  )}
                  <button
                    className="evac-route-btn"
                    onClick={(e) => { e.stopPropagation(); setShowEvacRoute(!showEvacRoute); }}
                    style={{
                      marginTop: 8, padding: '4px 10px', fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                      background: showEvacRoute ? '#39ff14' : 'rgba(57,255,20,0.15)',
                      color: showEvacRoute ? '#000' : '#39ff14',
                      border: '1px solid rgba(57,255,20,0.4)', borderRadius: 4, cursor: 'pointer',
                      letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700,
                    }}>
                    {showEvacRoute ? '✕ HIDE ROUTE' : '◈ EVAC TO EXIT'}
                  </button>
                </>
              )}
              {evacRoute && (
                <div style={{ marginTop: isEvacMode ? 0 : 8, fontSize: isEvacMode ? 14 : 10, fontFamily: "'JetBrains Mono', monospace" }}>
                  <div style={{ color: '#39ff14', marginBottom: 8, fontWeight: 700, fontSize: isEvacMode ? 16 : 10 }}>
                    → {evacRoute.exitLabel} · ~{evacRoute.estimatedSeconds}s
                  </div>
                  {evacRoute.floorsTraversed?.length > 1 && !isEvacMode && (
                    <div style={{ color: '#f59e0b', marginBottom: 6, fontSize: 9 }}>
                      ⚡ MULTI-FLOOR: {evacRoute.floorsTraversed.map(f => f === 0 ? 'G' : `F${f}`).join(' → ')}
                    </div>
                  )}
                  {isCalamity && (
                    <div style={{ color: '#ef4444', marginBottom: 6, fontSize: isEvacMode ? 12 : 9, fontWeight: 700 }}>
                      🔴 CALAMITY MODE — ELEVATORS BLOCKED
                    </div>
                  )}
                  {/* Step-by-step instructions */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginTop: 8 }}>
                    <div style={{ color: '#71717a', fontSize: isEvacMode ? 10 : 8, marginBottom: 8, letterSpacing: 1 }}>EVACUATION INSTRUCTIONS</div>
                    {evacRoute.instructions?.map((step, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8,
                        color: step.type === 'floor_change' ? '#f59e0b' : step.type === 'exit' ? '#39ff14' : '#e4e4e7',
                        fontSize: isEvacMode ? (step.type === 'floor_change' ? 14 : 13) : (step.type === 'floor_change' ? 10 : 9),
                        fontWeight: step.type === 'floor_change' || step.type === 'exit' ? 700 : 500,
                      }}>
                        <span style={{ flexShrink: 0 }}>{step.icon}</span>
                        <span>{step.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

          {/* Data source indicator */}
          {!isEvacMode && (
            <div style={{ marginTop: 12, fontSize: 9, color: '#52525b', fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5 }}>
              SRC: GEOJSON · {geojson.features.length} features · {isCalamity ? '🔴 CALAMITY' : '🟢 NORMAL'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
