import {
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

// ── User roles ───────────────────────────────────────────────────────────────
export const UserRole = {
  COMMAND:    'command',     // Manager / Command Dashboard
  STAFF:      'staff',       // Hotel staff / PWA
  RESIDENT:   'resident',    // Room occupant / Room Tab
  RESPONDER:  'responder',   // External first responder / Tactical Key
};

// ── Anonymous Sign-In (for Residents & First Responders) ─────────────────────
export async function signInAsResident(roomNumber, displayName) {
  try {
    const cred = await signInAnonymously(auth);
    await updateProfile(cred.user, { displayName: displayName || `Room ${roomNumber}` });

    // Store resident profile in Firestore
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      role: UserRole.RESIDENT,
      roomNumber,
      displayName: displayName || `Room ${roomNumber}`,
      status: 'safe',
      createdAt: new Date().toISOString(),
    });

    console.log('[AUTH] Resident signed in:', cred.user.uid, 'Room:', roomNumber);
    return cred.user;
  } catch (e) {
    console.error('[AUTH] Resident sign-in error:', e);
    throw e;
  }
}

// ── Staff / Command Sign-In ──────────────────────────────────────────────────
export async function signInStaff(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log('[AUTH] Staff signed in:', cred.user.email);
    return cred.user;
  } catch (e) {
    console.error('[AUTH] Staff sign-in error:', e);
    throw e;
  }
}

// ── Register Staff Account ───────────────────────────────────────────────────
export async function registerStaff(email, password, displayName, role = UserRole.STAFF) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });

    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email,
      displayName,
      role,
      isAvailable: true,
      createdAt: new Date().toISOString(),
    });

    console.log('[AUTH] Staff registered:', email, 'Role:', role);
    return cred.user;
  } catch (e) {
    console.error('[AUTH] Registration error:', e);
    throw e;
  }
}

// ── Sign Out ─────────────────────────────────────────────────────────────────
export async function signOutUser() {
  try {
    await signOut(auth);
    console.log('[AUTH] User signed out');
  } catch (e) {
    console.error('[AUTH] Sign-out error:', e);
    throw e;
  }
}

// ── Get User Profile ─────────────────────────────────────────────────────────
export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error('[AUTH] Get profile error:', e);
    return null;
  }
}

// ── Auth State Observer ──────────────────────────────────────────────────────
export function observeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
