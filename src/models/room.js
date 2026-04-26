import { v4 as uuidv4 } from 'uuid';

// ── Room status enum ─────────────────────────────────────────────────────────
export const RoomStatus = {
  SAFE:      'safe',
  UNKNOWN:   'unknown',
  DANGER:    'danger',
  EVACUATED: 'evacuated',
  PANIC:     'panic',        // Resident pressed panic button
};

// ── Create a Room object ─────────────────────────────────────────────────────
export function createRoom({
  id, zoneId, floorId, number, capacity, occupants, status,
} = {}) {
  return {
    id:        id ?? uuidv4(),
    zoneId:    zoneId ?? '',
    floorId:   floorId ?? '',
    number:    number ?? '000',
    capacity:  capacity ?? 2,
    occupants: occupants ?? [],    // [{uid, displayName, status: 'safe'|'unknown'|'panic'}]
    status:    status ?? RoomStatus.UNKNOWN,
  };
}

// ── Seed rooms for demo ──────────────────────────────────────────────────────
export function generateSeedRooms() {
  const rooms = [];

  // Floor 1: Rooms 101-120
  for (let i = 101; i <= 120; i++) {
    rooms.push(createRoom({
      id:      `room_${i}`,
      zoneId:  i <= 110 ? 'zone_rooms_1a' : 'zone_rooms_1b',
      floorId: 'floor_1',
      number:  String(i),
      capacity: 2,
      occupants: i % 3 === 0 ? [] : [{ uid: `guest_${i}`, displayName: `Guest ${i}`, status: 'unknown' }],
    }));
  }

  // Floor 2: Rooms 201-215
  for (let i = 201; i <= 215; i++) {
    rooms.push(createRoom({
      id:      `room_${i}`,
      zoneId:  'zone_rooms_2a',
      floorId: 'floor_2',
      number:  String(i),
      capacity: 2,
      occupants: i % 4 === 0 ? [] : [{ uid: `guest_${i}`, displayName: `Guest ${i}`, status: 'unknown' }],
    }));
  }

  return rooms;
}

// ── Room status color ────────────────────────────────────────────────────────
export const ROOM_STATUS_COLORS = {
  safe:      '#10b981',
  unknown:   '#a1a1aa',
  danger:    '#ef4444',
  evacuated: '#3b82f6',
  panic:     '#dc2626',
};
