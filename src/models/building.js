// ── Building Knowledge Graph ─────────────────────────────────────────────────
// Represents the physical structure: Building → Floors → Zones → Rooms
// Used by the evacuation engine and SVG floor plan renderer.

import { v4 as uuidv4 } from 'uuid';

// ── Zone danger levels ───────────────────────────────────────────────────────
export const DangerLevel = {
  SAFE:     'safe',
  CAUTION:  'caution',
  DANGER:   'danger',
  CRITICAL: 'critical',
};

export const DANGER_COLORS = {
  safe:     '#10b981',
  caution:  '#f59e0b',
  danger:   '#ef4444',
  critical: '#dc2626',
};

// ── Zone types ───────────────────────────────────────────────────────────────
export const ZoneType = {
  LOBBY:      'lobby',
  CORRIDOR:   'corridor',
  ROOM_BLOCK: 'room_block',
  STAIRWELL:  'stairwell',
  ELEVATOR:   'elevator',
  KITCHEN:    'kitchen',
  RESTAURANT: 'restaurant',
  POOL:       'pool',
  SERVER:     'server_room',
  UTILITY:    'utility',
  PARKING:    'parking',
  CONFERENCE: 'conference',
  EXIT:       'exit',
};

// ── Create functions ─────────────────────────────────────────────────────────
export function createBuilding({
  id, name, address, totalFloors, geoCoordinates,
} = {}) {
  return {
    id:              id ?? uuidv4(),
    name:            name ?? 'CrisisFlow Hotel',
    address:         address ?? '',
    totalFloors:     totalFloors ?? 5,
    geoCoordinates:  geoCoordinates ?? { lat: 0, lng: 0 },
    createdAt:       new Date().toISOString(),
  };
}

export function createFloor({
  id, buildingId, level, name, svgPath,
} = {}) {
  return {
    id:         id ?? uuidv4(),
    buildingId: buildingId ?? '',
    level:      level ?? 0,
    name:       name ?? `Floor ${level}`,
    svgPath:    svgPath ?? null,
  };
}

export function createZone({
  id, floorId, name, type, capacity, exits, adjacentZones,
  svgCoords, dangerLevel,
} = {}) {
  return {
    id:             id ?? uuidv4(),
    floorId:        floorId ?? '',
    name:           name ?? 'Unknown Zone',
    type:           type ?? ZoneType.ROOM_BLOCK,
    capacity:       capacity ?? 0,
    exits:          exits ?? [],
    adjacentZones:  adjacentZones ?? [],   // Graph edges: [{zoneId, distance, isStairwell}]
    svgCoords:      svgCoords ?? { x: 0, y: 0, width: 100, height: 80 },
    dangerLevel:    dangerLevel ?? DangerLevel.SAFE,
  };
}

// ── Default hotel seed data ──────────────────────────────────────────────────
export const SEED_BUILDING = createBuilding({
  id: 'bldg_main',
  name: 'CrisisFlow Grand Hotel',
  address: '1 Emergency Response Blvd',
  totalFloors: 5,
  geoCoordinates: { lat: 19.076, lng: 72.8777 }, // Mumbai
});

export const SEED_FLOORS = [
  createFloor({ id: 'floor_b1', buildingId: 'bldg_main', level: -1, name: 'Basement (B1)' }),
  createFloor({ id: 'floor_g',  buildingId: 'bldg_main', level: 0,  name: 'Ground Floor' }),
  createFloor({ id: 'floor_1',  buildingId: 'bldg_main', level: 1,  name: 'Floor 1' }),
  createFloor({ id: 'floor_2',  buildingId: 'bldg_main', level: 2,  name: 'Floor 2' }),
  createFloor({ id: 'floor_3',  buildingId: 'bldg_main', level: 3,  name: 'Floor 3' }),
  createFloor({ id: 'floor_4',  buildingId: 'bldg_main', level: 4,  name: 'Floor 4' }),
];

