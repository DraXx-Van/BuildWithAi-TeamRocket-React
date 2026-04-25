/**
 * Navigation Graph for Floor 1
 * Defines HOW people move between zones. Separated from geometry (GeoJSON).
 *
 * Each node has an (x,y) centroid for SVG path rendering.
 * Each edge has a distance (px-based) and traversal cost.
 *
 * To adapt for a new hotel: create a new graph matching your GeoJSON zone IDs.
 */
const floor1NavGraph = {
  floorId: 'floor_1',
  floorLevel: 1,

  nodes: {
    // ── Room doorways (where guests step into the corridor) ──────
    'n_101': { x: 95,  y: 128, zoneId: 'z_101', label: 'Room 101 Door' },
    'n_102': { x: 175, y: 128, zoneId: 'z_102', label: 'Room 102 Door' },
    'n_103': { x: 255, y: 128, zoneId: 'z_103', label: 'Room 103 Door' },
    'n_104': { x: 335, y: 128, zoneId: 'z_104', label: 'Room 104 Door' },
    'n_105': { x: 415, y: 128, zoneId: 'z_105', label: 'Room 105 Door' },
    'n_106': { x: 495, y: 128, zoneId: 'z_106', label: 'Room 106 Door' },
    'n_107': { x: 575, y: 128, zoneId: 'z_107', label: 'Room 107 Door' },

    'n_108': { x: 95,  y: 182, zoneId: 'z_108', label: 'Room 108 Door' },
    'n_109': { x: 175, y: 182, zoneId: 'z_109', label: 'Room 109 Door' },
    'n_110': { x: 255, y: 182, zoneId: 'z_110', label: 'Room 110 Door' },
    'n_111': { x: 335, y: 182, zoneId: 'z_111', label: 'Room 111 Door' },
    'n_112': { x: 415, y: 182, zoneId: 'z_112', label: 'Room 112 Door' },

    // ── Corridor waypoints (for smooth pathfinding along hallway) ──
    'n_corr_w':  { x: 68,  y: 155, zoneId: 'z_corridor_f1', label: 'Corridor West' },
    'n_corr_c':  { x: 300, y: 155, zoneId: 'z_corridor_f1', label: 'Corridor Center' },
    'n_corr_e':  { x: 600, y: 155, zoneId: 'z_corridor_f1', label: 'Corridor East' },

    // ── Stairs & Elevator ──────────────────────────────────────────
    'n_stair_a': { x: 68,  y: 288, zoneId: 'z_stair_a_f1', label: 'Stair A', is_exit: true },
    'n_stair_b': { x: 578, y: 288, zoneId: 'z_stair_b_f1', label: 'Stair B', is_exit: true },
    'n_elevator': { x: 300, y: 150, zoneId: 'z_elevator_f1', label: 'Elevator' },
  },

  edges: [
    // ── North rooms → corridor ──────────────────────────────────
    { from: 'n_101', to: 'n_corr_w', distance: 30,  is_passable: true },
    { from: 'n_102', to: 'n_corr_w', distance: 50,  is_passable: true },
    { from: 'n_102', to: 'n_corr_c', distance: 60,  is_passable: true },
    { from: 'n_103', to: 'n_corr_c', distance: 50,  is_passable: true },
    { from: 'n_104', to: 'n_corr_c', distance: 40,  is_passable: true },
    { from: 'n_105', to: 'n_corr_c', distance: 60,  is_passable: true },
    { from: 'n_105', to: 'n_corr_e', distance: 80,  is_passable: true },
    { from: 'n_106', to: 'n_corr_e', distance: 50,  is_passable: true },
    { from: 'n_107', to: 'n_corr_e', distance: 30,  is_passable: true },

    // ── South rooms → corridor ──────────────────────────────────
    { from: 'n_108', to: 'n_corr_w', distance: 30,  is_passable: true },
    { from: 'n_109', to: 'n_corr_w', distance: 50,  is_passable: true },
    { from: 'n_109', to: 'n_corr_c', distance: 60,  is_passable: true },
    { from: 'n_110', to: 'n_corr_c', distance: 50,  is_passable: true },
    { from: 'n_111', to: 'n_corr_c', distance: 40,  is_passable: true },
    { from: 'n_112', to: 'n_corr_c', distance: 60,  is_passable: true },

    // ── Corridor spine (west ↔ center ↔ east) ───────────────────
    { from: 'n_corr_w', to: 'n_corr_c', distance: 232, is_passable: true },
    { from: 'n_corr_c', to: 'n_corr_e', distance: 300, is_passable: true },

    // ── Corridor → stairs ───────────────────────────────────────
    { from: 'n_corr_w', to: 'n_stair_a', distance: 135, is_passable: true },
    { from: 'n_corr_e', to: 'n_stair_b', distance: 135, is_passable: true },

    // ── Elevator access ─────────────────────────────────────────
    { from: 'n_corr_c', to: 'n_elevator', distance: 10, is_passable: true },
  ],
};

export default floor1NavGraph;
