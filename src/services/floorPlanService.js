/**
 * ── Floor Plan Service ─────────────────────────────────────────────────────────
 * Spatial-First Architecture: Loads GeoJSON floor plans + navigation graphs.
 *
 * Data sources (in priority order):
 *   1. Firestore `floorplans/{buildingId}/floors/{floorId}` — for dynamic hotels
 *   2. Local data files — for the default CrisisFlow Grand Hotel
 *
 * To add a new hotel:
 *   1. Create GeoJSON FeatureCollection for each floor
 *   2. Create a navigation graph for each floor
 *   3. Upload to Firestore OR add to local data/floorplans/
 */

import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// ── Local data imports (default hotel) ───────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

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
