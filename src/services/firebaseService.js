import {
  collection, doc, setDoc, getDocs, query, where, writeBatch, limit, orderBy, onSnapshot,
} from 'firebase/firestore';
import { ref, get, set, update, remove, onValue } from 'firebase/database';
import { db, rtdb } from '../firebase';
import { createIncident, incidentFromJson, incidentCopyWith } from '../models/incident';
import { kSeedStaff, getEta } from './staffData';

// ── Firestore: Save to history ───────────────────────────────────────────────
export async function saveIncidentToHistory(incident) {
  await setDoc(doc(db, 'incidents', incident.id), incident);
}

// ── Signal Clustering: mergeOrCreate ────────────────────────────────────────
export async function mergeOrCreateIncident(incoming) {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const snapshot = await get(ref(rtdb, 'live_incidents'));

    if (snapshot.exists()) {
      const data = snapshot.val();
      for (const key of Object.keys(data)) {
        const existing = incidentFromJson(data[key]);
        const sameLocation = locationMatch(existing.location, incoming.location);
        const sameType = existing.type === incoming.type;
        const recent = existing.timestamp >= cutoff;
        const notResolved = existing.status === 'active' || existing.status === 'dispatched';

        if (sameLocation && sameType && recent && notResolved) {
          console.log('[CLUSTER] Merging signal into existing incident', existing.id);
          const merged = incidentCopyWith(existing, {
            severity: incoming.severity > existing.severity ? incoming.severity : existing.severity,
            evidenceLogs: [...existing.evidenceLogs, incoming.description],
            signalCount: existing.signalCount + 1,
            description: incoming.description,
          });
          await set(ref(rtdb, `live_incidents/${merged.id}`), merged);
          return merged;
        }
      }
    }
  } catch (e) {
    console.error('[CLUSTER] Error during merge check:', e);
  }

  console.log('[CLUSTER] No match found. Creating new incident', incoming.id);
  await set(ref(rtdb, `live_incidents/${incoming.id}`), incoming);
  return incoming;
}

function locationMatch(a, b) {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return true;
  
  // Extract specific room/zone names (e.g. BAR, ASSEMBLY, LOBBY)
  // We ignore common words like 'floor', 'room', 'area', 'near'
  const ignore = new Set(['floor', 'room', 'area', 'near', 'side', 'hall', 'first', 'second', 'third']);
  const wordsA = la.split(/\W+/).filter(w => w.length >= 3 && !ignore.has(w));
  const wordsB = lb.split(/\W+/).filter(w => w.length >= 3 && !ignore.has(w));
  
  if (wordsA.length === 0 || wordsB.length === 0) return la.includes(lb) || lb.includes(la);

  // Must have at least one specific keyword match (like 'BAR' or 'ASSEMBLY')
  for (const w of wordsA) { 
    if (wordsB.includes(w)) return true; 
  }
  return false;
}

// ── Confirm Dispatch ─────────────────────────────────────────────────────────
export async function confirmDispatch(incidentId, staffName) {
  try {
    const now = new Date().toISOString();
    await update(ref(rtdb, `live_incidents/${incidentId}`), {
      status: 'dispatched',
      assignedTo: staffName,
      dispatchedAt: now,
    });
    await set(ref(rtdb, `dispatches/${staffName}`), {
      incidentId,
      dispatchedAt: now,
      staffName,
    });
    console.log('[DISPATCH] Confirmed:', staffName, 'for', incidentId);
  } catch (e) {
    console.error('[DISPATCH] Confirm error:', e);
  }
}

// ── Staff Seeding ────────────────────────────────────────────────────────────
export async function seedStaffIfEmpty() {
  try {
    const snap = await getDocs(query(collection(db, 'staff'), limit(1)));
    if (snap.empty) {
      console.log('[FIREBASE] Seeding staff roster...');
      const batch = writeBatch(db);
      for (const s of kSeedStaff) {
        batch.set(doc(db, 'staff', s.id), s);
      }
      await batch.commit();
      console.log('[FIREBASE] Staff seeded:', kSeedStaff.length, 'members.');
    }
  } catch (e) {
    console.error('[FIREBASE] Seed error (non-critical):', e);
  }
}

