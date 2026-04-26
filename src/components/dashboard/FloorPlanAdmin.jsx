import { useState, useRef, useEffect, useCallback } from 'react';
import {
  uploadFloorPlanImage,
  saveRoomCoordinate,
  deleteRoomCoordinate,
  getRoomCoordinates,
  getFloorPlanMeta,
  getHotelFloors,
  updateFloorLabel,
} from '../../services/floorPlanAdminService';
import { autoDetectFloorPlanRooms } from '../../services/geminiService';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════════════════════
// FloorPlanAdmin — Upload image + Click-to-place room markers
// ═══════════════════════════════════════════════════════════════════════════════

const ROOM_TYPES = ['room', 'suite', 'lobby', 'corridor', 'stair', 'exit', 'elevator', 'restaurant', 'kitchen', 'utility', 'pool', 'gym', 'bar', 'conference', 'garden', 'shop', 'lounge'];

export default function FloorPlanAdmin({ hotelId = 'hotel_default' }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [floorLevel, setFloorLevel] = useState(1);
  const [floors, setFloors] = useState([]);
  const [imageUrl, setImageUrl] = useState(null);
  const [localPreview, setLocalPreview] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetectingRooms, setIsDetectingRooms] = useState(false);
  const [placingMode, setPlacingMode] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState('room');
  const [floorLabel, setFloorLabel] = useState('');
  const [showBgImage, setShowBgImage] = useState(true);
  const [dragState, setDragState] = useState(null); // { roomId, startX, startY, origX, origY }
  const [resizeState, setResizeState] = useState(null);
  const [hoveredRoom, setHoveredRoom] = useState(null);
  const [toast, setToast] = useState(null);

  const imageContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Load floor data ────────────────────────────────────────────────────────
  useEffect(() => {
    loadFloorData();
    loadFloors();
  }, [hotelId, floorLevel]);

  const loadFloors = async () => {
    try {
      const f = await getHotelFloors(hotelId);
      setFloors(f);
    } catch { /* first time — no floors yet */ }
  };

  const loadFloorData = async () => {
    try {
      const meta = await getFloorPlanMeta(hotelId, floorLevel);
      if (meta?.imageUrl) {
        setImageUrl(meta.imageUrl);
        setFloorLabel(meta.label || `Floor ${floorLevel}`);
      } else {
        setImageUrl(null);
        setFloorLabel(`Floor ${floorLevel}`);
      }
      const roomData = await getRoomCoordinates(hotelId, floorLevel);
      setRooms(roomData);
    } catch (e) {
      console.warn('[FP-ADMIN] Load failed:', e.message);
      setRooms([]);
    }
    setLocalPreview(null);
  };

  // ── Image upload ───────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onloadend = () => setLocalPreview(reader.result);
    reader.readAsDataURL(file);

    uploadImage(file);
  };

  const uploadImage = async (file) => {
    setIsUploading(true);
    try {
      const { url } = await uploadFloorPlanImage(hotelId, floorLevel, file);
      setImageUrl(url);
      setLocalPreview(null);
      showToast('Floor plan uploaded successfully!');
      loadFloors();
    } catch (e) {
      console.error('[FP-ADMIN] Upload failed:', e);
      showToast('Upload failed: ' + e.message, 'error');
    }
    setIsUploading(false);
  };

  // ── AI Auto-Detect Rooms ───────────────────────────────────────────────────
  const handleAutoDetect = async () => {
    if (!imageUrl && !localPreview) return;
    setIsDetectingRooms(true);
    try {
      const base64 = (localPreview || imageUrl).replace(/^data:image\/[a-z]+;base64,/, '');
      const detectedRooms = await autoDetectFloorPlanRooms(base64);
      
      const newRooms = detectedRooms.map(r => {
        let xPercent = 0.5, yPercent = 0.5, widthPercent = 0.1, heightPercent = 0.1;
        if (r.points && r.points.length > 0) {
          const xs = r.points.map(p => p.xPercent);
          const ys = r.points.map(p => p.yPercent);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          xPercent = Math.max(0, minX);
          yPercent = Math.max(0, minY);
          widthPercent = Math.max(0.01, Math.min(1 - xPercent, maxX - minX));
          heightPercent = Math.max(0.01, Math.min(1 - yPercent, maxY - minY));
        }
        return {
          id: `room_${uuidv4().substring(0, 8)}`,
          name: r.name || 'Unnamed',
          type: r.type || 'room',
          xPercent,
          yPercent,
          widthPercent,
          heightPercent,
          capacity: 2,
          points: r.points
        };
      });
      setRooms(prev => [...prev, ...newRooms]);
      showToast(`Detected ${newRooms.length} spaces!`);
    } catch (e) {
      showToast(e.message, 'error');
    }
    setIsDetectingRooms(false);
  };

  // ── Click to place a room ──────────────────────────────────────────────────
  const handleImageClick = (e) => {
    if (!placingMode) return;
    if (dragState || resizeState) return;

    const container = imageContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const xPercent = (e.clientX - rect.left) / rect.width;
    const yPercent = (e.clientY - rect.top) / rect.height;

    const roomId = `room_${uuidv4().substring(0, 8)}`;
    const name = newRoomName.trim() || `R${rooms.length + 1}`;

    const newRoom = {
      id: roomId,
      name,
      type: newRoomType,
      xPercent: Math.max(0, Math.min(1, xPercent - 0.04)),
      yPercent: Math.max(0, Math.min(1, yPercent - 0.06)),
      widthPercent: 0.08,
      heightPercent: 0.12,
      capacity: 2,
    };

    setRooms(prev => [...prev, newRoom]);
    setSelectedRoom(roomId);
    setNewRoomName('');
    showToast(`Placed "${name}" at (${(xPercent * 100).toFixed(1)}%, ${(yPercent * 100).toFixed(1)}%)`);
  };

  // ── Drag to reposition ─────────────────────────────────────────────────────
  const handleDragStart = (e, room) => {
    if (placingMode) return;
    e.stopPropagation();
    e.preventDefault();
    const container = imageContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setDragState({
      roomId: room.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: room.xPercent,
      origY: room.yPercent,
      origPoints: room.points,
      containerW: rect.width,
      containerH: rect.height,
    });
    setSelectedRoom(room.id);
  };

  const handleMouseMove = useCallback((e) => {
    if (dragState) {
      const dx = (e.clientX - dragState.startX) / dragState.containerW;
      const dy = (e.clientY - dragState.startY) / dragState.containerH;
      setRooms(prev => prev.map(r => {
        if (r.id === dragState.roomId) {
          const newX = Math.max(0, Math.min(1 - r.widthPercent, dragState.origX + dx));
          const newY = Math.max(0, Math.min(1 - r.heightPercent, dragState.origY + dy));
          const shiftX = newX - dragState.origX;
          const shiftY = newY - dragState.origY;
          
          let newPoints = r.points;
          if (dragState.origPoints) {
            newPoints = dragState.origPoints.map(p => ({
              ...p,
              xPercent: p.xPercent + shiftX,
              yPercent: p.yPercent + shiftY
            }));
          }
          
          return { ...r, xPercent: newX, yPercent: newY, points: newPoints };
        }
        return r;
      }));
    }
    if (resizeState) {
      const dx = (e.clientX - resizeState.startX) / resizeState.containerW;
      const dy = (e.clientY - resizeState.startY) / resizeState.containerH;
      setRooms(prev => prev.map(r => {
        if (r.id === resizeState.roomId) {
          const newW = Math.max(0.03, Math.min(0.5, resizeState.origW + dx));
          const newH = Math.max(0.03, Math.min(0.5, resizeState.origH + dy));
          const scaleX = newW / resizeState.origW;
          const scaleY = newH / resizeState.origH;
          
          let newPoints = r.points;
          if (resizeState.origPoints) {
            newPoints = resizeState.origPoints.map(p => ({
              ...p,
              xPercent: r.xPercent + (p.xPercent - r.xPercent) * scaleX,
              yPercent: r.yPercent + (p.yPercent - r.yPercent) * scaleY
            }));
          }
          return { ...r, widthPercent: newW, heightPercent: newH, points: newPoints };
        }
        return r;
      }));
    }
  }, [dragState, resizeState]);

  const handleMouseUp = useCallback(() => {
    setDragState(null);
    setResizeState(null);
  }, []);

  useEffect(() => {
    if (dragState || resizeState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, resizeState, handleMouseMove, handleMouseUp]);

  // ── Resize handle ──────────────────────────────────────────────────────────
  const handleResizeStart = (e, room) => {
    e.stopPropagation();
    e.preventDefault();
    const container = imageContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setResizeState({
      roomId: room.id,
      startX: e.clientX,
      startY: e.clientY,
      origW: room.widthPercent,
      origH: room.heightPercent,
      origPoints: room.points,
      containerW: rect.width,
      containerH: rect.height,
    });
    setSelectedRoom(room.id);
  };

  // ── Save all rooms to Firestore ────────────────────────────────────────────
  const saveAllRooms = async () => {
    setIsSaving(true);
    try {
      for (const room of rooms) {
        await saveRoomCoordinate(hotelId, floorLevel, room);
      }
      if (floorLabel) {
        await updateFloorLabel(hotelId, floorLevel, floorLabel);
      }
      showToast(`Saved ${rooms.length} rooms for Floor ${floorLevel}`);
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
    }
    setIsSaving(false);
  };

  // ── Delete a room ──────────────────────────────────────────────────────────
  const handleDeleteRoom = async (roomId) => {
    setRooms(prev => prev.filter(r => r.id !== roomId));
    if (selectedRoom === roomId) setSelectedRoom(null);
    try {
      await deleteRoomCoordinate(hotelId, floorLevel, roomId);
      showToast('Room removed');
    } catch { /* may not exist in DB yet */ }
  };

  // ── Update room property ───────────────────────────────────────────────────
  const updateRoomProp = (roomId, key, value) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, [key]: value } : r));
  };

  const displayImage = localPreview || imageUrl;
  const selRoom = rooms.find(r => r.id === selectedRoom);

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="fp-admin">
      {/* Toast */}
      {toast && (
        <div className={`fp-admin-toast ${toast.type}`}>
          <span>{toast.type === 'error' ? '❌' : '✅'}</span>
          {toast.msg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="fp-admin-header">
        <div>
          <div className="fp-admin-title">Floor Plan Editor</div>
          <div className="fp-admin-subtitle">Upload · Click · Map Rooms</div>
        </div>
        <div className="fp-admin-header-actions">
          <button
            className={`fp-admin-mode-btn ${placingMode ? 'active' : ''}`}
            onClick={() => setPlacingMode(!placingMode)}
          >
            {placingMode ? '✕ EXIT PLACEMENT' : '＋ PLACE ROOMS'}
          </button>
          <button
            className="fp-admin-save-btn"
            onClick={saveAllRooms}
            disabled={isSaving || rooms.length === 0}
          >
            {isSaving ? '⏳ SAVING...' : `💾 SAVE ALL (${rooms.length})`}
          </button>
        </div>
      </div>

      {/* ── Floor Selector ──────────────────────────────────────────────── */}
      <div className="fp-admin-floor-bar">
        <div className="fp-admin-floor-tabs">
          {[0, 1, 2, 3, 4, 5].map(lvl => (
            <button
              key={lvl}
              className={`fp-admin-floor-tab ${floorLevel === lvl ? 'active' : ''}`}
              onClick={() => { setFloorLevel(lvl); setSelectedRoom(null); setPlacingMode(false); }}
            >
              {lvl === 0 ? 'G' : `F${lvl}`}
            </button>
          ))}
        </div>
        <div className="fp-admin-floor-label-edit">
          <input
            type="text"
            value={floorLabel}
            onChange={e => setFloorLabel(e.target.value)}
            placeholder="Floor label..."
            className="fp-admin-input-sm"
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="fp-admin-upload-btn"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)' }}
            onClick={handleAutoDetect}
            disabled={isDetectingRooms || (!imageUrl && !localPreview)}
            title="Use AI to automatically detect rooms from the floor plan"
          >
            {isDetectingRooms ? '⏳ Analyzing...' : '✨ Auto-Detect Rooms'}
          </button>
          <button
            className="fp-admin-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? '⏳ Uploading...' : '📁 Upload Image'}
          </button>
          <button
            className="fp-admin-upload-btn"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={() => setShowBgImage(!showBgImage)}
          >
            {showBgImage ? '👁 Hide Blueprint' : '👁 Show Blueprint'}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      {/* ── Main Area ───────────────────────────────────────────────────── */}
      <div className="fp-admin-body">
        {/* Left: Image + Markers */}
        <div className="fp-admin-canvas-area">
          {displayImage ? (
            <div
              ref={imageContainerRef}
              className={`fp-admin-image-container ${placingMode ? 'placing' : ''}`}
              onClick={handleImageClick}
              style={{ background: '#111116' }}
            >
              <img
                src={displayImage}
                alt={`Floor ${floorLevel} plan`}
                className="fp-admin-image"
                draggable={false}
                style={{ opacity: showBgImage ? 1 : 0, transition: 'opacity 0.2s' }}
              />

              {/* Room markers overlay */}
              {rooms.map(room => {
                const isSelected = selectedRoom === room.id;
                const isHovered = hoveredRoom === room.id;
                const typeColor = getRoomTypeColor(room.type);
                
                // If AI provided points, use clip-path to draw exact shape
                let clipPathObj = {};
                if (room.points && room.points.length >= 3) {
                  const pointsStr = room.points.map(p => {
                    const px = (p.xPercent - room.xPercent) / room.widthPercent * 100;
                    const py = (p.yPercent - room.yPercent) / room.heightPercent * 100;
                    return `${px}% ${py}%`;
                  }).join(', ');
                  clipPathObj = { clipPath: `polygon(${pointsStr})` };
                }

                return (
                  <div
                    key={room.id}
                    className={`fp-admin-marker ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                    style={{
                      left: `${room.xPercent * 100}%`,
                      top: `${room.yPercent * 100}%`,
                      width: `${room.widthPercent * 100}%`,
                      height: `${room.heightPercent * 100}%`,
                      borderColor: typeColor,
                      background: isSelected
                        ? `${typeColor}40`
                        : isHovered
                        ? `${typeColor}25`
                        : `${typeColor}15`,
                      ...clipPathObj
                    }}
                    onMouseDown={e => handleDragStart(e, room)}
                    onMouseEnter={() => setHoveredRoom(room.id)}
                    onMouseLeave={() => setHoveredRoom(null)}
                    onClick={e => { e.stopPropagation(); setSelectedRoom(room.id); }}
                  >
                    <span className="fp-admin-marker-label">{room.name}</span>
                    <span className="fp-admin-marker-type" style={{ color: typeColor }}>{room.type}</span>
                    {/* Resize handle */}
                    {isSelected && (
                      <div
                        className="fp-admin-resize-handle"
                        onMouseDown={e => handleResizeStart(e, room)}
                      />
                    )}
                    {/* Delete btn */}
                    {isSelected && (
                      <button
                        className="fp-admin-marker-delete"
                        onClick={e => { e.stopPropagation(); handleDeleteRoom(room.id); }}
                      >✕</button>
                    )}
                  </div>
                );
              })}

              {/* Placing mode crosshair overlay */}
              {placingMode && (
                <div className="fp-admin-crosshair-overlay">
                  <div className="fp-admin-crosshair-text">Click to place a room</div>
                </div>
              )}
            </div>
          ) : (
            <div className="fp-admin-empty-state" onClick={() => fileInputRef.current?.click()}>
              <div className="fp-admin-empty-icon">🗺️</div>
              <div className="fp-admin-empty-title">No Floor Plan Image</div>
              <div className="fp-admin-empty-sub">
                Click or drag an image here to upload your floor plan
              </div>
              <button className="fp-admin-upload-btn" style={{ marginTop: 16 }}>
                📁 Choose Image
              </button>
            </div>
          )}
        </div>

        {/* Right: Room properties panel */}
        <div className="fp-admin-panel">
          {/* Placement config */}
          {placingMode && (
            <div className="fp-admin-panel-section">
              <div className="fp-admin-panel-title">🎯 New Room Config</div>
              <label className="fp-admin-label">Name</label>
              <input
                type="text"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                placeholder="e.g. 101, Lobby, Kitchen..."
                className="fp-admin-input"
              />
              <label className="fp-admin-label" style={{ marginTop: 10 }}>Type</label>
              <select
                value={newRoomType}
                onChange={e => setNewRoomType(e.target.value)}
                className="fp-admin-select"
              >
                {ROOM_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              <div className="fp-admin-hint">Click on the image to place room</div>
            </div>
          )}

          {/* Selected room properties */}
          {selRoom && (
            <div className="fp-admin-panel-section">
              <div className="fp-admin-panel-title">
                <span style={{ color: getRoomTypeColor(selRoom.type) }}>●</span>
                {' '}Room Properties
              </div>

              <label className="fp-admin-label">Name</label>
              <input
                type="text"
                value={selRoom.name}
                onChange={e => updateRoomProp(selRoom.id, 'name', e.target.value)}
                className="fp-admin-input"
              />

              <label className="fp-admin-label" style={{ marginTop: 10 }}>Type</label>
              <select
                value={selRoom.type}
                onChange={e => updateRoomProp(selRoom.id, 'type', e.target.value)}
                className="fp-admin-select"
              >
                {ROOM_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>

              <label className="fp-admin-label" style={{ marginTop: 10 }}>Capacity</label>
              <input
                type="number"
                value={selRoom.capacity || 2}
                onChange={e => updateRoomProp(selRoom.id, 'capacity', parseInt(e.target.value) || 1)}
                className="fp-admin-input"
                min="1"
              />

              <div className="fp-admin-coords">
                <div className="fp-admin-coord">
                  <span>X</span>
                  <span>{(selRoom.xPercent * 100).toFixed(1)}%</span>
                </div>
                <div className="fp-admin-coord">
                  <span>Y</span>
                  <span>{(selRoom.yPercent * 100).toFixed(1)}%</span>
                </div>
                <div className="fp-admin-coord">
                  <span>W</span>
                  <span>{(selRoom.widthPercent * 100).toFixed(1)}%</span>
                </div>
                <div className="fp-admin-coord">
                  <span>H</span>
                  <span>{(selRoom.heightPercent * 100).toFixed(1)}%</span>
                </div>
              </div>

              <button
                className="fp-admin-delete-btn"
                onClick={() => handleDeleteRoom(selRoom.id)}
              >
                🗑️ Delete Room
              </button>
            </div>
          )}

          {/* Room list */}
          <div className="fp-admin-panel-section">
            <div className="fp-admin-panel-title">
              📋 Rooms ({rooms.length})
            </div>
            <div className="fp-admin-room-list">
              {rooms.length === 0 ? (
                <div className="fp-admin-room-list-empty">
                  No rooms mapped yet. Enable placement mode and click on the image.
                </div>
              ) : (
                rooms.map(room => (
                  <div
                    key={room.id}
                    className={`fp-admin-room-item ${selectedRoom === room.id ? 'active' : ''}`}
                    onClick={() => setSelectedRoom(room.id)}
                  >
                    <div className="fp-admin-room-item-dot" style={{ background: getRoomTypeColor(room.type) }} />
                    <div className="fp-admin-room-item-info">
                      <span className="fp-admin-room-item-name">{room.name}</span>
                      <span className="fp-admin-room-item-type">{room.type}</span>
                    </div>
                    <span className="fp-admin-room-item-pos">
                      {(room.xPercent * 100).toFixed(0)}%, {(room.yPercent * 100).toFixed(0)}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Type color mapping ───────────────────────────────────────────────────────
function getRoomTypeColor(type) {
  const colors = {
    room: '#8b5cf6',
    suite: '#a78bfa',
    lobby: '#3b82f6',
    corridor: '#6b7280',
    stair: '#3b82f6',
    exit: '#10b981',
    elevator: '#f59e0b',
    restaurant: '#ec4899',
    kitchen: '#f97316',
    utility: '#6b7280',
    pool: '#06b6d4',
    gym: '#14b8a6',
    bar: '#e11d48',
    conference: '#8b5cf6',
    garden: '#22c55e',
    shop: '#a855f7',
    lounge: '#6366f1',
  };
  return colors[type] || '#8b5cf6';
}
