import { create } from 'zustand';
import { createIncident } from '../models/incident';
import { analyzeIncident, getSopSteps } from '../services/geminiService';
import {
  mergeOrCreateIncident, saveIncidentToHistory, findNearestResponder,
  confirmDispatch as fbConfirmDispatch, resolveLiveIncident,
  seedStaffIfEmpty, streamLiveIncidents, streamZones, saveZonesToFirebase,
  updateIncident
} from '../services/firebaseService';

// ── Zustand store — replaces all Riverpod providers ──────────────────────────
const useIncidentStore = create((set, get) => ({
  // Nav state (replaces navPageProvider)
  currentPage: 'dashboard', // 'dashboard' | 'incidents' | 'resources'
  setCurrentPage: (page) => {
    set({ currentPage: page });
    // Reset focused incident when returning to incidents list
    if (page === 'incidents') set({ focusedIncidentId: null });
  },

  // Floor navigation
  currentFloor: '1', 
  floors: ['1'], // List of available floors
  setCurrentFloor: (floor) => set({ currentFloor: floor }),
  addFloor: (f) => set(s => {
    if (s.floors.includes(f)) return { currentFloor: f };
    return { floors: [...s.floors, f], currentFloor: f };
  }),
  removeFloor: (f) => set(s => ({ floors: s.floors.filter(x => x !== f), currentFloor: s.floors[0] })),

  // Live incidents stream
  liveIncidents: [],
  incidentsLoading: true,
  incidentsError: null,
  unsubscribeLiveIncidents: null,

  // Individual incident processing state
  isProcessing: false,
  isScanning: false, // Added for Blueprint Scanner tracking
  processingError: null,
  setScanning: (val) => set({ isScanning: val }),

  // SOP steps (replaces sopStepsProvider)
  sopSteps: [],
  setSopSteps: (steps) => set({ sopSteps: steps }),

  // Dispatch result (replaces dispatchResultProvider)
  dispatchResult: null,
  dispatchIncidentId: null,
  setDispatchResult: (result, incidentId) => set({ dispatchResult: result, dispatchIncidentId: incidentId }),
  clearDispatch: () => set({ dispatchResult: null, dispatchIncidentId: null }),

  // Selected incident on dashboard feed
  selectedIncidentId: null,
  setSelectedIncidentId: (id) => {
    const { liveIncidents } = get();
    const inc = liveIncidents.find(i => i.id === id);
    set({ 
      selectedIncidentId: id, 
      sopSteps: inc?.sops || [], 
      dispatchResult: inc?.dispatchSuggestion || null,
      dispatchIncidentId: inc?.dispatchSuggestion ? id : null
    });
  },

  // Master-detail focused incident on Incidents tab
  focusedIncidentId: null,
  setFocusedIncidentId: (id) => {
    const { liveIncidents } = get();
    const inc = liveIncidents.find(i => i.id === id);
    set({ 
      focusedIncidentId: id,
      sopSteps: inc?.sops || [], 
      dispatchResult: inc?.dispatchSuggestion || null,
      dispatchIncidentId: inc?.dispatchSuggestion ? id : null
    });
  },

  // Floor Plan Zones
  zones: [],
  unsubscribeZones: null,
  saveZones: async (newZones) => {
    set({ zones: newZones });
    await saveZonesToFirebase(newZones);
  },

  // ── Initialize: seed staff + start live streams ───────────────────────────
  init: async () => {
    // await seedStaffIfEmpty(); // Disable auto-seeding for clean state
    const unsubscribeLive = streamLiveIncidents((incidents) => {
      const { selectedIncidentId, focusedIncidentId } = get();
      const currentId = selectedIncidentId || focusedIncidentId;
      
      // If we have a focused incident, update its SOPs/Dispatch from the new data
      if (currentId) {
        const active = incidents.find(i => i.id === currentId);
        if (active) {
          set({ 
            sopSteps: active.sops || [], 
            dispatchResult: active.dispatchSuggestion || null,
            dispatchIncidentId: active.dispatchSuggestion ? active.id : null
          });
        }
      }
      
      set({ liveIncidents: incidents, incidentsLoading: false });
    });
    const unsubscribeZ = streamZones((fetchedZones) => {
      const zones = fetchedZones || [];
      const discoveredFloors = [...new Set(zones.map(z => (z.floor || '1').toString().toLowerCase()))];
      const uniqueFloors = [...new Set(['1', ...discoveredFloors])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      set({ zones, floors: uniqueFloors });
    });
    set({ unsubscribeLiveIncidents: unsubscribeLive, unsubscribeZones: unsubscribeZ });
  },

  cleanup: () => {
    const { unsubscribeLiveIncidents, unsubscribeZones } = get();
    if (unsubscribeLiveIncidents) unsubscribeLiveIncidents();
    if (unsubscribeZones) unsubscribeZones();
  },

  // ── processIncidentData — port of IncidentNotifier.processIncidentData ───
  processIncidentData: async (transcript, imageBase64 = null) => {
    set({ isProcessing: true, processingError: null, sopSteps: [] });
    try {
      // 1. Gemini multi-modal analysis
      const result = await analyzeIncident(transcript, imageBase64);
      const location = result.location ?? 'Unknown Location';
      const incidentFloor = extractFloor(location);
      const skills = result.skills_needed ?? [];

      // 2. Build incoming incident
      const incoming = createIncident({
        type: result.hazard ?? 'other',
        severity: result.severity ?? 5,
        location,
        description: result.description ?? transcript,
        requiredSkills: skills,
        evidenceLogs: [transcript],
      });

      // 3. Cluster: merge or create
      const finalIncident = await mergeOrCreateIncident(incoming);

      // 4. Save to Firestore history
      await saveIncidentToHistory(finalIncident);

      // 5. Dispatch engine
      const { zones } = get();
      const dispatchStr = await findNearestResponder(skills, incidentFloor, location, zones);
      if (dispatchStr) {
        set({ dispatchResult: dispatchStr, dispatchIncidentId: finalIncident.id });
        // PERSIST to DB
        await updateIncident(finalIncident.id, { dispatchSuggestion: dispatchStr });
      }

      // 6. SOP RAG
      const sopSteps = await getSopSteps(finalIncident.type, location);
      set({ sopSteps, isProcessing: false });
      // PERSIST to DB
      await updateIncident(finalIncident.id, { sops: sopSteps });

    } catch (e) {
      console.error('[STORE] processIncidentData error:', e);
      set({ isProcessing: false, processingError: e.message });
    }
  },

  // ── triggerTestIncident — port of IncidentNotifier.triggerTestIncident ───
  triggerTestIncident: async () => {
    set({ isProcessing: true, processingError: null });
    try {
      const mock = createIncident({
        type: 'fire',
        severity: 9,
        location: 'Sarvarish 1, 4th floor',
        description: 'MOCK ALERT: Detected heavy smoke and fire in Server Room B on the 4th floor.',
        requiredSkills: ['Fire Fighting', 'Electrical Safety', 'Rescue'],
        evidenceLogs: ['Initial smoke detector alarm triggered at 00:05'],
      });

      console.log('[TEST] Triggering mock incident at', mock.location);
      const finalIncident = await mergeOrCreateIncident(mock);
      await saveIncidentToHistory(finalIncident);

      const { zones } = get();
      const dispatchStr = await findNearestResponder(mock.requiredSkills, 4, mock.location, zones);
      if (dispatchStr) {
        set({ dispatchResult: dispatchStr, dispatchIncidentId: finalIncident.id });
        // PERSIST to DB for consistency
        await updateIncident(finalIncident.id, { dispatchSuggestion: dispatchStr });
      }

      set({ isProcessing: false });
    } catch (e) {
      console.error('[TEST] Error triggering mock:', e);
      set({ isProcessing: false, processingError: e.message });
    }
  },

  // ── confirmDispatch ──────────────────────────────────────────────────────
  confirmDispatch: async () => {
    const { dispatchIncidentId, dispatchResult } = get();
    if (!dispatchIncidentId || !dispatchResult) return;
    const name = dispatchResult.split(' (')[0];
    await fbConfirmDispatch(dispatchIncidentId, name);
    console.log('[STORE] Dispatch confirmed:', name, 'for', dispatchIncidentId);
  },

  // ── regenerateIntelligence ───────────────────────────────────────────────
  regenerateIntelligence: async (incident) => {
    if (!incident || get().isProcessing) return;
    set({ isProcessing: true, processingError: null });
    try {
      const { description, type, location, requiredSkills } = incident;
      const skills = requiredSkills ?? [];
      const floor = extractFloor(location);

      // 1. Dispatch engine
      const { zones } = get();
      const dispatchStr = await findNearestResponder(skills, floor, location, zones);
      
      // 2. SOP RAG
      const sopSteps = await getSopSteps(type, location);

      // 3. PERSIST to DB
      const updates = { sops: sopSteps };
      if (dispatchStr) updates.dispatchSuggestion = dispatchStr;
      
      await updateIncident(incident.id, updates);
      
      set({ 
        sopSteps, 
        dispatchResult: dispatchStr, 
        dispatchIncidentId: dispatchStr ? incident.id : null,
        isProcessing: false 
      });

    } catch (e) {
      console.error('[STORE] regenerateIntelligence error:', e);
      set({ isProcessing: false, processingError: e.message });
    }
  },

  // ── resolveIncident ──────────────────────────────────────────────────────
  resolveIncident: async (id) => {
    await resolveLiveIncident(id);
    set({ dispatchResult: null, dispatchIncidentId: null, sopSteps: [] });
  },
}));

// ── Floor extraction helper ──────────────────────────────────────────────────
function extractFloor(location) {
  const lower = location.toLowerCase();
  const match = lower.match(/floor\s*(\d+)/);
  if (match) return parseInt(match[1], 10);
  if (lower.includes('4th')) return 4;
  if (lower.includes('3rd')) return 3;
  if (lower.includes('2nd')) return 2;
  if (lower.includes('1st')) return 1;
  if (lower.includes('basement') || lower.includes('b1') || lower.includes('b2')) return 0;
  if (lower.includes('lobby') || lower.includes('ground') || lower.includes('kitchen')) return 1;
  return 1;
}

export default useIncidentStore;
