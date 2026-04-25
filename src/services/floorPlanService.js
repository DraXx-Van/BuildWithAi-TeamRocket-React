/**
 * ── Floor Plan Service ─────────────────────────────────────────────────────────
 * Spatial-First Architecture: Loads floor plans from Firestore (dynamic) or
 * local GeoJSON (fallback for demo).
 *
 * Data sources (in priority order):
 *   1. Firestore `hotels/{hotelId}/floors/{levelDoc}` — admin-created floor plans
 *   2. Local data files — for the default CrisisFlow Grand Hotel demo
 *
 * The admin tool (FloorPlanAdmin) saves:
 *   - Floor image (base64 data URL) + label
 *   - Room coordinates as percentage values
 *
 * This service converts that admin data into the GeoJSON FeatureCollection
 * format that FloorPlanSVG expects, so the renderer doesn't need to change.
 */

import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// ── Local data imports (default hotel fallback) ──────────────────────────────
import floor1GeoJSON from '../data/floorplans/floor1.geojson';
import { basementGeoJSON, groundFloorGeoJSON, floor2GeoJSON, floor3GeoJSON } from '../data/floorplans/all_floors.geojson';
import floor1NavGraph from '../data/graphs/floor1_nav_graph';

// ── All local floors indexed by level ────────────────────────────────────────
const LOCAL_FLOORS = {
  '-1': basementGeoJSON,
  '0':  groundFloorGeoJSON,
  '1':  floor1GeoJSON,
  '2':  floor2GeoJSON,
  '3':  floor3GeoJSON,
};

const LOCAL_GRAPHS = {
  '1': floor1NavGraph,
};

// ── SVG viewport dimensions for the image-based renderer ─────────────────────
const DEFAULT_VIEWPORT = { width: 680, height: 400 };

// ═══════════════════════════════════════════════════════════════════════════════
// FIRESTORE → GeoJSON CONVERTER
// Transforms admin-saved room coordinates into GeoJSON FeatureCollections
// so the SVG renderer can consume them with zero code changes.
// ═══════════════════════════════════════════════════════════════════════════════

/** Default colors for room types (matches FloorPlanAdmin's getRoomTypeColor) */
const TYPE_COLORS = {
  room: '#252530', suite: '#2d2530', lobby: '#2a2a35', corridor: 'rgba(255,255,255,0.04)',
  stair: null, exit: null, elevator: null, restaurant: '#2a2a30', kitchen: '#2a2a30',
  utility: '#252530', pool: '#1a2535', gym: '#252530', bar: '#2a2a30', conference: '#252530',
  garden: '#1a2a1a', shop: '#252530', lounge: '#2a2a30', hallway: 'rgba(255,255,255,0.04)',
};

/**
 * Convert a single admin-saved room (percentage coords) into a GeoJSON Feature
 * with polygon geometry sized for the given viewport.
 */
function roomToFeature(room, viewport) {
  const vw = viewport.width;
  const vh = viewport.height;

  const x = room.xPercent * vw;
  const y = room.yPercent * vh;
  const w = (room.widthPercent || 0.08) * vw;
  const h = (room.heightPercent || 0.12) * vh;

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]],
    },
    properties: {
      id: room.id,
      name: room.name || room.id,
      type: room.type || 'room',
      is_passable: true,
      capacity: room.capacity || 2,
      color: TYPE_COLORS[room.type] || '#252530',
      // Mark exits and stairs for the renderer
      ...(room.type === 'exit' ? { is_exit: true } : {}),
    },
  };
}

/**
 * Build a full GeoJSON FeatureCollection from admin-saved floor data + rooms.
 */