// ── Find Nearest Responder ───────────────────────────────────────────────────
export async function findNearestResponder(requiredSkills, incidentFloor, incidentLocation = '', currentZones = []) {
  if (!requiredSkills || requiredSkills.length === 0) return null;
  try {
    console.log('[DISPATCH] Finding responder for', requiredSkills, 'near floor', incidentFloor);
    const snap = await getDocs(query(collection(db, 'staff'), where('isAvailable', '==', true)));
    let all = snap.empty ? [] : snap.docs.map(d => d.data());

    const normalised = requiredSkills.map(s => s.toLowerCase());
    let matched = all.filter(staff => {
      const staffSkills = staff.skills.map(s => s.toLowerCase());
      return normalised.some(needed => staffSkills.some(have => have.includes(needed) || needed.includes(have)));
    });

    if (matched.length === 0) {
      console.log('[DISPATCH] No exact match. Falling back to all staff.');
      matched = all;
    }

    // 1. Try to locate the incident on the 2D grid
    const lowerLoc = incidentLocation.toLowerCase();
    const incidentZone = currentZones.find(z => lowerLoc.includes(z.label.toLowerCase()) || lowerLoc.includes(z.id.toLowerCase()));

    // 2. Helper to calculate 2D distance score
    const getDistanceScore = (responder) => {
      if (incidentZone) {
        const rZone = currentZones.find(z => z.id === responder.zoneId);
        if (rZone) {
          const dx = (rZone.left + rZone.width / 2) - (incidentZone.left + incidentZone.width / 2);
          const dy = (rZone.top + rZone.height / 2) - (incidentZone.top + incidentZone.height / 2);
          return Math.sqrt(dx * dx + dy * dy);
        }
      }
      return Math.abs(responder.floor - incidentFloor) * 200; // Fallback: 1 floor diff = 200px equivalent
    };

    // 3. Helper to format ETA
    const getEtaStr = (responder) => {
      if (incidentZone) {
        const rZone = currentZones.find(z => z.id === responder.zoneId);
        if (rZone) {
          const distance = getDistanceScore(responder);
          if (distance < 100) return '1 min (Nearby)';
          if (distance < 300) return '2-3 mins (Same Wing)';
          return '4+ mins (Walking)';
        }
      }
      const diff = Math.abs(responder.floor - incidentFloor);
      if (diff === 0) return '1-2 mins';
      if (diff <= 2) return '3-4 mins';
      return '5+ mins';
    };

    matched.sort((a, b) => getDistanceScore(a) - getDistanceScore(b));
    const best = matched[0];
    console.log('[DISPATCH] Best match:', best.name, 'via 2D Distance');
    return `${best.name} (${best.role}) — ${getEtaStr(best)}`;
  } catch (e) {
    console.error('[DISPATCH] Error:', e);
    return null;
  }
}

// ── Update Incident (Generic) ────────────────────────────────────────────────
export async function updateIncident(incidentId, updates) {
  try {
    await update(ref(rtdb, `live_incidents/${incidentId}`), updates);
  } catch (e) {
    console.error('[FIREBASE] updateIncident error:', e);
  }
}

// ── Resolve Incident ─────────────────────────────────────────────────────────
export async function resolveLiveIncident(incidentId) {
  await remove(ref(rtdb, `live_incidents/${incidentId}`));
}

// ── Live Incidents Stream (RTDB) ─────────────────────────────────────────────
export function streamLiveIncidents(callback) {
  const liveRef = ref(rtdb, 'live_incidents');
  return onValue(liveRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) { callback([]); return; }
    const incidents = Object.values(data)
      .map(v => incidentFromJson(v))
      .sort((a, b) => b.severity - a.severity);
    callback(incidents);
  });
}

// ── Dispatch Stream for Responder HUD ────────────────────────────────────────
export function streamDispatchForStaff(staffName, callback) {
  const dispatchRef = ref(rtdb, `dispatches/${staffName}`);
  return onValue(dispatchRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  });
}

// ── Fetch Staff from Firestore ────────────────────────────────────────────────
export async function fetchStaff() {
  try {
    const snap = await getDocs(query(collection(db, 'staff')));
    if (snap.empty) return [];
    return snap.docs.map(d => d.data()).sort((a, b) => a.floor - b.floor);
  } catch (e) {
    console.error('[FIREBASE] fetchStaff error:', e);
    return kSeedStaff;
  }
}

// ── Floor Plan Zones ─────────────────────────────────────────────────────────
export function streamZones(callback) {
  const zonesRef = ref(rtdb, 'config/zones');
  return onValue(zonesRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() : null);
  });
}

export async function saveZonesToFirebase(zones) {
  await set(ref(rtdb, 'config/zones'), zones);
}
