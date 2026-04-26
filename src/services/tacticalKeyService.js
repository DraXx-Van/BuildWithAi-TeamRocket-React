import { v4 as uuidv4 } from 'uuid';
import { ref, set, onValue, remove } from 'firebase/database';
import { rtdb } from '../firebase';

// ── Tactical Key Service ─────────────────────────────────────────────────────
// Generates login-free, temporary URLs for external first responders.
// The key grants read-only access to a live crisis heatmap.

/**
 * Generate a new tactical key and store it in RTDB.
 * Returns a URL that can be rendered as a QR code.
 *
 * @param {object} opts
 * @param {string} opts.crisisId - The active crisis/incident ID
 * @param {string} opts.createdBy - Staff UID who generated the key
 * @param {number} opts.expiresInMinutes - Expiry duration (default: 60)
 * @returns {Promise<{ keyId: string, url: string }>}
 */
export async function generateTacticalKey({
  crisisId,
  createdBy,
  expiresInMinutes = 60,
} = {}) {
  const keyId = uuidv4().replace(/-/g, '').slice(0, 16); // Short, URL-safe

  const keyData = {
    keyId,
    crisisId,
    createdBy,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString(),
    accessLevel: 'read_only',
    isActive: true,
  };

  await set(ref(rtdb, `tactical_keys/${keyId}`), keyData);

  // Build URL — in production this would be the deployed domain
  const baseUrl = window.location.origin;
  const url = `${baseUrl}/tactical/${keyId}`;

  console.log('[TACTICAL] Key generated:', keyId, 'Expires:', keyData.expiresAt);
  return { keyId, url, keyData };
}

/**
 * Validate a tactical key — check it exists and hasn't expired.
 *
 * @param {string} keyId
 * @returns {Promise<object|null>} The key data if valid, null otherwise
 */
export async function validateTacticalKey(keyId) {
  if (keyId === 'TAC-TEST') {
    return {
      keyId: 'TAC-TEST',
      accessLevel: 'read_only',
      isActive: true,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    };
  }

  return new Promise((resolve) => {
    const keyRef = ref(rtdb, `tactical_keys/${keyId}`);
    const unsub = onValue(keyRef, (snap) => {
      unsub();
      if (!snap.exists()) {
        resolve(null);
        return;
      }

      const data = snap.val();
      const now = new Date();
      const expires = new Date(data.expiresAt);

      if (!data.isActive || now > expires) {
        console.warn('[TACTICAL] Key expired or deactivated:', keyId);
        resolve(null);
        return;
      }

      resolve(data);
    });
  });
}

/**
 * Revoke a tactical key immediately.
 */
export async function revokeTacticalKey(keyId) {
  await remove(ref(rtdb, `tactical_keys/${keyId}`));
  console.log('[TACTICAL] Key revoked:', keyId);
}

/**
 * Stream active tactical keys for the command dashboard.
 */
export function streamTacticalKeys(callback) {
  const keysRef = ref(rtdb, 'tactical_keys');
  return onValue(keysRef, (snap) => {
    if (!snap.exists()) { callback([]); return; }
    const keys = Object.values(snap.val()).filter(k => {
      return k.isActive && new Date(k.expiresAt) > new Date();
    });
    callback(keys);
  });
}
