// ── Evacuation Path Engine ───────────────────────────────────────────────────
// Uses Dijkstra's algorithm on the building zone graph to find the safest
// evacuation route that avoids danger zones identified by the AI.

import { DangerLevel } from '../models/building';

// Danger level weights — higher = more costly to traverse
const DANGER_WEIGHTS = {
  [DangerLevel.SAFE]:     1,
  [DangerLevel.CAUTION]:  5,
  [DangerLevel.DANGER]:   50,
  [DangerLevel.CRITICAL]: Infinity,  // Impassable
};

/**
 * Find the safest evacuation path from a source zone to the nearest exit.
 * Uses a modified Dijkstra that weights edges by danger level.
 *
 * @param {string} sourceZoneId - Where the person is
 * @param {Array} zones - All zones with adjacentZones edges
 * @param {Map<string, string>} dangerMap - zoneId → dangerLevel
 * @returns {{ path: string[], totalCost: number, exitZoneId: string } | null}
 */
export function findSafestEvacuationRoute(sourceZoneId, zones, dangerMap = new Map()) {
  const zoneMap = new Map(zones.map(z => [z.id, z]));

  // Find all exit zones (zones that have exits defined)
  const exitZoneIds = zones
    .filter(z => z.exits && z.exits.length > 0)
    .map(z => z.id);

  if (exitZoneIds.length === 0) {
    console.warn('[EVACUATION] No exit zones found in building model');
    return null;
  }

  // Dijkstra's algorithm
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();

  // Initialize distances
  for (const zone of zones) {
    dist.set(zone.id, Infinity);
  }
  dist.set(sourceZoneId, 0);

  while (true) {
    // Find unvisited node with minimum distance
    let current = null;
    let minDist = Infinity;

    for (const [id, d] of dist) {
      if (!visited.has(id) && d < minDist) {
        minDist = d;
        current = id;
      }
    }

    if (current === null) break;   // No more reachable nodes
    if (exitZoneIds.includes(current) && current !== sourceZoneId) break; // Reached an exit
    visited.add(current);

    const currentZone = zoneMap.get(current);
    if (!currentZone) continue;

    // Explore neighbors
    for (const edge of (currentZone.adjacentZones ?? [])) {
      if (visited.has(edge.zoneId)) continue;

      const neighborDanger = dangerMap.get(edge.zoneId) ?? DangerLevel.SAFE;
      const weight = DANGER_WEIGHTS[neighborDanger] ?? 1;

      // Critical zones are impassable
      if (weight === Infinity) continue;

      const edgeCost = (edge.distance ?? 1) * weight;
      const newDist = dist.get(current) + edgeCost;

      if (newDist < dist.get(edge.zoneId)) {
        dist.set(edge.zoneId, newDist);
        prev.set(edge.zoneId, current);
      }
    }
  }

  // Find the nearest reachable exit
  let bestExit = null;
  let bestCost = Infinity;

  for (const exitId of exitZoneIds) {
    const cost = dist.get(exitId);
    if (cost < bestCost) {
      bestCost = cost;
      bestExit = exitId;
    }
  }

  if (!bestExit || bestCost === Infinity) {
    console.warn('[EVACUATION] No safe path to any exit from zone:', sourceZoneId);
    return null;
  }

  // Reconstruct path
  const path = [];
  let node = bestExit;
  while (node) {
    path.unshift(node);
    node = prev.get(node);
  }

  return {
    path,
    totalCost: bestCost,
    exitZoneId: bestExit,
    estimatedTimeSeconds: Math.round(bestCost * 15), // ~15s per unit
  };
}

/**
 * Find evacuation routes for all occupied zones.
 *
 * @param {Array} zones - Building zones
 * @param {Array} dangerZones - From crisisState.dangerZones
 * @returns {Map<string, object>} zoneId → evacuation route
 */
export function computeAllEvacuationRoutes(zones, dangerZones = []) {
  const dangerMap = new Map();
  for (const dz of dangerZones) {
    dangerMap.set(dz.zoneId, dz.level);
  }

  const routes = new Map();

  for (const zone of zones) {
    // Skip exit zones themselves
    if (zone.exits && zone.exits.length > 0) continue;

    const route = findSafestEvacuationRoute(zone.id, zones, dangerMap);
    if (route) {
      routes.set(zone.id, route);
    }
  }

  return routes;
}
