// Staff roster — exact port from staff_member.dart kSeedStaff
export const kSeedStaff = [
  { id: 'staff_01', name: 'Amit Sharma',  role: 'Head Chef',              floor: 1, zoneId: 'kitchen', skills: ['Fire Fighting', 'Fire Marshal', 'Kitchen Safety'], isAvailable: true },
  { id: 'staff_02', name: 'Rahul Kumar',  role: 'Security Officer',        floor: 3, zoneId: 'corridor_3', skills: ['Fire Marshal', 'Emergency Evacuation', 'First Aid'], isAvailable: true },
  { id: 'staff_03', name: 'Priya Singh',  role: 'Hotel Nurse',             floor: 2, zoneId: 'medical_bay', skills: ['CPR', 'First Aid', 'Medical Emergency', 'AED'], isAvailable: true },
  { id: 'staff_04', name: 'Deepak Verma', role: 'Maintenance Engineer',    floor: 0, zoneId: 'server_room', skills: ['Electrician', 'Gas Safety', 'Hazmat', 'Leak Control'], isAvailable: true },
  { id: 'staff_05', name: 'Sneha Patel',  role: 'Front Desk Manager',      floor: 1, zoneId: 'front_desk', skills: ['Emergency Evacuation', 'Guest Coordination', 'First Aid'], isAvailable: true },
  { id: 'staff_06', name: 'Vikram Nair',  role: 'Duty Manager',            floor: 4, zoneId: 'penthouse', skills: ['Fire Marshal', 'Emergency Evacuation', 'Security'], isAvailable: true },
  { id: 'staff_07', name: 'Anjali Mehta', role: 'Security Guard',          floor: 2, zoneId: 'lobby', skills: ['Security', 'Emergency Evacuation', 'CPR'], isAvailable: true },
  { id: 'staff_08', name: 'Rohit Joshi',  role: 'Electrician',             floor: 3, zoneId: 'electrical_room', skills: ['Electrician', 'Hazmat', 'Fire Fighting'], isAvailable: true },
  { id: 'staff_09', name: 'Kavya Reddy',  role: 'Housekeeping Supervisor', floor: 4, zoneId: 'corridor_4', skills: ['First Aid', 'Emergency Evacuation', 'Leak Control'], isAvailable: true },
  { id: 'staff_10', name: 'Manish Gupta', role: 'F&B Supervisor',          floor: 1, zoneId: 'dining_area', skills: ['Kitchen Safety', 'Fire Fighting', 'First Aid'], isAvailable: true },
];

export function getEta(floor) {
  return `ETA ~${floor * 15 + 30}s`;
}
