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
        const recent = existing.timestamp >= cutoff;
        const notResolved = existing.status === 'active' || existing.status === 'dispatched';

        if (sameLocation && recent && notResolved) {
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
  const wordsA = new Set(la.split(/\W+/).filter(w => w.length > 3));
  const wordsB = new Set(lb.split(/\W+/).filter(w => w.length > 3));
  for (const w of wordsA) { if (wordsB.has(w)) return true; }
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
export async function findNearestResponder(requiredSkills, incidentFloor) {
  if (!requiredSkills || requiredSkills.length === 0) return null;
  try {
    console.log('[DISPATCH] Finding responder for', requiredSkills, 'near floor', incidentFloor);
    const snap = await getDocs(query(collection(db, 'staff'), where('isAvailable', '==', true)));
    if (snap.empty) return null;

    const all = snap.docs.map(d => d.data());
    const normalised = requiredSkills.map(s => s.toLowerCase());

    let matched = all.filter(staff => {
      const staffSkills = staff.skills.map(s => s.toLowerCase());
      return normalised.some(needed => staffSkills.some(have => have.includes(needed) || needed.includes(have)));
    });

    if (matched.length === 0) {
      const fallback = all[0];
      return `${fallback.name} (${fallback.role}, Floor ${fallback.floor}) — ${getEta(fallback.floor)}`;
    }

    matched.sort((a, b) => Math.abs(a.floor - incidentFloor) - Math.abs(b.floor - incidentFloor));
    const best = matched[0];
    console.log('[DISPATCH] Best match:', best.name, 'on Floor', best.floor);
    return `${best.name} (Floor ${best.floor}) — ${getEta(best.floor)}`;
  } catch (e) {
    console.error('[DISPATCH] Error:', e);
    return null;
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
    if (snap.empty) return kSeedStaff;
    return snap.docs.map(d => d.data()).sort((a, b) => a.floor - b.floor);
  } catch (e) {
    console.error('[FIREBASE] fetchStaff error:', e);
    return kSeedStaff;
  }
}
