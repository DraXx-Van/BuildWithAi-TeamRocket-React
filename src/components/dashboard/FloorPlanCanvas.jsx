import { useState, useEffect, useRef } from 'react';
import useIncidentStore from '../../store/useIncidentStore';
import { severityColor } from '../../models/incident';
import { analyzeBlueprint } from '../../services/geminiService';

const FLOOR_SPACING = 2500; // CAD-style horizontal spacing between floor plans

const ARCH_ELEMENTS = [
  { 
    type: 'room', label: 'Room', color: '#8b5cf6',
    icon: (color) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      </svg>
    )
  },
  { 
    type: 'path', label: 'Path', color: '#71717a',
    icon: (color) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3v18M17 3v18"/>
      </svg>
    )
  },
  { 
    type: 'stair', label: 'Stairs', color: '#f59e0b',
    icon: (color) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 20h4v-4h4v-4h4v-4"/>
      </svg>
    )
  },
  { 
    type: 'elevator', label: 'Lift', color: '#06b6d4',
    icon: (color) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="m9 10 3-3 3 3M9 14l3 3 3-3"/>
      </svg>
    )
  },
  { 
    type: 'exit', label: 'Exit', color: '#10b981',
    icon: (color) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
      </svg>
    )
  },
  { 
    type: 'entry', label: 'Entry', color: '#10b981',
    icon: (color) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l-5-5 5-5M11 12h10"/>
      </svg>
    )
  },
];

