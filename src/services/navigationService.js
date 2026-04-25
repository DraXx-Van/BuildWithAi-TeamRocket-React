/**
 * ── Multi-Floor Navigation Service ──────────────────────────────────────────
 * Seamless Dijkstra pathfinding across floors.
 *
 * Key features:
 *   1. Cross-floor routing via stairwell edges (Room 205 → Main Exit)
 *   2. Calamity mode: elevators cost Infinity during fire/emergency
 *   3. Narrow-corridor awareness: edges with capacity < 3 get a congestion penalty
 *   4. Step-by-step human instructions (not just a line on a map)
 *   5. Floor transition markers for split-view UI rendering
 */

import multiFloorGraph from '../data/graphs/multi_floor_graph';

// ── Edge weight multipliers ──────────────────────────────────────────────────
const CALAMITY_ELEVATOR_COST = Infinity;
const NARROW_CORRIDOR_PENALTY = 1.5; // 50% longer if capacity < 3
const STAIR_DESCENT_BONUS = 0.9;     // Going down is faster
const STAIR_ASCENT_PENALTY = 1.3;    // Going up is slower

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-FLOOR DIJKSTRA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find the shortest safe path from a source room to a building exit.
 * Paths cross floors via stairwells. During calamity, elevators are blocked.
 *
 * @param {string} sourceNodeId - Starting node (e.g., 'f2_205')
 * @param {object} opts
 * @param {boolean} opts.isCalamity - If true, block all elevator edges
 * @param {Set<string>} opts.blockedZones - Zone IDs that are impassable
 * @param {Set<string>} opts.blockedEdges - Specific edge keys to block (e.g., 'f1_jct_w→f1_jct_c')
 * @param {string} opts.preferredExit - If set, try this exit first
 * @returns {MultiFloorRoute|null}
 */
export function findMultiFloorRoute(sourceNodeId, opts = {}) {
  const graph = multiFloorGraph;
  const { isCalamity = false, blockedZones = new Set(), blockedEdges = new Set(), preferredExit = null } = opts;

  if (!graph.nodes[sourceNodeId]) {
    console.warn(`[NAV] Source node ${sourceNodeId} not found`);
    return null;
  }

  const nodeIds = Object.keys(graph.nodes);
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();

  // Find all exit nodes
  const exitNodes = nodeIds.filter(id => graph.nodes[id].is_exit);
  if (exitNodes.length === 0) return null;

  // Initialize distances
  for (const id of nodeIds) dist.set(id, Infinity);
  dist.set(sourceNodeId, 0);

  // Build adjacency list with calamity + hazard awareness
  const adj = buildMultiFloorAdj(graph, { isCalamity, blockedZones, blockedEdges });

  // Dijkstra main loop
  while (true) {
    let current = null;
    let minDist = Infinity;

    for (const [id, d] of dist) {
      if (!visited.has(id) && d < minDist) {
        minDist = d;
        current = id;
      }
    }

    if (current === null) break;
    visited.add(current);

    // Check if we reached any exit
    if (graph.nodes[current].is_exit && current !== sourceNodeId) {
      // If preferred exit, keep searching unless cost is close
      if (!preferredExit || current === preferredExit) break;
    }

    for (const neighbor of (adj.get(current) ?? [])) {
      if (visited.has(neighbor.to)) continue;
      const newDist = dist.get(current) + neighbor.cost;
      if (newDist < dist.get(neighbor.to)) {
        dist.set(neighbor.to, newDist);
        prev.set(neighbor.to, current);
      }
    }
  }

  // Find best reachable exit
  let bestExit = null;
  let bestCost = Infinity;
  for (const exitId of exitNodes) {
    const cost = dist.get(exitId) ?? Infinity;
    if (cost < bestCost) {
      bestCost = cost;
      bestExit = exitId;
    }
  }

  if (!bestExit || bestCost === Infinity) {
    console.warn('[NAV] No safe multi-floor path found from', sourceNodeId);
    return null;
  }

  // Reconstruct path
  const path = [];
  let node = bestExit;
  while (node) {
    path.unshift(node);
    node = prev.get(node);
  }

  // Build per-floor segments + coordinates
  const segments = buildFloorSegments(path, graph);
  const instructions = generateInstructions(path, graph);

  return {
    path,
    segments,           // [{floor, nodes, pathCoords}] for per-floor SVG rendering
    instructions,       // Human-readable step-by-step
    totalCost: bestCost,
    exitNode: bestExit,
    exitLabel: graph.nodes[bestExit].label,
    estimatedSeconds: Math.round(bestCost / 18),
    floorsTraversed: [...new Set(path.map(id => graph.nodes[id].floor))],
    isCalamity,
  };
}

/**
 * Convenience: find route for a room by room number (e.g., '205').
 */
