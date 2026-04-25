import { create } from 'zustand';
import { createIncident } from '../models/incident';
import { analyzeIncident, getSopSteps } from '../services/geminiService';
import { sanitizeText } from '../services/dlpService';
import {
  mergeOrCreateIncident, saveIncidentToHistory, findNearestResponder,
  confirmDispatch as fbConfirmDispatch, resolveLiveIncident,
  seedStaffIfEmpty, streamLiveIncidents, streamZones, saveZonesToFirebase,
  updateIncident, streamEvacuationStatus, triggerEvacuation
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

  // Global Evacuation
  isEvacuationActive: false,
  unsubscribeEvacuation: null,
  setEvacuationActive: async (isActive) => {
    await triggerEvacuation(isActive);
  },

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
    await seedStaffIfEmpty();
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
    const unsubscribeEvac = streamEvacuationStatus((isActive) => {
      set({ isEvacuationActive: isActive });
    });
    set({ 
      unsubscribeLiveIncidents: unsubscribeLive, 
      unsubscribeZones: unsubscribeZ,
      unsubscribeEvacuation: unsubscribeEvac 
    });
  },

  cleanup: () => {
    const { unsubscribeLiveIncidents, unsubscribeZones, unsubscribeEvacuation } = get();
    if (unsubscribeLiveIncidents) unsubscribeLiveIncidents();
    if (unsubscribeZones) unsubscribeZones();
    if (unsubscribeEvacuation) unsubscribeEvacuation();
  },

  // ── processIncidentData — ROBUST pipeline with Gemini fallback ───────────
  processIncidentData: async (transcript, imageBase64 = null) => {
    set({ isProcessing: true, processingError: null, sopSteps: [] });
    try {
      // 0. DLP sanitization — strip PII before analysis
      const { sanitized: cleanTranscript } = sanitizeText(transcript);

      let result = null;
      let aiWorked = false;

      // 1. Try Gemini multi-modal analysis — with fallback
      try {
        result = await analyzeIncident(cleanTranscript, imageBase64);
        aiWorked = true;
        console.log('[STORE] Gemini analysis succeeded:', result);
      } catch (aiError) {
        console.warn('[STORE] Gemini analysis failed, using local fallback:', aiError.message);
        // Fallback: parse the transcript locally
        result = localFallbackAnalysis(cleanTranscript);
      }

      const { sanitized: cleanDesc } = sanitizeText(result.description ?? cleanTranscript);
      const location = result.location ?? 'Unknown Location';
      const incidentFloor = extractFloor(location);
      const skills = result.skills_needed ?? [];

      // 2. Build incoming incident
      const incoming = createIncident({
        type: result.hazard ?? 'other',
        severity: result.severity ?? 5,
        location,
        description: cleanDesc,
        requiredSkills: skills,
        evidenceLogs: [cleanTranscript],
      });

      // 3. Cluster: merge or create — ALWAYS writes to RTDB
      const finalIncident = await mergeOrCreateIncident(incoming);
      console.log('[STORE] Incident saved to RTDB:', finalIncident.id);

      // 4. Save to Firestore history
      // 4. Save to Firestore history
      try {
        await saveIncidentToHistory(finalIncident);
      } catch (histErr) {
        console.warn('[STORE] History save failed (non-critical):', histErr.message);
      }

      // 5. Dispatch engine
      try {
        const { zones } = get();
        const dispatchStr = await findNearestResponder(skills, incidentFloor, location, zones);
        if (dispatchStr) {
          set({ dispatchResult: dispatchStr, dispatchIncidentId: finalIncident.id });
          // PERSIST to DB
          await updateIncident(finalIncident.id, { dispatchSuggestion: dispatchStr });
        }
      } catch (dispErr) {
        console.warn('[STORE] Auto-dispatch failed (non-critical):', dispErr.message);
      }

      // 6. SOP RAG (only if AI worked)
      if (aiWorked) {
        try {
          const sopSteps = await getSopSteps(finalIncident.type, location);
          set({ sopSteps, isProcessing: false });
          // PERSIST to DB
          await updateIncident(finalIncident.id, { sops: sopSteps });
        } catch (sopErr) {
          console.warn('[STORE] SOP fetch failed:', sopErr.message);
          set({ isProcessing: false });
        }
      } else {
        set({ isProcessing: false });
      }

    } catch (e) {
      console.error('[STORE] processIncidentData CRITICAL error:', e);
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

// ── Local Fallback Analysis (when Gemini is unavailable) ─────────────────────
function localFallbackAnalysis(transcript) {
  const lower = transcript.toLowerCase();

  // Detect hazard type from keywords
  let hazard = 'other';
  let severity = 4;
  const skills = [];

  if (lower.includes('fire') || lower.includes('smoke') || lower.includes('burn')) {
    hazard = 'fire'; severity = 8; skills.push('Fire Fighting', 'Emergency Evacuation');
  } else if (lower.includes('medical') || lower.includes('heart') || lower.includes('bleed') || lower.includes('unconscious') || lower.includes('injury')) {
    hazard = 'medical'; severity = 7; skills.push('CPR', 'First Aid', 'Medical Emergency');
  } else if (lower.includes('security') || lower.includes('threat') || lower.includes('intruder') || lower.includes('weapon')) {
    hazard = 'security'; severity = 7; skills.push('Security', 'Emergency Evacuation');
  } else if (lower.includes('gas') || lower.includes('chemical') || lower.includes('smell')) {
    hazard = 'chemical'; severity = 7; skills.push('Hazmat', 'Gas Safety');
  } else if (lower.includes('flood') || lower.includes('water')) {
    hazard = 'leak'; severity = 5; skills.push('Plumbing', 'Leak Control');
  } else if (lower.includes('plumb') || lower.includes('leak') || lower.includes('tap') || lower.includes('pipe')) {
    hazard = 'leak'; severity = 3; skills.push('Plumbing', 'Leak Control');
  } else if (lower.includes('electric') || lower.includes('power') || lower.includes('outage') || lower.includes('spark')) {
    hazard = 'other'; severity = 4; skills.push('Electrician', 'Electrical Safety');
  } else if (lower.includes('clean') || lower.includes('housekeep') || lower.includes('room service')) {
    hazard = 'other'; severity = 2; skills.push('Room Cleaning', 'Housekeeping');
  } else if (lower.includes('ac') || lower.includes('heating') || lower.includes('hvac') || lower.includes('cold') || lower.includes('hot')) {
    hazard = 'other'; severity = 2; skills.push('HVAC', 'Maintenance');
  } else if (lower.includes('structural') || lower.includes('crack') || lower.includes('collapse')) {
    hazard = 'structural'; severity = 8; skills.push('Structural Engineering', 'Emergency Evacuation');
  }

  // Extract location from transcript
  let location = 'Unknown Location';
  const roomMatch = lower.match(/room\s*(\d+)/);
  const floorMatch = lower.match(/floor\s*(\d+)/);
  if (roomMatch && floorMatch) {
    location = `Room ${roomMatch[1]}, Floor ${floorMatch[1]}`;
  } else if (roomMatch) {
    const roomNum = parseInt(roomMatch[1], 10);
    const fl = Math.floor(roomNum / 100) || 1;
    location = `Room ${roomMatch[1]}, Floor ${fl}`;
  } else if (floorMatch) {
    location = `Floor ${floorMatch[1]}`;
  }

  return {
    hazard,
    severity,
    location,
    description: transcript,
    skills_needed: skills,
    impacted_zones: [],
    verified_status: 'local_fallback',
    confidence_score: 0.5,
    estimated_affected_people: 1,
    recommended_evacuation_zones: [],
  };
}

export default useIncidentStore;