export default function FloorPlanCanvas({ fullBleed = false }) {
  const { 
    liveIncidents, zones: storeZones, saveZones, 
    isScanning, setScanning, 
    currentFloor, floors, setCurrentFloor, addFloor, removeFloor,
    confirmDispatch, setDispatchResult
  } = useIncidentStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [localZones, setLocalZones] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectionBox, setSelectionBox] = useState(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const containerRef = useRef(null);

  // Modal State
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [deletingZoneId, setDeletingZoneId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');

  // AI Scanner State
  const [showAiModal, setShowAiModal] = useState(false);
  const [statusPopupId, setStatusPopupId] = useState(null);
  const fileInputRef = useRef(null);

  // Infinite Canvas Pan & Zoom State
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panInfo, setPanInfo] = useState(null);
  const [zoom, setZoom] = useState(1);

  // Sync with store when entering edit mode, or just display store zones directly when not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalZones(storeZones);
    }
  }, [storeZones, isEditing]);

  const toggleEdit = () => {
    if (isEditing) {
      // User clicked save
      saveZones(localZones);
      setSelectedIds([]);
      // Auto-focus on current floor after saving
      focusOnFloor(currentFloor);
    } else {
      // Enter edit mode
      setLocalZones([...storeZones]);
    }
    setIsEditing(!isEditing);
  };

  const focusOnFloor = (floorId) => {
    const floorIndex = floors.indexOf(floorId);
    if (floorIndex === -1) return;
    
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (containerRect) {
      const currentZones = isEditing ? localZones : storeZones;
      const floorZones = currentZones.filter(z => {
        if (z.floor) return z.floor === floorId;
        if (floorId === '1' && !z.floor) return true;
        return false;
      });
      
      let centerX = 500;
      let centerY = 500;
      
      if (floorZones.length > 0) {
        const minX = Math.min(...floorZones.map(z => z.left));
        const maxX = Math.max(...floorZones.map(z => z.left + z.width));
        const minY = Math.min(...floorZones.map(z => z.top));
        const maxY = Math.max(...floorZones.map(z => z.top + z.height));
        centerX = (minX + maxX) / 2;
        centerY = (minY + maxY) / 2;
      }
      
      const targetX = (floorIndex * FLOOR_SPACING) + centerX;
      const targetY = centerY; 
      
      const newZoom = 0.7; // Slightly zoomed out
      setZoom(newZoom);
      
      setPan({ 
        x: (containerRect.width / 2) - (targetX * newZoom), 
        y: (containerRect.height / 2) - (targetY * newZoom) 
      });
    }
  };

  useEffect(() => {
    focusOnFloor(currentFloor);
  }, [currentFloor, floors]); // Re-focus when floors list or selection changes

  const deleteZones = (ids) => {
    if (!ids || ids.length === 0) return;
    setLocalZones(prev => prev.filter(z => !ids.includes(z.id)));
    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    setDeletingZoneId(null);
  };

  const confirmDeleteZone = () => {
    if (deletingZoneId) {
      deleteZones([deletingZoneId]);
    }
  };

  const handleScanBlueprint = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    console.log('[SCANNER] Starting AI Reconstruction (V2 - Multi-Floor Logic)');
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result.split(',')[1];
        const generatedZones = await analyzeBlueprint(base64String);
        
        // Integrate AI zones into the multi-floor system
        const processedZones = generatedZones.map(z => ({
          ...z,
          id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          // Use AI detected floor, else fallback to current
          floor: (z.floor || currentFloor).toString().toLowerCase(),
          type: z.type || 'room',
          subtitle: z.subtitle || `Auto-generated ${z.type}`
        }));

        // Dynamically add new floors to the store if AI detected them
        const detectedFloors = [...new Set(processedZones.map(z => z.floor))];
        detectedFloors.forEach(f => {
          // Use a direct store check if possible, or trust the addFloor logic
          addFloor(f); 
        });
        
        // Merge with existing local zones (avoiding duplicates on the same floor if re-scanning)
        setLocalZones(prev => [...prev, ...processedZones]);
        setShowAiModal(false);
        if (!isEditing) setIsEditing(true);
        console.log(`[SCANNER] Successfully mapped ${processedZones.length} tactical zones across ${detectedFloors.length} floors.`);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('[SCANNER] Critical Failure:', err);
      alert('AI Reconstruction failed. Please check network and blueprint format.');
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addZone = (type = 'room') => {
    const el = ARCH_ELEMENTS.find(e => e.type === type) || ARCH_ELEMENTS[0];
    const newZone = {
      id: `zone-${Date.now()}`,
      label: `New ${el.label}`,
      subtitle: `Level ${currentFloor}`,
      floor: currentFloor, // Robust floor identification
      top: 100,
      left: 100,
      width: type === 'path' ? 200 : 120,
      height: type === 'path' ? 40 : 100,
      type: type
    };
    setLocalZones([...localZones, newZone]);
    setSelectedIds([newZone.id]);
  };



  const openEditModal = (zone) => {
    setEditingZoneId(zone.id);
    setEditLabel(zone.label);
    setEditSubtitle(zone.subtitle);
  };

  const saveEditZone = () => {
    setLocalZones(localZones.map(z => z.id === editingZoneId ? { ...z, label: editLabel, subtitle: editSubtitle } : z));
    setEditingZoneId(null);
  };

  // Drag and Resize State for Zones
  const [dragInfo, setDragInfo] = useState(null);

  const startDrag = (e, id, isResize) => {
    if (!isEditing) return;
    e.stopPropagation();
    if (e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);
    
    if (!selectedIds.includes(id)) {
      setSelectedIds([id]);
    }
    
    setDragInfo({
      id,
      isResize,
      startX: e.clientX,
      startY: e.clientY,
      initialZones: JSON.parse(JSON.stringify(localZones)),
      pointerId: e.pointerId
    });
  };

  const startPan = (e) => {
    if (e.button !== 0) return; // Only left click
    
    // If clicking a zone, don't start pan
    if (e.target.closest('.tactical-zone')) return;

    if (isEditing && (isSelectionMode || e.shiftKey)) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom;
      const y = (e.clientY - rect.top - pan.y) / zoom;
      setPanInfo({ 
        type: 'select',
        startX: x,
        startY: y,
        pointerId: e.pointerId,
        hasMoved: false
      });
      if (!e.shiftKey) setSelectedIds([]);
    } else {
      // Clear selection on background click unless shift is held
      if (isEditing && !e.shiftKey) setSelectedIds([]);
      
      setPanInfo({ 
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        initialPan: { ...pan },
        pointerId: e.pointerId,
        hasMoved: false
      });
    }
    
    if (e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (panInfo) {
      if (Math.abs(e.clientX - panInfo.startX) > 3 || Math.abs(e.clientY - panInfo.startY) > 3) {
        setPanInfo(prev => ({ ...prev, hasMoved: true }));
      }

      if (panInfo.type === 'select') {
        const rect = containerRef.current.getBoundingClientRect();
        const currentX = (e.clientX - rect.left - pan.x) / zoom;
        const currentY = (e.clientY - rect.top - pan.y) / zoom;
        
        const x = Math.min(panInfo.startX, currentX);
        const y = Math.min(panInfo.startY, currentY);
        const w = Math.abs(panInfo.startX - currentX);
        const h = Math.abs(panInfo.startY - currentY);
        
        setSelectionBox({ x, y, w, h });
        
        // Auto-select zones within box
        const inBox = localZones.filter(z => (
          z.left >= x && z.left + z.width <= x + w &&
          z.top >= y && z.top + z.height <= y + h
        )).map(z => z.id);
        setSelectedIds(inBox);
        return;
      }

      const dx = e.clientX - panInfo.startX;
      const dy = e.clientY - panInfo.startY;
      setPan({ x: panInfo.initialPan.x + dx, y: panInfo.initialPan.y + dy });
      return;
    }

    if (dragInfo) {
      const dx = (e.clientX - dragInfo.startX) / zoom;
      const dy = (e.clientY - dragInfo.startY) / zoom;

      setLocalZones(dragInfo.initialZones.map(z => {
        if (z.id === dragInfo.id) {
          if (dragInfo.isResize) {
            return {
              ...z,
              width: Math.max(50, z.width + dx),
              height: Math.max(50, z.height + dy)
            };
          } else {
            return {
              ...z,
              left: z.left + dx,
              top: z.top + dy
            };
          }
        }
        return z;
      }));
    }
  };

  const handlePointerUp = (e) => {
    if (panInfo && e.target.releasePointerCapture) {
      try { e.target.releasePointerCapture(panInfo.pointerId); } catch(err){}
    }
    if (dragInfo && e.target.releasePointerCapture) {
      try { e.target.releasePointerCapture(dragInfo.pointerId); } catch(err){}
    }
    setDragInfo(null);
    setPanInfo(null);
    setSelectionBox(null);
  };

  const allZones = isEditing ? localZones : storeZones;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Toolbar */}
      <div 
        onPointerDown={(e) => e.stopPropagation()}
        style={{ position: 'absolute', top: 12, right: 12, zIndex: 1100, display: 'flex', gap: 8 }}
      >
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleScanBlueprint} 
        />
        <button 
          onClick={() => setShowAiModal(true)} 
          style={{ padding: '6px 12px', background: 'var(--color-primary)', color: 'white', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ✨ SCAN BLUEPRINT
        </button>

        {isEditing && (
          <button 
            onClick={() => setIsSelectionMode(!isSelectionMode)} 
            style={{ padding: '6px 12px', background: isSelectionMode ? 'var(--color-primary)' : 'var(--color-surface-3)', color: 'white', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {isSelectionMode ? '🔍 SELECT MODE' : '🖐️ PAN MODE'}
          </button>
        )}
        {isEditing && (
          <button onClick={() => addZone()} style={{ padding: '6px 12px', background: 'var(--color-surface-3)', color: 'white', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid var(--color-border)', cursor: 'pointer' }}>
            + ADD ZONE
          </button>
        )}
        <button 
          onClick={toggleEdit}
          style={{ 
            padding: '6px 16px', 
            background: isEditing ? 'var(--color-success)' : 'var(--color-surface-3)', 
            color: 'white', 
            borderRadius: 6, 
            fontSize: 11, 
            fontWeight: 800,
            border: isEditing ? 'none' : '1px solid var(--color-border)',
            cursor: 'pointer',
            boxShadow: isEditing ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'none'
          }}
        >
          {isEditing ? '✓ SAVE PLAN' : '✎ EDIT PLAN'}
        </button>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef}
        onWheel={(e) => {
          const zoomDelta = e.deltaY > 0 ? -0.05 : 0.05;
          setZoom(z => Math.max(0.2, Math.min(3, z + zoomDelta)));
        }}
        onPointerDown={startPan}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={(e) => {
          if (isEditing && panInfo && !panInfo.hasMoved) {
            setSelectedIds([]);
          }
        }}
        style={{
          position: 'relative',
          flex: 1,
          background: 'var(--color-bg)',
          borderRadius: fullBleed ? 0 : 'var(--radius-lg)',
          border: isEditing ? '2px dashed var(--color-primary)' : fullBleed ? 'none' : '1px solid var(--color-border)',
          overflow: 'hidden',
          backgroundImage: 'radial-gradient(rgba(161, 161, 170, 0.1) 1px, transparent 1px)',
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          cursor: panInfo ? 'grabbing' : isEditing ? (isSelectionMode ? 'crosshair' : 'default') : 'grab',
          touchAction: 'none'
        }}
      >
        {/* Lasso Selection Box */}
        {selectionBox && (
          <div style={{
            position: 'absolute',
            left: selectionBox.x * zoom + pan.x,
            top: selectionBox.y * zoom + pan.y,
            width: selectionBox.w * zoom,
            height: selectionBox.h * zoom,
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1.5px solid var(--color-primary)',
            borderRadius: 4,
            zIndex: 1000,
            pointerEvents: 'none'
          }} />
        )}

        <div id="pan-layer" style={{ 
          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, 
          transformOrigin: '0 0'
        }}>
          {floors.map((floorId, fIndex) => (
            <div 
              key={floorId} 
              id={`floor-container-${floorId}`}
              style={{ 
                position: 'absolute', 
                left: fIndex * FLOOR_SPACING, 
                top: 0,
                width: 2000, 
                height: 2000,
                border: isEditing ? '1px dashed rgba(255,255,255,0.05)' : 'none',
                pointerEvents: 'none' 
              }}
            >
              {/* Floor Label Overlay */}
              <div style={{ position: 'absolute', top: -50, left: 0, color: 'white', fontSize: 24, fontWeight: 900, letterSpacing: 8, opacity: 0.1, pointerEvents: 'none', fontFamily: 'var(--font-display)' }}>
                FLOOR {floorId.toUpperCase()}
              </div>

              {allZones.filter(z => {
                if (z.floor) return z.floor === floorId;
                if (floorId === '1' && !z.floor) return true;
                return false;
              }).map(zone => {
                const activeIncident = liveIncidents.find(i => {
                  const loc = i.location.toLowerCase();
                  const label = zone.label.toLowerCase();
                  
                  // Helper for digit-to-word matching (e.g. "7" vs "seven")
                  const digitMap = { '1':'one', '2':'two', '3':'three', '4':'four', '5':'five', '6':'six', '7':'seven', '8':'eight', '9':'nine' };
                  const normalize = (s) => {
                    let out = s.replace(/room|number|zone|floor/g, '').trim();
                    Object.entries(digitMap).forEach(([d, w]) => {
                      out = out.replace(new RegExp(`\\b${w}\\b`, 'g'), d);
                    });
                    return out;
                  };

                  const normLoc = normalize(loc);
                  const normLabel = normalize(label);
                  
                  // Floor check first
                  const incidentFloor = i.location.match(/floor\s*(\d+)/i)?.[1] || i.location.match(/floor\s*(one|two|three|four)/i)?.[1] || '1';
                  const zoneFloor = (zone.floor || '1').toString().toLowerCase();
                  const floorMatch = incidentFloor.includes(zoneFloor) || zoneFloor.includes(normalize(incidentFloor));

                  if (!floorMatch) return false;

                  return normLoc.includes(normLabel) || normLabel.includes(normLoc) || i.id.includes(zone.id);
                });
                
                const isAlert = Boolean(activeIncident) && !isEditing;
                const color = isAlert ? severityColor(activeIncident.severity) : 'var(--color-surface-3)';
                const isSelected = selectedIds.includes(zone.id) && isEditing;
                const type = (zone.type || 'room').toLowerCase();
                const archElement = ARCH_ELEMENTS.find(e => e.type === type) || ARCH_ELEMENTS[0];
                const baseColor = archElement.color;

                // Architectural Logic
                let bgImage = 'none';
                let bgColor = 'rgba(20, 20, 22, 0.7)';
                let customBorder = `1.5px solid ${baseColor}66`;
                let customBgSize = 'auto';
                
                if (type === 'stair') {
                  bgImage = `repeating-linear-gradient(45deg, transparent, transparent 8px, ${baseColor}15 8px, ${baseColor}15 16px)`;
                  bgColor = 'rgba(20, 20, 22, 0.8)';
                } else if (type === 'path') {
                  bgImage = `repeating-linear-gradient(90deg, transparent, transparent 20px, ${baseColor}08 20px, ${baseColor}08 21px)`;
                  bgColor = 'rgba(20, 20, 22, 0.4)';
                  customBorder = `1.5px dashed ${baseColor}44`;
                } else if (type === 'room') {
                  bgImage = `linear-gradient(135deg, rgba(20, 20, 22, 0.8) 0%, rgba(30, 30, 35, 0.9) 100%)`;
                  customBorder = `2px solid ${baseColor}88`;
                } else if (type === 'elevator') {
                  bgImage = `linear-gradient(45deg, ${baseColor}05 25%, transparent 25%, transparent 75%, ${baseColor}05 75%, ${baseColor}05), linear-gradient(45deg, ${baseColor}05 25%, transparent 25%, transparent 75%, ${baseColor}05 75%, ${baseColor}05)`;
                  bgColor = 'rgba(20, 20, 22, 0.9)';
                  customBgSize = '10px 10px';
                }

                if (isAlert) {
                  bgImage = `radial-gradient(circle at center, ${color}15 0%, transparent 100%)`;
                  bgColor = 'rgba(10, 10, 12, 0.4)'; // Darker, more transparent
                }

                return (
                  <div 
                    key={zone.id} 
                    className="tactical-zone"
                    onPointerDown={(e) => {
                      e.stopPropagation(); // Always stop propagation to prevent canvas panning
                      if (!isEditing) {
                        // Allow selection for visual feedback even in view mode
                        setSelectedIds([zone.id]);
                        return;
                      }
                      
                      if (e.shiftKey || isSelectionMode) {
                        setSelectedIds(prev => prev.includes(zone.id) ? prev.filter(id => id !== zone.id) : [...prev, zone.id]);
                      } else {
                        setSelectedIds([zone.id]);
                        startDrag(e, zone.id, false);
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Open status popup if it's an alert
                      if (isAlert) setStatusPopupId(zone.id);
                    }}
                    style={{
                      position: 'absolute', top: zone.top, left: zone.left, width: zone.width, height: zone.height,
                      pointerEvents: 'auto', borderRadius: type === 'path' ? 4 : 12, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 6,
                      // ONLY border effect for selection, no BG change
                      border: isSelected ? '2.5px solid #fff' : isAlert ? `2px solid ${color}` : customBorder,
                      backgroundImage: bgImage,
                      backgroundColor: bgColor,
                      backgroundSize: customBgSize,
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                      backdropFilter: isAlert ? 'blur(4px)' : 'blur(12px)',
                      transition: dragInfo ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      animation: isAlert && activeIncident?.severity >= 8 ? 'criticalPulse 1.5s infinite' : isAlert ? 'pulseAlert 3s infinite' : 'none',
                      // High-intensity border glow for alerts, simple border for selection
                      boxShadow: isAlert 
                        ? `0 0 60px ${color}44, inset 0 0 30px ${color}22` 
                        : isSelected ? '0 0 20px rgba(255,255,255,0.4)' : `0 8px 32px rgba(0,0,0,0.5)`,
                      cursor: isEditing ? 'move' : (isAlert ? 'pointer' : 'default'), zIndex: isAlert ? 50 : isSelected ? 10 : 1,
                    }}
                  >
                    {/* Alert Badge */}
                    {isAlert && activeIncident && (
                      <div style={{ position: 'absolute', top: -12, right: -12, background: color, color: 'white', padding: '4px 10px', borderRadius: 8, fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6, boxShadow: `0 4px 15px ${color}66`, border: '1px solid rgba(255,255,255,0.2)', zIndex: 100 }}>
                        <span style={{ fontSize: 10 }}>●</span>
                        {(activeIncident?.hazard || 'INCIDENT').toUpperCase()}
                      </div>
                    )}
                    {/* CAD Corner Markers for Rooms */}
                    {type === 'room' && !isAlert && (
                      <>
                        <div style={{ position: 'absolute', top: 4, left: 4, width: 8, height: 8, borderTop: `2px solid ${baseColor}`, borderLeft: `2px solid ${baseColor}`, opacity: 0.5 }} />
                        <div style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderTop: `2px solid ${baseColor}`, borderRight: `2px solid ${baseColor}`, opacity: 0.5 }} />
                        <div style={{ position: 'absolute', bottom: 4, left: 4, width: 8, height: 8, borderBottom: `2px solid ${baseColor}`, borderLeft: `2px solid ${baseColor}`, opacity: 0.5 }} />
                        <div style={{ position: 'absolute', bottom: 4, right: 4, width: 8, height: 8, borderBottom: `2px solid ${baseColor}`, borderRight: `2px solid ${baseColor}`, opacity: 0.5 }} />
                      </>
                    )}

                    {/* Icon - Hidden for Rooms */}
                    {type !== 'room' && (
                      <div style={{ opacity: isAlert ? 1 : 0.9, transform: 'scale(1.2)', filter: `drop-shadow(0 0 8px ${baseColor}44)` }}>
                        {archElement.icon(isAlert ? 'white' : baseColor)}
                      </div>
                    )}
                    <div style={{ 
                      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 900, 
                      color: isAlert ? 'white' : isSelected ? 'white' : baseColor, 
                      textAlign: 'center', letterSpacing: 1.2, padding: '0 8px',
                      textShadow: isAlert ? `0 0 10px ${color}` : `0 0 5px ${baseColor}44`,
                      textTransform: 'uppercase', opacity: 1,
                      lineHeight: 1.2, width: '100%', wordBreak: 'break-word'
                    }}>
                      {zone.label}
                    </div>

                    {/* Contextual Tactical Overlay (Floating HUD) - Top-Right Positioning */}
                    {!isEditing && statusPopupId === zone.id && activeIncident && (
                      <div 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute', bottom: 'calc(100% + 40px)', left: 'calc(100% - 60px)',
                          width: 280, background: 'rgba(15,15,18,0.98)', border: `1px solid ${color}`,
                          borderRadius: 20, padding: 20, boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 30px ${color}22`,
                          zIndex: 5000, pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 14,
                          animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                          backdropFilter: 'blur(20px)'
                        }}
                      >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, animation: 'pulse 1s infinite' }} />
                            <span style={{ fontSize: 8, fontWeight: 900, color: color, letterSpacing: 1.5 }}>LIVE INTEL</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setStatusPopupId(null); }} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14 }}>✕</button>
                        </div>

                        <div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: 'white', lineHeight: 1.1 }}>{(activeIncident?.hazard || 'INCIDENT').toUpperCase()}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{zone.label.toUpperCase()}</div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: 7, fontWeight: 800, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>SEVERITY</div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: color }}>LVL {activeIncident?.severity || 0}/10</div>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: 7, fontWeight: 800, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>STATUS</div>
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>ACTIVE</div>
                          </div>
                        </div>

                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, background: 'rgba(0,0,0,0.2)', padding: 10, borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)', maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          "{activeIncident?.description || 'No description available.'}"
                        </div>

                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (activeIncident && activeIncident.dispatchSuggestion) {
                              setDispatchResult(activeIncident.dispatchSuggestion, activeIncident.id);
                              confirmDispatch();
                            }
                            setStatusPopupId(null); 
                          }}
                          style={{ width: '100%', padding: '10px', background: color, color: 'white', borderRadius: 10, border: 'none', fontWeight: 900, cursor: 'pointer', fontSize: 10, letterSpacing: 1 }}
                        >
                          DEPLOY ASSETS
                        </button>
                        
                        {/* Pointer Arrow - Bottom-Left pointing down-right to zone */}
                        <div style={{ position: 'absolute', bottom: -8, left: 30, width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: `10px solid ${color}` }} />
                      </div>
                    )}

                    {/* Resize Handle */}
                    {isEditing && isSelected && (
                      <div 
                        onPointerDown={(e) => startDrag(e, zone.id, true)}
                        style={{ 
                          position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, 
                          cursor: 'nwse-resize', borderRight: '3px solid white', borderBottom: '3px solid white',
                          opacity: 0.8, zIndex: 100, transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                      />
                    )}
                    
                    {isSelected && selectedIds.length === 1 && (
                      <div 
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ position: 'absolute', top: -45, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 8, display: 'flex', gap: 4, padding: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 100 }}
                      >
                        <button onClick={(e) => { e.stopPropagation(); openEditModal(zone); }} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-hi)', fontSize: 11, cursor: 'pointer', padding: '6px 10px', fontWeight: 600 }}>✏️ Edit</button>
                        <button onClick={(e) => { e.stopPropagation(); deleteZones([zone.id]); }} style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', fontSize: 11, cursor: 'pointer', padding: '6px 10px', fontWeight: 600 }}>🗑️ Delete</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Right Controls */}
      <div style={{ position: 'absolute', bottom: 24, right: 24, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={() => setZoom(z => Math.min(3, z + 0.2))} style={{ width: 40, height: 40, background: 'rgba(39,39,42,0.9)', color: 'white', borderRadius: '50%', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} style={{ width: 40, height: 40, background: 'rgba(39,39,42,0.9)', color: 'white', borderRadius: '50%', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
        <button onClick={() => focusOnFloor(currentFloor)} style={{ width: 40, height: 40, background: 'rgba(39,39,42,0.9)', color: 'white', borderRadius: '50%', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎯</button>
      </div>

      {/* ── Floor Management (Left Side) ── */}
      {floors.length > 0 && (
        <div 
          onPointerDown={(e) => e.stopPropagation()}
          style={{ 
            position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', 
            display: 'flex', flexDirection: 'column', gap: 12, 
            background: 'rgba(20,20,22,0.8)', padding: 12, borderRadius: 20, 
            border: '1px solid #27272a', backdropFilter: 'blur(20px)', zIndex: 1100, 
            boxShadow: '0 12px 48px rgba(0,0,0,0.5)' 
          }}
        >
          {floors.map(f => (
            <div key={f} style={{ position: 'relative' }}>
              <button onClick={() => setCurrentFloor(f)} style={{ width: 42, height: 42, borderRadius: 10, border: currentFloor === f ? '2px solid var(--color-primary)' : '1px solid #3f3f46', background: currentFloor === f ? 'rgba(139, 92, 246, 0.15)' : 'transparent', color: currentFloor === f ? 'white' : '#71717a', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>{f.toUpperCase()}</button>
              {isEditing && floors.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); removeFloor(f); }} style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', fontSize: 8, cursor: 'pointer' }}>✕</button>
              )}
            </div>
          ))}
          {isEditing && (
            <button onClick={() => addFloor((floors.length + 1).toString())} style={{ width: 42, height: 42, borderRadius: 10, border: '1px dashed #3f3f46', background: 'transparent', color: '#3f3f46', fontSize: 20, cursor: 'pointer' }}>+</button>
          )}
        </div>
      )}

      {/* ── Element Sidebar (Bottom Left) ── */}
      {isEditing && (
        <div 
          onPointerDown={(e) => e.stopPropagation()}
          style={{ position: 'absolute', left: 24, bottom: 24, display: 'flex', gap: 8, background: 'rgba(20,20,22,0.9)', padding: 6, borderRadius: 14, border: '1px solid #27272a', backdropFilter: 'blur(20px)', zIndex: 1100, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        >
          {ARCH_ELEMENTS.map(el => (
            <button 
              key={el.type}
              onClick={() => addZone(el.type)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                padding: '10px 14px', borderRadius: 10, border: '1px solid transparent',
                background: 'transparent', color: '#a1a1aa', cursor: 'pointer', transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; 
                e.currentTarget.style.color = 'white'; 
                e.currentTarget.style.borderColor = `${el.color}33`;
                e.currentTarget.style.boxShadow = `0 0 15px ${el.color}11`;
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.background = 'transparent'; 
                e.currentTarget.style.color = '#a1a1aa'; 
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ transform: 'scale(1.1)' }}>
                {el.icon(el.color)}
              </div>
              <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: 0.5, opacity: 0.7 }}>{el.label.toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Bulk Delete Button ── */}
      {isEditing && selectedIds.length > 1 && (
        <div 
          onPointerDown={(e) => e.stopPropagation()}
          style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1200, animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <button 
            onClick={() => deleteZones(selectedIds)}
            style={{ 
              background: '#ef4444', color: 'white', border: 'none', borderRadius: 14, 
              padding: '12px 28px', fontSize: 12, fontWeight: 800, cursor: 'pointer', 
              boxShadow: '0 8px 32px rgba(239, 68, 68, 0.4), 0 0 0 1px rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', gap: 10, letterSpacing: 1
            }}
          >
            <span style={{ fontSize: 16 }}>🗑️</span>
            DELETE SELECTED ({selectedIds.length})
          </button>
        </div>
      )}

      {/* Modals */}
      {showAiModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface-2)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: 'var(--radius-lg)', padding: 32, width: 440, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-hi)', margin: 0 }}>✨ AI Auto-Mapper</h2>
              <button onClick={() => !isScanning && setShowAiModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-mid)', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div onClick={() => !isScanning && fileInputRef.current?.click()} style={{ width: '100%', height: 180, border: '2px dashed rgba(139, 92, 246, 0.4)', borderRadius: 12, background: 'rgba(139, 92, 246, 0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {isScanning ? <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>AI RECONSTRUCTION...</div> : <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-hi)' }}>Click to upload floor plan</div>}
            </div>
          </div>
        </div>
      )}

      {editingZoneId && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, width: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-hi)' }}>Edit Zone</div>
            <input value={editLabel} onChange={e => setEditLabel(e.target.value)} style={{ width: '100%', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', color: 'white' }} autoFocus />
            <input value={editSubtitle} onChange={e => setEditSubtitle(e.target.value)} style={{ width: '100%', background: 'var(--color-surface-1)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '8px 12px', color: 'white' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setEditingZoneId(null)} style={{ padding: '8px 16px', background: 'transparent', color: 'var(--color-text-mid)', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveEditZone} style={{ padding: '8px 16px', background: 'var(--color-primary)', color: 'white', borderRadius: 6, border: 'none', cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {deletingZoneId && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface-2)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-lg)', padding: 24, width: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-error)' }}>Delete Zone?</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setDeletingZoneId(null)} style={{ padding: '8px 16px', background: 'transparent', color: 'var(--color-text-mid)', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDeleteZone} style={{ padding: '8px 16px', background: 'var(--color-error)', color: 'white', borderRadius: 6, border: 'none', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {/* Legacy popup removed - now using anchored contextual HUD inside tactical-zone loop */}

      <style>{`
        @keyframes pulseAlert {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes criticalPulse {
          0% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.2); }
          50% { box-shadow: 0 0 40px rgba(239, 68, 68, 0.6); background: rgba(239, 68, 68, 0.25); }
          100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.2); }
        }
      `}</style>
    </div>
  );
}
