import { create } from 'zustand';
import {
  signInStaff, signInAsResident, registerStaff, signOutUser,
  getUserProfile, observeAuthState, UserRole,
} from '../services/authService';

// ── Auth Store ───────────────────────────────────────────────────────────────
const useAuthStore = create((set, get) => ({
  // State
  user: null,
  profile: null,
  role: null,
  isLoading: true,
  error: null,
  unsubscribe: null,
  isDemoMode: false,

  // ── Initialize auth observer ─────────────────────────────────────────────
  init: () => {
    // Check if we have a persisted demo session
    const demoSession = sessionStorage.getItem('crisisflow_demo');
    if (demoSession) {
      const parsed = JSON.parse(demoSession);
      set({
        user: parsed.user,
        profile: parsed.profile,
        role: parsed.role,
        isDemoMode: true,
        isLoading: false,
      });
      return;
    }

    const unsubscribe = observeAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await getUserProfile(firebaseUser.uid);
        set({
          user: firebaseUser,
          profile,
          role: profile?.role || UserRole.RESIDENT,
          isLoading: false,
          error: null,
        });
      } else {
        set({ user: null, profile: null, role: null, isLoading: false });
      }
    });
    set({ unsubscribe });
  },

  cleanup: () => {
    const { unsubscribe } = get();
    if (unsubscribe) unsubscribe();
  },

  // ── Demo Mode — instant access for development ───────────────────────────
  enterDemoMode: (role = UserRole.COMMAND) => {
    const demoUser = {
      uid: role === UserRole.STAFF ? 'staff_demo_001' :
           role === UserRole.RESIDENT ? 'resident_demo_201' : 'demo_user_001',
      displayName: role === UserRole.COMMAND ? 'Capt. Arjun Mehta' :
                    role === UserRole.STAFF ? 'Ravi Kumar' : 'Guest',
      email: role === UserRole.COMMAND ? 'arjun.mehta@crisisflow.io' :
             role === UserRole.STAFF ? 'ravi.kumar@crisisflow.io' : 'guest@crisisflow.io',
    };
    const demoProfile = {
      uid: demoUser.uid,
      displayName: demoUser.displayName,
      email: demoUser.email,
      role,
      isAvailable: true,
      isDemoAccount: true,
      // ── Resident-specific fields ──
      ...(role === UserRole.RESIDENT && {
        roomNumber: '201',
        floor: 2,
        guestName: 'Guest',
        checkIn: new Date().toISOString(),
      }),
      // ── Staff-specific fields ──
      ...(role === UserRole.STAFF && {
        staffId: 'staff_demo_001',
        skills: ['Fire Fighting', 'First Aid', 'Emergency Evacuation'],
        floor: 1,
        shift: 'Day Shift (06:00 – 18:00)',
        department: 'Safety & Security',
        badgeNumber: 'CF-1042',
      }),
      // ── Command-specific fields ──
      ...(role === UserRole.COMMAND && {
        clearanceLevel: 'ALPHA',
        department: 'Crisis Command',
      }),
    };

    // Persist in sessionStorage so refreshes don't kick you out
    sessionStorage.setItem('crisisflow_demo', JSON.stringify({
      user: demoUser,
      profile: demoProfile,
      role,
    }));

    set({
      user: demoUser,
      profile: demoProfile,
      role,
      isDemoMode: true,
      isLoading: false,
      error: null,
    });

    console.log('[AUTH] Demo mode activated — Role:', role);
  },

  // ── Actions ──────────────────────────────────────────────────────────────
  loginAsStaff: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      await signInStaff(email, password);
      // Auth observer will update state
    } catch (e) {
      set({ isLoading: false, error: e.message });
    }
  },

  loginAsResident: async (roomNumber, name) => {
    set({ isLoading: true, error: null });
    try {
      await signInAsResident(roomNumber, name);
    } catch (e) {
      set({ isLoading: false, error: e.message });
    }
  },

  register: async (email, password, displayName, role) => {
    set({ isLoading: true, error: null });
    try {
      await registerStaff(email, password, displayName, role);
    } catch (e) {
      set({ isLoading: false, error: e.message });
    }
  },

  logout: async () => {
    const { isDemoMode } = get();

    if (isDemoMode) {
      sessionStorage.removeItem('crisisflow_demo');
      set({ user: null, profile: null, role: null, isDemoMode: false, isLoading: false });
      console.log('[AUTH] Demo mode deactivated');
      return;
    }

    set({ isLoading: true });
    try {
      await signOutUser();
      set({ user: null, profile: null, role: null, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e.message });
    }
  },

  clearError: () => set({ error: null }),

  // ── Derived ──────────────────────────────────────────────────────────────
  isAuthenticated: () => get().user !== null,
  isCommand:       () => get().role === UserRole.COMMAND,
  isStaff:         () => get().role === UserRole.STAFF,
  isResident:      () => get().role === UserRole.RESIDENT,
}));

export default useAuthStore;