export function findRouteForRoom(roomNumber, opts = {}) {
  const floorNum = parseInt(String(roomNumber)[0]);
  const nodeId = `f${floorNum}_${roomNumber}`;
  return findMultiFloorRoute(nodeId, opts);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STEP-BY-STEP INSTRUCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function generateInstructions(path, graph) {
  const steps = [];
  let prevFloor = null;

  for (let i = 0; i < path.length; i++) {
    const node = graph.nodes[path[i]];
    const prevNode = i > 0 ? graph.nodes[path[i - 1]] : null;

    // Floor transition
    if (prevFloor !== null && node.floor !== prevFloor) {
      const dir = node.floor < prevFloor ? 'down' : 'up';
      const viaType = prevNode?.type === 'elevator' ? 'elevator' : 'stairs';
      steps.push({
        type: 'floor_change',
        text: `Take the ${viaType} ${dir} to ${floorLabel(node.floor)}`,
        fromFloor: prevFloor,
        toFloor: node.floor,
        icon: viaType === 'elevator' ? '🛗' : '🪜',
      });
    }

    // First step: exit room
    if (i === 0 && node.type === 'door') {
      steps.push({ type: 'start', text: `Exit ${node.label}`, icon: '🚪' });
    }
    // Corridor direction
    else if (node.type === 'junction' && prevNode) {
      const direction = getDirection(prevNode, node);
      steps.push({ type: 'walk', text: `Proceed ${direction} along corridor`, icon: '➡️' });
    }
    // Stairs
    else if (node.type === 'stair' && node.floor === prevFloor) {
      steps.push({ type: 'navigate', text: `Proceed to ${node.label}`, icon: '🔷' });
    }
    // Exit
    else if (node.type === 'exit') {
      steps.push({ type: 'exit', text: `Exit building via ${node.label}`, icon: '🟢' });
    }

    prevFloor = node.floor;
  }

  return steps;
}

function getDirection(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'east (right)' : 'west (left)';
  return dy > 0 ? 'south' : 'north';
}

function floorLabel(level) {
  if (level === 0) return 'Ground Floor';
  if (level === -1) return 'Basement';
  return `Floor ${level}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOOR SEGMENTS — for per-floor SVG rendering
// ═══════════════════════════════════════════════════════════════════════════════

function buildFloorSegments(path, graph) {
  const segments = [];
  let currentFloor = null;
  let currentNodes = [];

  for (const nodeId of path) {
    const node = graph.nodes[nodeId];
    if (node.floor !== currentFloor) {
      if (currentNodes.length > 0) {
        segments.push({
          floor: currentFloor,
          nodes: [...currentNodes],
          pathCoords: currentNodes.map(id => ({ x: graph.nodes[id].x, y: graph.nodes[id].y })),
        });
      }
      currentFloor = node.floor;
      // Include the stair node in both segments for visual continuity
      currentNodes = currentNodes.length > 0 ? [currentNodes[currentNodes.length - 1], nodeId] : [nodeId];
    } else {
      currentNodes.push(nodeId);
    }
  }

  if (currentNodes.length > 0) {
    segments.push({
      floor: currentFloor,
      nodes: currentNodes,
      pathCoords: currentNodes.map(id => ({ x: graph.nodes[id].x, y: graph.nodes[id].y })),
    });
  }

  return segments;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADJACENCY BUILDER with calamity + narrow corridor logic
// ═══════════════════════════════════════════════════════════════════════════════

function buildMultiFloorAdj(graph, { isCalamity, blockedZones, blockedEdges }) {
  const adj = new Map();

  for (const edge of graph.edges) {
    if (!edge.is_passable) continue;

    // Block elevator edges during calamity
    if (isCalamity && edge.type === 'elevator_cross') continue;

    // Block edges in hazard zones
    const fromZone = graph.nodes[edge.from]?.zoneId;
    const toZone = graph.nodes[edge.to]?.zoneId;
    if (blockedZones.has(fromZone) || blockedZones.has(toZone)) continue;

    // Block specific edges (e.g., "corridor segment A is on fire")
    const edgeKey = `${edge.from}→${edge.to}`;
    const edgeKeyRev = `${edge.to}→${edge.from}`;
    if (blockedEdges.has(edgeKey) || blockedEdges.has(edgeKeyRev)) continue;

    // Calculate weighted cost
    let cost = edge.distance;

    // Narrow corridor penalty
    if (edge.capacity && edge.capacity < 3) {
      cost *= NARROW_CORRIDOR_PENALTY;
    }

    // Stair direction bonus/penalty
    if (edge.type === 'stair_cross') {
      const fromFloor = graph.nodes[edge.from]?.floor ?? 0;
      const toFloor = graph.nodes[edge.to]?.floor ?? 0;
      cost *= toFloor < fromFloor ? STAIR_DESCENT_BONUS : STAIR_ASCENT_PENALTY;
    }

    // Bidirectional edges
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    if (!adj.has(edge.to)) adj.set(edge.to, []);
    adj.get(edge.from).push({ to: edge.to, cost, type: edge.type });
    adj.get(edge.to).push({ to: edge.from, cost, type: edge.type });
  }

  return adj;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate SVG path string from coords array.
 */
export function pathCoordsToSvgPath(pathCoords) {
  if (!pathCoords || pathCoords.length < 2) return '';
  const [first, ...rest] = pathCoords;
  return `M ${first.x} ${first.y} ` + rest.map(c => `L ${c.x} ${c.y}`).join(' ');
}

/**
 * Get the multi-floor graph (for external access).
 */
export function getMultiFloorGraph() {
  return multiFloorGraph;
}
