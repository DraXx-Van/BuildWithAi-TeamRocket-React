/**
 * GeoJSON FeatureCollection for Floor 1
 * Geometry is separated from logic — this file defines WHERE walls/rooms are.
 * The navigation_graph defines HOW people move between them.
 *
 * To add a new hotel: create a new geojson file with the same schema.
 * Upload to Firestore collection `floorplans/{buildingId}/floors/{floorId}`
 */
const floor1GeoJSON = {
  type: 'FeatureCollection',
  metadata: {
    buildingId: 'bldg_main',
    floorId: 'floor_1',
    floorLevel: 1,
    label: 'Floor 1',
    short: 'F1',
    viewport: { width: 680, height: 400 },
  },
  features: [
    // ── Guest Rooms (North Wing) ───────────────────────────────────
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[60,60],[130,60],[130,120],[60,120],[60,60]]] },
      properties: { id: 'z_101', name: '101', room_number: '101', type: 'room', is_passable: true, capacity: 2, color: '#252530' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[140,60],[210,60],[210,120],[140,120],[140,60]]] },
      properties: { id: 'z_102', name: '102', room_number: '102', type: 'room', is_passable: true, capacity: 2, color: '#252530' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[220,60],[290,60],[290,120],[220,120],[220,60]]] },
      properties: { id: 'z_103', name: '103', room_number: '103', type: 'room', is_passable: true, capacity: 2, color: '#252530' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[300,60],[370,60],[370,120],[300,120],[300,60]]] },
      properties: { id: 'z_104', name: '104', room_number: '104', type: 'room', is_passable: true, capacity: 2, color: '#252530' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[380,60],[450,60],[450,120],[380,120],[380,60]]] },
      properties: { id: 'z_105', name: '105', room_number: '105', type: 'room', is_passable: true, capacity: 2, color: '#252530' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[460,60],[530,60],[530,120],[460,120],[460,60]]] },
      properties: { id: 'z_106', name: '106', room_number: '106', type: 'room', is_passable: true, capacity: 2, color: '#252530' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[540,60],[610,60],[610,120],[540,120],[540,60]]] },
      properties: { id: 'z_107', name: '107', room_number: '107', type: 'room', is_passable: true, capacity: 2, color: '#252530' } },

    // ── Guest Rooms (South Wing) ──────────────────────────────────
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[60,190],[130,190],[130,250],[60,250],[60,190]]] },
      properties: { id: 'z_108', name: '108', room_number: '108', type: 'room', is_passable: true, capacity: 2, color: '#252530' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[140,190],[210,190],[210,250],[140,250],[140,190]]] },
      properties: { id: 'z_109', name: '109', room_number: '109', type: 'room', is_passable: true, capacity: 2, color: '#252530' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[220,190],[290,190],[290,250],[220,250],[220,190]]] },
      properties: { id: 'z_110', name: '110', room_number: '110', type: 'room', is_passable: true, capacity: 2, color: '#252530' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[300,190],[370,190],[370,250],[300,250],[300,190]]] },
      properties: { id: 'z_111', name: '111', room_number: '111', type: 'room', is_passable: true, capacity: 2, color: '#252530' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[380,190],[450,190],[450,250],[380,250],[380,190]]] },
      properties: { id: 'z_112', name: '112', room_number: '112', type: 'room', is_passable: true, capacity: 2, color: '#252530' } },

    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[460,190],[540,190],[540,250],[460,250],[460,190]]] },
      properties: { id: 'z_housekeep1', name: 'Housekeeping', type: 'utility', is_passable: true, capacity: 3, color: '#252530' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[550,190],[610,190],[610,250],[550,250],[550,190]]] },
      properties: { id: 'z_ice1', name: 'Ice/Vending', type: 'utility', is_passable: true, capacity: 5, color: '#252530' } },

    // ── Food & Beverage ───────────────────────────────────────────
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[60,270],[200,270],[200,360],[60,360],[60,270]]] },
      properties: { id: 'z_kitchen_f1', name: 'Kitchen', type: 'kitchen', is_passable: true, capacity: 15, color: '#252530' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[210,270],[400,270],[400,360],[210,360],[210,270]]] },
      properties: { id: 'z_restaurant_f1', name: 'Restaurant', type: 'restaurant', is_passable: true, capacity: 80, color: '#252530' } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[410,270],[560,270],[560,360],[410,360],[410,270]]] },
      properties: { id: 'z_lobby_f1', name: 'Lobby', type: 'lobby', is_passable: true, capacity: 50, color: '#252530' } },

    // ── Corridor (Central Hallway) ────────────────────────────────
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[60,128],[610,128],[610,182],[60,182],[60,128]]] },
      properties: { id: 'z_corridor_f1', name: 'Main Corridor', type: 'hallway', is_passable: true, capacity: 30, color: 'rgba(255,255,255,0.04)' } },

    // ── Stairs ────────────────────────────────────────────────────
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[50,270],[86,270],[86,306],[50,306],[50,270]]] },
      properties: { id: 'z_stair_a_f1', name: 'Stair A', type: 'stair', is_passable: true, capacity: 10, connects_to_floor: [0, 2] } },
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[560,270],[596,270],[596,306],[560,306],[560,270]]] },
      properties: { id: 'z_stair_b_f1', name: 'Stair B', type: 'stair', is_passable: true, capacity: 10, connects_to_floor: [0, 2] } },

    // ── Elevator ──────────────────────────────────────────────────
    { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[286,136],[314,136],[314,164],[286,164],[286,136]]] },
      properties: { id: 'z_elevator_f1', name: 'Elevator', type: 'elevator', is_passable: true, capacity: 8, connects_to_floor: [-1, 0, 1, 2, 3] } },
  ],
};

export default floor1GeoJSON;
