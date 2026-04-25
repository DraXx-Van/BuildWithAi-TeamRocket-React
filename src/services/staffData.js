// ── Staff Roster Seed Data ───────────────────────────────────────────────────
// Each staff member has skills spanning BOTH utility work AND emergency response.
// The dispatch engine matches skills to incident types.

export const ISSUE_CATEGORIES = {
  // Utility / Maintenance
  plumbing:    { label: 'Plumbing / Leakage', icon: '🔧', severity: 3, skills: ['Plumbing', 'Leak Control'] },
  electrical:  { label: 'Electrical Issue',   icon: '⚡', severity: 4, skills: ['Electrician', 'Electrical Safety'] },
  cleaning:    { label: 'Cleaning Request',   icon: '🧹', severity: 1, skills: ['Housekeeping', 'Cleaning'] },
  hvac:        { label: 'AC / Heating',       icon: '❄️', severity: 2, skills: ['HVAC', 'Maintenance'] },
  roomService: { label: 'Room Service',       icon: '🍽️', severity: 1, skills: ['Room Service', 'F&B'] },
  maintenance: { label: 'General Repair',     icon: '🔨', severity: 2, skills: ['Maintenance', 'Carpentry'] },

  // Emergency / Calamity
  fire:        { label: 'Fire Emergency',     icon: '🔥', severity: 9, skills: ['Fire Fighting', 'Fire Marshal'], isCrisis: true },
  medical:     { label: 'Medical Emergency',  icon: '🏥', severity: 8, skills: ['CPR', 'First Aid', 'Medical Emergency'], isCrisis: true },
  security:    { label: 'Security Threat',    icon: '🚨', severity: 8, skills: ['Security', 'Emergency Evacuation'], isCrisis: true },
  gas:         { label: 'Gas Leak',           icon: '☁️', severity: 9, skills: ['Gas Safety', 'Hazmat'], isCrisis: true },
  structural:  { label: 'Structural Damage',  icon: '🏚️', severity: 9, skills: ['Structural Engineering', 'Rescue'], isCrisis: true },
  flood:       { label: 'Flooding',           icon: '🌊', severity: 7, skills: ['Leak Control', 'Emergency Evacuation'], isCrisis: true },
};

export const kSeedStaff = [
  // ── Utility / Maintenance Staff ─────────────────────────────────────────
  { id: 'staff_01', name: 'Mukesh Yadav',  role: 'Plumber',                 floor: 0, zoneId: 'utility_room', skills: ['Plumbing', 'Leak Control', 'Maintenance'], isAvailable: true, shift: 'day',   phone: '+91-9800000001' },
  { id: 'staff_02', name: 'Sajin Thomas',  role: 'Room Cleaner',            floor: 2, zoneId: 'corridor_2', skills: ['Housekeeping', 'Cleaning', 'Room Service'], isAvailable: true, shift: 'day',   phone: '+91-9800000002' },
  { id: 'staff_03', name: 'Ravi Patel',    role: 'Electrician',             floor: 0, zoneId: 'server_room', skills: ['Electrician', 'Electrical Safety', 'HVAC', 'Maintenance'], isAvailable: true, shift: 'day',   phone: '+91-9800000003' },
  { id: 'staff_04', name: 'Anita Kumari',  role: 'Housekeeping Supervisor', floor: 3, zoneId: 'corridor_3', skills: ['Housekeeping', 'Cleaning', 'Leak Control', 'First Aid'], isAvailable: true, shift: 'day',   phone: '+91-9800000004' },
  { id: 'staff_05', name: 'Suresh Nair',   role: 'HVAC Technician',         floor: 0, zoneId: 'utility_room', skills: ['HVAC', 'Maintenance', 'Electrician'], isAvailable: true, shift: 'night', phone: '+91-9800000005' },
  { id: 'staff_06', name: 'Lakshmi Devi',  role: 'Room Service Attendant',  floor: 1, zoneId: 'dining_area', skills: ['Room Service', 'F&B', 'Cleaning'], isAvailable: true, shift: 'day',   phone: '+91-9800000006' },

  // ── Emergency / Security Staff ──────────────────────────────────────────
  { id: 'staff_07', name: 'Amit Sharma',   role: 'Head Chef',               floor: 1, zoneId: 'kitchen', skills: ['Fire Fighting', 'Fire Marshal', 'Kitchen Safety'], isAvailable: true, shift: 'day',   phone: '+91-9800000007' },
  { id: 'staff_08', name: 'Rahul Kumar',   role: 'Security Officer',        floor: 3, zoneId: 'corridor_3', skills: ['Security', 'Emergency Evacuation', 'First Aid', 'Fire Marshal'], isAvailable: true, shift: 'night', phone: '+91-9800000008' },
  { id: 'staff_09', name: 'Priya Singh',   role: 'Hotel Nurse',             floor: 2, zoneId: 'medical_bay', skills: ['CPR', 'First Aid', 'Medical Emergency', 'AED'], isAvailable: true, shift: 'day',   phone: '+91-9800000009' },
  { id: 'staff_10', name: 'Deepak Verma',  role: 'Maintenance Engineer',    floor: 0, zoneId: 'server_room', skills: ['Electrician', 'Gas Safety', 'Hazmat', 'Leak Control', 'Plumbing'], isAvailable: true, shift: 'day',   phone: '+91-9800000010' },
  { id: 'staff_11', name: 'Sneha Patel',   role: 'Front Desk Manager',      floor: 1, zoneId: 'front_desk', skills: ['Emergency Evacuation', 'Guest Coordination', 'First Aid'], isAvailable: true, shift: 'day',   phone: '+91-9800000011' },
  { id: 'staff_12', name: 'Vikram Nair',   role: 'Duty Manager',            floor: 4, zoneId: 'penthouse', skills: ['Fire Marshal', 'Emergency Evacuation', 'Security', 'Guest Coordination'], isAvailable: true, shift: 'day',   phone: '+91-9800000012' },
  { id: 'staff_13', name: 'Anjali Mehta',  role: 'Security Guard',          floor: 2, zoneId: 'lobby', skills: ['Security', 'Emergency Evacuation', 'CPR'], isAvailable: true, shift: 'night', phone: '+91-9800000013' },
  { id: 'staff_14', name: 'Rohit Joshi',   role: 'Electrician Sr.',         floor: 3, zoneId: 'electrical_room', skills: ['Electrician', 'Hazmat', 'Fire Fighting', 'Structural Engineering'], isAvailable: true, shift: 'day',   phone: '+91-9800000014' },
  { id: 'staff_15', name: 'Kavya Reddy',   role: 'Housekeeping Lead',       floor: 4, zoneId: 'corridor_4', skills: ['Housekeeping', 'First Aid', 'Emergency Evacuation', 'Leak Control'], isAvailable: true, shift: 'day',   phone: '+91-9800000015' },
];
];

export function getEta(staffFloor, incidentFloor = 1) {
  const diff = Math.abs(staffFloor - (incidentFloor ?? 1));
  return `ETA ~${diff * 15 + 30}s`;
}

/**
 * Compute a match score for a staff member against required skills.
 * @returns {number} 0-100 match percentage
 */
export function computeSkillMatch(staffSkills, requiredSkills) {
  if (!requiredSkills || requiredSkills.length === 0) return 50;
  const staffLower = staffSkills.map(s => s.toLowerCase());
  const reqLower = requiredSkills.map(s => s.toLowerCase());

  let matches = 0;
  for (const req of reqLower) {
    if (staffLower.some(s => s.includes(req) || req.includes(s))) {
      matches++;
    }
  }
  return Math.round((matches / reqLower.length) * 100);
}