export const SEED_ZONES = [
  // Basement
  createZone({ id: 'zone_kitchen',     floorId: 'floor_b1', name: 'Kitchen',        type: ZoneType.KITCHEN,   capacity: 20, exits: ['exit_b1_north'], adjacentZones: [{ zoneId: 'zone_utility', distance: 1 }, { zoneId: 'zone_stair_b1', distance: 2 }], svgCoords: { x: 40, y: 40, width: 200, height: 140 } }),
  createZone({ id: 'zone_utility',     floorId: 'floor_b1', name: 'Utility Room',   type: ZoneType.UTILITY,   capacity: 5,  exits: [],                adjacentZones: [{ zoneId: 'zone_kitchen', distance: 1 }, { zoneId: 'zone_server', distance: 1 }],   svgCoords: { x: 260, y: 40, width: 160, height: 140 } }),
  createZone({ id: 'zone_server',      floorId: 'floor_b1', name: 'Server Room',    type: ZoneType.SERVER,    capacity: 3,  exits: [],                adjacentZones: [{ zoneId: 'zone_utility', distance: 1 }],                                         svgCoords: { x: 440, y: 40, width: 140, height: 140 } }),
  createZone({ id: 'zone_stair_b1',    floorId: 'floor_b1', name: 'Stairwell B1',   type: ZoneType.STAIRWELL, capacity: 10, exits: ['exit_b1_stair'],  adjacentZones: [{ zoneId: 'zone_kitchen', distance: 2 }, { zoneId: 'zone_lobby', distance: 1, isStairwell: true }], svgCoords: { x: 40, y: 200, width: 80, height: 80 } }),

  // Ground Floor
  createZone({ id: 'zone_lobby',       floorId: 'floor_g',  name: 'Main Lobby',     type: ZoneType.LOBBY,     capacity: 100, exits: ['exit_main'],     adjacentZones: [{ zoneId: 'zone_front_desk', distance: 1 }, { zoneId: 'zone_restaurant', distance: 2 }, { zoneId: 'zone_stair_g', distance: 1 }], svgCoords: { x: 40, y: 40, width: 240, height: 160 } }),
  createZone({ id: 'zone_front_desk',  floorId: 'floor_g',  name: 'Front Desk',     type: ZoneType.LOBBY,     capacity: 15,  exits: [],                adjacentZones: [{ zoneId: 'zone_lobby', distance: 1 }],                                           svgCoords: { x: 300, y: 40, width: 160, height: 80 } }),
  createZone({ id: 'zone_restaurant',  floorId: 'floor_g',  name: 'Restaurant',     type: ZoneType.RESTAURANT,capacity: 80,  exits: ['exit_east'],     adjacentZones: [{ zoneId: 'zone_lobby', distance: 2 }, { zoneId: 'zone_pool', distance: 3, isStairwell: true }], svgCoords: { x: 300, y: 140, width: 160, height: 120 } }),
  createZone({ id: 'zone_stair_g',     floorId: 'floor_g',  name: 'Stairwell G',    type: ZoneType.STAIRWELL, capacity: 15,  exits: ['exit_stair_g'],  adjacentZones: [{ zoneId: 'zone_lobby', distance: 1 }, { zoneId: 'zone_corridor_1', distance: 1, isStairwell: true }, { zoneId: 'zone_stair_b1', distance: 1, isStairwell: true }], svgCoords: { x: 40, y: 220, width: 80, height: 80 } }),

  // Floor 1
  createZone({ id: 'zone_corridor_1',  floorId: 'floor_1',  name: 'Corridor 1',     type: ZoneType.CORRIDOR,  capacity: 30, exits: [],                 adjacentZones: [{ zoneId: 'zone_rooms_1a', distance: 1 }, { zoneId: 'zone_rooms_1b', distance: 1 }, { zoneId: 'zone_stair_1', distance: 1 }], svgCoords: { x: 40, y: 100, width: 520, height: 40 } }),
  createZone({ id: 'zone_rooms_1a',    floorId: 'floor_1',  name: 'Rooms 101-110',  type: ZoneType.ROOM_BLOCK,capacity: 20, exits: [],                 adjacentZones: [{ zoneId: 'zone_corridor_1', distance: 1 }],                                       svgCoords: { x: 40, y: 40, width: 240, height: 50 } }),
  createZone({ id: 'zone_rooms_1b',    floorId: 'floor_1',  name: 'Rooms 111-120',  type: ZoneType.ROOM_BLOCK,capacity: 20, exits: [],                 adjacentZones: [{ zoneId: 'zone_corridor_1', distance: 1 }],                                       svgCoords: { x: 300, y: 40, width: 240, height: 50 } }),
  createZone({ id: 'zone_stair_1',     floorId: 'floor_1',  name: 'Stairwell F1',   type: ZoneType.STAIRWELL, capacity: 15, exits: ['exit_stair_1'],   adjacentZones: [{ zoneId: 'zone_corridor_1', distance: 1 }, { zoneId: 'zone_stair_g', distance: 1, isStairwell: true }, { zoneId: 'zone_corridor_2', distance: 1, isStairwell: true }], svgCoords: { x: 40, y: 160, width: 80, height: 80 } }),

  // Floor 2
  createZone({ id: 'zone_corridor_2',  floorId: 'floor_2',  name: 'Corridor 2',     type: ZoneType.CORRIDOR,  capacity: 30, exits: [],                 adjacentZones: [{ zoneId: 'zone_rooms_2a', distance: 1 }, { zoneId: 'zone_pool', distance: 2 }, { zoneId: 'zone_stair_2', distance: 1 }], svgCoords: { x: 40, y: 100, width: 520, height: 40 } }),
  createZone({ id: 'zone_rooms_2a',    floorId: 'floor_2',  name: 'Rooms 201-215',  type: ZoneType.ROOM_BLOCK,capacity: 30, exits: [],                 adjacentZones: [{ zoneId: 'zone_corridor_2', distance: 1 }],                                       svgCoords: { x: 40, y: 40, width: 320, height: 50 } }),
  createZone({ id: 'zone_pool',        floorId: 'floor_2',  name: 'Pool & Spa',     type: ZoneType.POOL,      capacity: 40, exits: ['exit_pool'],      adjacentZones: [{ zoneId: 'zone_corridor_2', distance: 2 }],                                       svgCoords: { x: 380, y: 40, width: 180, height: 120 } }),
  createZone({ id: 'zone_stair_2',     floorId: 'floor_2',  name: 'Stairwell F2',   type: ZoneType.STAIRWELL, capacity: 15, exits: [],                 adjacentZones: [{ zoneId: 'zone_corridor_2', distance: 1 }, { zoneId: 'zone_stair_1', distance: 1, isStairwell: true }], svgCoords: { x: 40, y: 160, width: 80, height: 80 } }),
];
