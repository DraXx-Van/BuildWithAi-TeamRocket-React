/**
 * ── Unified Multi-Floor Navigation Graph ────────────────────────────────────
 * 3D graph connecting ALL floors via stairwell cross-edges.
 * Routes go from any room to Ground Floor Main Exit — not just nearest stairs.
 *
 * Node types (natural waypoints only):
 *   - DOOR: Room doorway where guest exits into corridor
 *   - JUNCTION: Hallway intersection or corridor endpoint
 *   - STAIR: Stairwell entrance (connects across floors)
 *   - ELEVATOR: Elevator lobby (blocked during calamity)
 *   - EXIT: Building exit (route terminates here)
 *
 * Edge properties:
 *   - distance: px-based travel cost
 *   - type: 'hallway' | 'stair_cross' | 'elevator_cross'
 *   - capacity: max simultaneous traversals (for narrow-corridor logic)
 *   - is_passable: dynamic — flipped false when hazard blocks it
 */

const multiFloorGraph = {
  buildingId: 'bldg_main',

  nodes: {
    // ═══════════════════════════════════════════════════════════════════
    // FLOOR 3
    // ═══════════════════════════════════════════════════════════════════
    'f3_301': { x: 110, y: 95,  floor: 3, type: 'door', zoneId: 'z_301', label: 'Room 301' },
    'f3_302': { x: 220, y: 95,  floor: 3, type: 'door', zoneId: 'z_302', label: 'Room 302' },
    'f3_303': { x: 330, y: 95,  floor: 3, type: 'door', zoneId: 'z_303', label: 'Room 303' },
    'f3_pent': { x: 500, y: 95, floor: 3, type: 'door', zoneId: 'z_pent', label: 'Penthouse Suite' },
    'f3_304': { x: 110, y: 235, floor: 3, type: 'door', zoneId: 'z_304', label: 'Room 304' },
    'f3_305': { x: 220, y: 235, floor: 3, type: 'door', zoneId: 'z_305', label: 'Room 305' },
    'f3_rooftop': { x: 380, y: 235, floor: 3, type: 'door', zoneId: 'z_rooftop', label: 'Rooftop Bar' },
    'f3_maint': { x: 540, y: 235, floor: 3, type: 'door', zoneId: 'z_maint', label: 'Maintenance' },
    // Corridor junctions
    'f3_jct_w':  { x: 110, y: 165, floor: 3, type: 'junction', zoneId: 'z_corridor_f3', label: 'F3 Corridor West' },
    'f3_jct_c':  { x: 280, y: 165, floor: 3, type: 'junction', zoneId: 'z_corridor_f3', label: 'F3 Corridor Center' },
    'f3_jct_e':  { x: 540, y: 165, floor: 3, type: 'junction', zoneId: 'z_corridor_f3', label: 'F3 Corridor East' },
    // Stairs and Exits
    'f3_stair_a': { x: 68,  y: 308, floor: 3, type: 'stair', zoneId: 'z_stair_a_f3', label: 'F3 Stair A' },
    'f3_stair_b': { x: 578, y: 308, floor: 3, type: 'stair', zoneId: 'z_stair_b_f3', label: 'F3 Stair B' },
    'f3_elev':    { x: 200, y: 160, floor: 3, type: 'elevator', zoneId: 'z_elevator_f3', label: 'F3 Elevator' },
    'f3_exit_roof': { x: 400, y: 290, floor: 3, type: 'exit', zoneId: 'z_exit_roof', label: 'Roof Access', is_exit: true },

    // ═══════════════════════════════════════════════════════════════════
    // FLOOR 2
    // ═══════════════════════════════════════════════════════════════════
    'f2_201': { x: 95,  y: 90,  floor: 2, type: 'door', zoneId: 'z_201', label: 'Room 201' },
    'f2_202': { x: 175, y: 90,  floor: 2, type: 'door', zoneId: 'z_202', label: 'Room 202' },
    'f2_203': { x: 255, y: 90,  floor: 2, type: 'door', zoneId: 'z_203', label: 'Room 203' },
    'f2_204': { x: 335, y: 90,  floor: 2, type: 'door', zoneId: 'z_204', label: 'Room 204' },
    'f2_205': { x: 415, y: 90,  floor: 2, type: 'door', zoneId: 'z_205', label: 'Room 205' },
    'f2_206': { x: 495, y: 90,  floor: 2, type: 'door', zoneId: 'z_206', label: 'Room 206' },
    'f2_207': { x: 575, y: 90,  floor: 2, type: 'door', zoneId: 'z_207', label: 'Room 207' },
    'f2_208': { x: 95,  y: 220, floor: 2, type: 'door', zoneId: 'z_208', label: 'Room 208' },
    'f2_209': { x: 175, y: 220, floor: 2, type: 'door', zoneId: 'z_209', label: 'Room 209' },
    'f2_210': { x: 255, y: 220, floor: 2, type: 'door', zoneId: 'z_210', label: 'Room 210' },
    // Corridor junctions (hallway centerline y=155)
    'f2_jct_w':  { x: 68,  y: 155, floor: 2, type: 'junction', zoneId: 'z_corridor_f2', label: 'F2 Corridor West' },
    'f2_jct_c':  { x: 300, y: 155, floor: 2, type: 'junction', zoneId: 'z_corridor_f2', label: 'F2 Corridor Center' },
    'f2_jct_e':  { x: 600, y: 155, floor: 2, type: 'junction', zoneId: 'z_corridor_f2', label: 'F2 Corridor East' },
    // Stairs
    'f2_stair_a': { x: 68,  y: 308, floor: 2, type: 'stair', zoneId: 'z_stair_a_f2', label: 'F2 Stair A' },
    'f2_stair_b': { x: 578, y: 308, floor: 2, type: 'stair', zoneId: 'z_stair_b_f2', label: 'F2 Stair B' },
    'f2_elev':    { x: 300, y: 150, floor: 2, type: 'elevator', zoneId: 'z_elevator_f2', label: 'F2 Elevator' },

    // ═══════════════════════════════════════════════════════════════════
    // FLOOR 1
    // ═══════════════════════════════════════════════════════════════════
    'f1_101': { x: 95,  y: 90,  floor: 1, type: 'door', zoneId: 'z_101', label: 'Room 101' },
    'f1_102': { x: 175, y: 90,  floor: 1, type: 'door', zoneId: 'z_102', label: 'Room 102' },
    'f1_103': { x: 255, y: 90,  floor: 1, type: 'door', zoneId: 'z_103', label: 'Room 103' },
    'f1_104': { x: 335, y: 90,  floor: 1, type: 'door', zoneId: 'z_104', label: 'Room 104' },
    'f1_105': { x: 415, y: 90,  floor: 1, type: 'door', zoneId: 'z_105', label: 'Room 105' },
    'f1_106': { x: 495, y: 90,  floor: 1, type: 'door', zoneId: 'z_106', label: 'Room 106' },
    'f1_107': { x: 575, y: 90,  floor: 1, type: 'door', zoneId: 'z_107', label: 'Room 107' },
    'f1_108': { x: 95,  y: 220, floor: 1, type: 'door', zoneId: 'z_108', label: 'Room 108' },
    'f1_109': { x: 175, y: 220, floor: 1, type: 'door', zoneId: 'z_109', label: 'Room 109' },
    'f1_110': { x: 255, y: 220, floor: 1, type: 'door', zoneId: 'z_110', label: 'Room 110' },
    'f1_111': { x: 335, y: 220, floor: 1, type: 'door', zoneId: 'z_111', label: 'Room 111' },
    'f1_112': { x: 415, y: 220, floor: 1, type: 'door', zoneId: 'z_112', label: 'Room 112' },
    // Corridor junctions
    'f1_jct_w':  { x: 68,  y: 155, floor: 1, type: 'junction', zoneId: 'z_corridor_f1', label: 'F1 Corridor West' },
    'f1_jct_c':  { x: 300, y: 155, floor: 1, type: 'junction', zoneId: 'z_corridor_f1', label: 'F1 Corridor Center' },
    'f1_jct_e':  { x: 600, y: 155, floor: 1, type: 'junction', zoneId: 'z_corridor_f1', label: 'F1 Corridor East' },
    // Stairs
    'f1_stair_a': { x: 68,  y: 308, floor: 1, type: 'stair', zoneId: 'z_stair_a_f1', label: 'F1 Stair A' },
    'f1_stair_b': { x: 578, y: 308, floor: 1, type: 'stair', zoneId: 'z_stair_b_f1', label: 'F1 Stair B' },
    'f1_elev':    { x: 300, y: 150, floor: 1, type: 'elevator', zoneId: 'z_elevator_f1', label: 'F1 Elevator' },

    // ═══════════════════════════════════════════════════════════════════
    // GROUND FLOOR
    // ═══════════════════════════════════════════════════════════════════
    'g_lobby_w':   { x: 130, y: 140, floor: 0, type: 'junction', zoneId: 'z_lobby', label: 'Lobby West' },
    'g_lobby_c':   { x: 250, y: 140, floor: 0, type: 'junction', zoneId: 'z_lobby', label: 'Lobby Center' },
    'g_lobby_e':   { x: 370, y: 140, floor: 0, type: 'junction', zoneId: 'z_lobby', label: 'Lobby East' },
    'g_stair_a':   { x: 68,  y: 358, floor: 0, type: 'stair', zoneId: 'z_stair_a_g', label: 'G Stair A' },
    'g_stair_b':   { x: 578, y: 218, floor: 0, type: 'stair', zoneId: 'z_stair_b_g', label: 'G Stair B' },
    'g_elev':      { x: 110, y: 240, floor: 0, type: 'elevator', zoneId: 'z_elevator_g', label: 'G Elevator' },
    // Building exits
    'g_exit_main': { x: 250, y: 35,  floor: 0, type: 'exit', zoneId: 'z_exit_main', label: 'Main Entrance', is_exit: true },
    'g_exit_east': { x: 650, y: 340, floor: 0, type: 'exit', zoneId: 'z_exit_east', label: 'East Exit', is_exit: true },
    'g_exit_west': { x: 30,  y: 160, floor: 0, type: 'exit', zoneId: 'z_exit_west', label: 'West Exit', is_exit: true },
  },

  edges: [
    // ═══════════════════════════════════════════════════════════════════
    // FLOOR 3 — INTRA-FLOOR
    // ═══════════════════════════════════════════════════════════════════
    { from: 'f3_301', to: 'f3_jct_w', distance: 70,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f3_302', to: 'f3_jct_c', distance: 100, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f3_303', to: 'f3_jct_c', distance: 70,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f3_pent', to: 'f3_jct_e', distance: 80,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f3_304', to: 'f3_jct_w', distance: 70,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f3_305', to: 'f3_jct_c', distance: 100, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f3_rooftop', to: 'f3_jct_e', distance: 180, type: 'hallway', capacity: 8, is_passable: true },
    { from: 'f3_maint', to: 'f3_jct_e', distance: 70,  type: 'hallway', capacity: 2, is_passable: true },
    // Corridor spine
    { from: 'f3_jct_w', to: 'f3_jct_c', distance: 170, type: 'hallway', capacity: 6, is_passable: true },
    { from: 'f3_jct_c', to: 'f3_jct_e', distance: 260, type: 'hallway', capacity: 6, is_passable: true },
    // Corridor → stairs/elevator/exits
    { from: 'f3_jct_w', to: 'f3_stair_a', distance: 150, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f3_jct_e', to: 'f3_stair_b', distance: 150, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f3_jct_w', to: 'f3_elev',    distance: 90,  type: 'hallway', capacity: 2, is_passable: true },
    { from: 'f3_rooftop', to: 'f3_exit_roof', distance: 60, type: 'hallway', capacity: 6, is_passable: true },

    // ═══════════════════════════════════════════════════════════════════
    // FLOOR 2 — INTRA-FLOOR (hallway centerline routing)
    // ═══════════════════════════════════════════════════════════════════
    // North rooms → corridor junctions (doors perpendicular to hallway)
    { from: 'f2_201', to: 'f2_jct_w', distance: 70,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f2_202', to: 'f2_jct_w', distance: 120, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f2_203', to: 'f2_jct_c', distance: 70,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f2_204', to: 'f2_jct_c', distance: 40,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f2_205', to: 'f2_jct_c', distance: 120, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f2_205', to: 'f2_jct_e', distance: 190, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f2_206', to: 'f2_jct_e', distance: 120, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f2_207', to: 'f2_jct_e', distance: 70,  type: 'hallway', capacity: 4, is_passable: true },
    // South rooms
    { from: 'f2_208', to: 'f2_jct_w', distance: 70,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f2_209', to: 'f2_jct_w', distance: 120, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f2_209', to: 'f2_jct_c', distance: 130, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f2_210', to: 'f2_jct_c', distance: 70,  type: 'hallway', capacity: 4, is_passable: true },
    // Corridor spine
    { from: 'f2_jct_w', to: 'f2_jct_c', distance: 232, type: 'hallway', capacity: 6, is_passable: true },
    { from: 'f2_jct_c', to: 'f2_jct_e', distance: 300, type: 'hallway', capacity: 6, is_passable: true },
    // Corridor → stairs/elevator
    { from: 'f2_jct_w', to: 'f2_stair_a', distance: 155, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f2_jct_e', to: 'f2_stair_b', distance: 155, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f2_jct_c', to: 'f2_elev',    distance: 10,  type: 'hallway', capacity: 2, is_passable: true },

    // ═══════════════════════════════════════════════════════════════════
    // FLOOR 1 — INTRA-FLOOR
    // ═══════════════════════════════════════════════════════════════════
    { from: 'f1_101', to: 'f1_jct_w', distance: 70,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_102', to: 'f1_jct_w', distance: 120, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_103', to: 'f1_jct_c', distance: 70,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_104', to: 'f1_jct_c', distance: 40,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_105', to: 'f1_jct_c', distance: 120, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_105', to: 'f1_jct_e', distance: 190, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_106', to: 'f1_jct_e', distance: 120, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_107', to: 'f1_jct_e', distance: 70,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_108', to: 'f1_jct_w', distance: 70,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_109', to: 'f1_jct_w', distance: 120, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_110', to: 'f1_jct_c', distance: 70,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_111', to: 'f1_jct_c', distance: 40,  type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_112', to: 'f1_jct_c', distance: 120, type: 'hallway', capacity: 4, is_passable: true },
    // Corridor spine
    { from: 'f1_jct_w', to: 'f1_jct_c', distance: 232, type: 'hallway', capacity: 6, is_passable: true },
    { from: 'f1_jct_c', to: 'f1_jct_e', distance: 300, type: 'hallway', capacity: 6, is_passable: true },
    // Corridor → stairs/elevator
    { from: 'f1_jct_w', to: 'f1_stair_a', distance: 155, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_jct_e', to: 'f1_stair_b', distance: 155, type: 'hallway', capacity: 4, is_passable: true },
    { from: 'f1_jct_c', to: 'f1_elev',    distance: 10,  type: 'hallway', capacity: 2, is_passable: true },

    // ═══════════════════════════════════════════════════════════════════
    // GROUND FLOOR — INTRA-FLOOR
    // ═══════════════════════════════════════════════════════════════════
    { from: 'g_lobby_w', to: 'g_lobby_c', distance: 120, type: 'hallway', capacity: 10, is_passable: true },
    { from: 'g_lobby_c', to: 'g_lobby_e', distance: 120, type: 'hallway', capacity: 10, is_passable: true },
    { from: 'g_stair_a', to: 'g_lobby_w', distance: 220, type: 'hallway', capacity: 4,  is_passable: true },
    { from: 'g_stair_b', to: 'g_lobby_e', distance: 210, type: 'hallway', capacity: 4,  is_passable: true },
    { from: 'g_elev',    to: 'g_lobby_w', distance: 100, type: 'hallway', capacity: 2,  is_passable: true },
    // Lobby → exits
    { from: 'g_lobby_c', to: 'g_exit_main', distance: 110, type: 'hallway', capacity: 8, is_passable: true },
    { from: 'g_lobby_e', to: 'g_exit_east', distance: 320, type: 'hallway', capacity: 6, is_passable: true },
    { from: 'g_lobby_w', to: 'g_exit_west', distance: 120, type: 'hallway', capacity: 4, is_passable: true },

    // ═══════════════════════════════════════════════════════════════════
    // CROSS-FLOOR EDGES — Stairs (one flight = ~200 cost units)
    // ═══════════════════════════════════════════════════════════════════
    { from: 'f3_stair_a', to: 'f2_stair_a', distance: 200, type: 'stair_cross', capacity: 3, is_passable: true },
    { from: 'f3_stair_b', to: 'f2_stair_b', distance: 200, type: 'stair_cross', capacity: 3, is_passable: true },
    { from: 'f2_stair_a', to: 'f1_stair_a', distance: 200, type: 'stair_cross', capacity: 3, is_passable: true },
    { from: 'f2_stair_b', to: 'f1_stair_b', distance: 200, type: 'stair_cross', capacity: 3, is_passable: true },
    { from: 'f1_stair_a', to: 'g_stair_a',  distance: 200, type: 'stair_cross', capacity: 3, is_passable: true },
    { from: 'f1_stair_b', to: 'g_stair_b',  distance: 200, type: 'stair_cross', capacity: 3, is_passable: true },

    // ═══════════════════════════════════════════════════════════════════
    // CROSS-FLOOR EDGES — Elevator (blocked during calamity)
    // ═══════════════════════════════════════════════════════════════════
    { from: 'f3_elev', to: 'f2_elev', distance: 60,  type: 'elevator_cross', capacity: 8, is_passable: true },
    { from: 'f2_elev', to: 'f1_elev', distance: 60,  type: 'elevator_cross', capacity: 8, is_passable: true },
    { from: 'f1_elev', to: 'g_elev',  distance: 60,  type: 'elevator_cross', capacity: 8, is_passable: true },
  ],
};

export default multiFloorGraph;
