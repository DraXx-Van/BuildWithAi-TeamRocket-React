import { create } from 'zustand';
import { createIncident } from '../models/incident';
import { analyzeIncident, getSopSteps } from '../services/geminiService';
import {
  mergeOrCreateIncident, saveIncidentToHistory, findNearestResponder,
  confirmDispatch as fbConfirmDispatch, resolveLiveIncident,
  seedStaffIfEmpty, streamLiveIncidents,
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

  // Live incidents stream
  liveIncidents: [],
  incidentsLoading: true,
  incidentsError: null,
  unsubscribeLiveIncidents: null,

  // Individual incident processing state
  isProcessing: false,
  processingError: null,

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
    set({ selectedIncidentId: id, sopSteps: [], dispatchResult: null });
  },

  // Master-detail focused incident on Incidents tab
  focusedIncidentId: null,
  setFocusedIncidentId: (id) => set({ focusedIncidentId: id }),

  // ── Initialize: seed staff + start live stream ───────────────────────────
  init: async () => {
    await seedStaffIfEmpty();
    const unsubscribe = streamLiveIncidents((incidents) => {
      set({ liveIncidents: incidents, incidentsLoading: false });
    });
    set({ unsubscribeLiveIncidents: unsubscribe });
  },

  cleanup: () => {
    const { unsubscribeLiveIncidents } = get();
    if (unsubscribeLiveIncidents) unsubscribeLiveIncidents();
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
      const dispatchStr = await findNearestResponder(skills, incidentFloor);
      if (dispatchStr) {
        set({ dispatchResult: dispatchStr, dispatchIncidentId: finalIncident.id });
      }

      // 6. SOP RAG
      const sopSteps = await getSopSteps(finalIncident.type, location);
      set({ sopSteps, isProcessing: false });

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

      const dispatchStr = await findNearestResponder(mock.requiredSkills, 4);
      if (dispatchStr) {
        set({ dispatchResult: dispatchStr, dispatchIncidentId: finalIncident.id });
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