function buildGeoJSON(floorMeta, rooms, floorLevel) {
  const viewport = DEFAULT_VIEWPORT;
  const floorNum = Number(floorLevel);

  const shortLabel = floorNum === 0 ? 'G' : floorNum < 0 ? `B${Math.abs(floorNum)}` : `F${floorNum}`;

  return {
    type: 'FeatureCollection',
    metadata: {
      buildingId: 'hotel_default',
      floorId: `floor_${floorLevel}`,
      floorLevel: floorNum,
      label: floorMeta?.label || `Floor ${floorLevel}`,
      short: shortLabel,
      viewport,
      imageUrl: floorMeta?.imageUrl || null, // base64 data URL for background image
    },
    features: rooms.map(r => roomToFeature(r, viewport)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load ALL floors from Firestore for a given hotel.
 * Returns a map like { '0': geojsonCollection, '1': geojsonCollection, ... }
 * Falls back to LOCAL_FLOORS if Firestore has no data.
 *
 * @param {string} hotelId — defaults to 'hotel_default'
 * @returns {Promise<{floors: Object, source: 'firestore'|'local'}>}
 */
export async function loadDynamicFloors(hotelId = 'hotel_default') {
  try {
    const floorsCollRef = collection(db, `hotels/${hotelId}/floors`);
    const floorSnap = await getDocs(floorsCollRef);

    if (floorSnap.empty) {
      console.log('[FLOORPLAN] No Firestore floors found, using local data');
      return { floors: LOCAL_FLOORS, source: 'local' };
    }

    const floors = {};

    for (const floorDoc of floorSnap.docs) {
      const floorMeta = floorDoc.data();
      const floorLevel = floorMeta.floorLevel ?? 0;

      // Load rooms subcollection
      const roomsCollRef = collection(db, `hotels/${hotelId}/floors/${floorDoc.id}/rooms`);
      const roomSnap = await getDocs(roomsCollRef);
      const rooms = [];
      roomSnap.forEach(d => rooms.push(d.data()));

      // Build GeoJSON
      const geojson = buildGeoJSON(floorMeta, rooms, floorLevel);
      floors[String(floorLevel)] = geojson;
    }

    console.log(`[FLOORPLAN] Loaded ${Object.keys(floors).length} floors from Firestore`);
    return { floors, source: 'firestore' };
  } catch (e) {
    console.warn('[FLOORPLAN] Firestore load failed, using local data:', e.message);
    return { floors: LOCAL_FLOORS, source: 'local' };
  }
}

/**
 * Get the GeoJSON FeatureCollection for a specific floor.
 * Tries Firestore first, falls back to local data.
 */
export async function getFloorPlan(buildingId, floorLevel) {
  const key = String(floorLevel);

  // Try Firestore
  try {
    const snap = await getDoc(doc(db, `floorplans/${buildingId}/floors`, `level_${key}`));
    if (snap.exists()) {
      console.log(`[FLOORPLAN] Loaded floor ${key} from Firestore`);
      return snap.data();
    }
  } catch (e) {
    console.warn('[FLOORPLAN] Firestore load failed, using local:', e.message);
  }

  // Local fallback
  if (LOCAL_FLOORS[key]) {
    console.log(`[FLOORPLAN] Loaded floor ${key} from local data`);
    return LOCAL_FLOORS[key];
  }

  console.warn(`[FLOORPLAN] No floor plan found for level ${key}`);
  return null;
}

/**
 * Get all floor plans for a building (synchronous local version).
 * Still available as fallback for components that need sync data.
 */
export function getAllLocalFloors() {
  return LOCAL_FLOORS;
}

/**
 * Get the navigation graph for a floor (local).
 */
export function getNavGraph(floorLevel) {
  return LOCAL_GRAPHS[String(floorLevel)] ?? null;
}

/**
 * Upload a GeoJSON floor plan to Firestore for a specific building/floor.
 * This is how you add new hotels dynamically.
 */
export async function uploadFloorPlan(buildingId, floorLevel, geojsonData) {
  const key = `level_${floorLevel}`;
  await setDoc(doc(db, `floorplans/${buildingId}/floors`, key), geojsonData);
  console.log(`[FLOORPLAN] Uploaded floor ${floorLevel} to Firestore for building ${buildingId}`);
}

/**
 * Upload a navigation graph to Firestore.
 */
export async function uploadNavGraph(buildingId, floorLevel, graphData) {
  const key = `level_${floorLevel}`;
  await setDoc(doc(db, `floorplans/${buildingId}/graphs`, key), graphData);
  console.log(`[FLOORPLAN] Uploaded nav graph for floor ${floorLevel}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEOMETRY HELPERS — Extract rendering data from GeoJSON features
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert a GeoJSON Polygon feature to SVG rect params {x, y, w, h}.
 * Assumes rectangular zones (common for indoor floor plans).
 */
export function featureToRect(feature) {
  const coords = feature.geometry.coordinates[0]; // outer ring
  const xs = coords.map(c => c[0]);
  const ys = coords.map(c => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  return { x, y, w, h };
}

/**
 * Get the centroid of a GeoJSON feature.
 */
export function featureCentroid(feature) {
  const { x, y, w, h } = featureToRect(feature);
  return { x: x + w / 2, y: y + h / 2 };
}

/**
 * Filter features by type from a GeoJSON FeatureCollection.
 */
export function filterByType(geojson, ...types) {
  return geojson.features.filter(f => types.includes(f.properties.type));
}

/**
 * Find a feature by its zone ID.
 */
export function findFeatureById(geojson, zoneId) {
  return geojson.features.find(f => f.properties.id === zoneId) ?? null;
}

/**
 * Mark a zone as impassable (hazard detected).
 * Returns a new GeoJSON with the updated feature.
 */
export function markZoneImpassable(geojson, zoneId) {
  return {
    ...geojson,
    features: geojson.features.map(f =>
      f.properties.id === zoneId
        ? { ...f, properties: { ...f.properties, is_passable: false } }
        : f
    ),
  };
}

/**
 * Mark a zone as passable (hazard cleared).
 */
export function markZonePassable(geojson, zoneId) {
  return {
    ...geojson,
    features: geojson.features.map(f =>
      f.properties.id === zoneId
        ? { ...f, properties: { ...f.properties, is_passable: true } }
        : f
    ),
  };
}
