import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Gemini AI configuration from environment ─────────────────────────────────
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ═══════════════════════════════════════════════════════════════════════════════
// 1. MULTIMODAL TRIAGE — Analyze incident from transcript + image
// ═══════════════════════════════════════════════════════════════════════════════
export async function analyzeIncident(transcript, imageBase64 = null) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are CrisisFlow, an AI-powered crisis orchestrator for hospitality emergency response.
Analyze the following emergency report and accompanying scene image (if provided).
Extract incident details as a structured JSON object.

Emergency Report: "${transcript}"

Required JSON fields:
- hazard: (fire | medical | security | leak | structural | chemical | other)
- severity: (integer 1-10, where 10 = catastrophic)
- location: (string — be as specific as possible: floor, zone, room number)
- description: (concise summary of the situation based on ALL available evidence)
- skills_needed: (list of strings, e.g., ["CPR", "Fire Fighting", "Hazmat", "Structural Engineering"])
- impacted_zones: (list of affected building zones, e.g., ["kitchen", "corridor_1", "lobby"])
- verified_status: ("ai_verified" if confident, "unverified" if uncertain)
- confidence_score: (float 0.0 - 1.0 — your confidence in this analysis)
- estimated_affected_people: (integer — rough estimate of people in danger)
- recommended_evacuation_zones: (list of zones that should be evacuated)

CRITICAL RULES:
1. If the visual image indicates a DIFFERENT or ADDITIONAL hazard from the transcript, you MUST update the hazard field and description to reflect the true visual reality.
2. If severity >= 7, always recommend evacuation of adjacent zones.
3. Be aggressive with safety — overestimate severity rather than underestimate.

Return ONLY the JSON object. No markdown, no explanation.`;

  console.log('[GEMINI] Analyzing incident...');
  const parts = [{ text: prompt }];

  if (imageBase64) {
    console.log('[GEMINI] Attaching image payload...');
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
  }

  const result = await model.generateContent(parts);
  const raw = result.response.text();
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  console.log('[GEMINI] Analysis complete:', cleaned);
  return JSON.parse(cleaned);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SOP GENERATION — Context-aware Standard Operating Procedures
// ═══════════════════════════════════════════════════════════════════════════════
export async function getSopSteps(hazardType, location) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are the Safety Officer for a luxury hotel using the CrisisFlow system. A crisis has just been reported.
Hazard Type: ${hazardType}
Location: ${location}

Generate EXACTLY 3 to 5 concise, actionable Standard Operating Procedure (SOP) steps that hotel staff must execute RIGHT NOW. Each step must be specific, directive, and use imperative language.
Examples of good steps:
- "Activate the manual fire alarm pull station on Floor 3 North."
- "Cut the main gas line via the red emergency valve in Basement Utility Room B2."
- "Direct all guests to the North Parking evacuation point via Stairwell C."

Return ONLY a valid JSON array of strings. No markdown, no extra text.
Example: ["Step 1.", "Step 2.", "Step 3."]`;

  try {
    console.log(`[SOP] Fetching protocol for ${hazardType} at ${location}...`);
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const steps = JSON.parse(cleaned);
    console.log(`[SOP] Protocol received: ${steps.length} steps.`);
    return steps;
  } catch (e) {
    console.error('[SOP] Error fetching SOP:', e);
    return [
      'Immediately notify the Duty Manager and all floor supervisors.',
      'Initiate evacuation of the affected area using nearest stairwells.',
      'Call emergency services (Fire/Medical/Police as appropriate).',
    ];
  }
}

// ── analyzeBlueprint — AI Blueprint Scanner ───────────────────────────────
export async function analyzeBlueprint(imageBase64) {
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash', // Updated to latest stable or use 'gemini-1.5-pro'
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "Unique snake_case id" },
            label: { type: "STRING", description: "ALL CAPS name, e.g. 'MAIN LOBBY'" },
            subtitle: { type: "STRING", description: "Specific room details" },
            floor: { type: "STRING", description: "The floor ID (e.g. '1', '2', 'B1'). If multiple plans are in image, group them correctly." },
            type: { type: "STRING", enum: ["room", "path", "stair", "elevator", "exit", "entry"], description: "Architectural function" },
            left: { type: "INTEGER", description: "X coordinate (0-1000) relative to floor origin" },
            top: { type: "INTEGER", description: "Y coordinate (0-1000) relative to floor origin" },
            width: { type: "INTEGER", description: "Width (50-400)" },
            height: { type: "INTEGER", description: "Height (50-400)" }
          },
          required: ["id", "label", "floor", "type", "left", "top", "width", "height"]
        }
      }
    }
  });

  const prompt = `You are an AI Architectural Analyst for the Aegis Orchestrator. 
Scan this blueprint/floor plan image and extract all architectural zones.

CRITICAL INSTRUCTIONS:
1. MULTI-FLOOR DETECTION: If the image contains multiple floor plans, identify which zone belongs to which floor (e.g., '1', '2').
2. ARCHITECTURAL TYPING: Categorize every zone as one of: room, path, stair, elevator, exit, entry.
3. COORDINATES: Map each floor to its own relative 1000x1000 coordinate space. (0,0 is the top-left of the specific floor plan).
4. LABELS: Use concise, professional labels (e.g., 'STAIRWELL A', 'DATA CENTER').`;

  console.log('[GEMINI] Analyzing blueprint image...');
  try {
    const parts = [
      { text: prompt },
      { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
    ];
    const result = await model.generateContent(parts);
    const raw = result.response.text();
    console.log('[GEMINI] Blueprint JSON:', raw);
    return JSON.parse(raw);
  } catch (e) {
    console.error('[GEMINI] Error analyzing blueprint:', e);
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CRISIS STATE SYNTHESIS — Unified situational awareness
// ═══════════════════════════════════════════════════════════════════════════════
export async function synthesizeCrisisState(incidents, buildingModel, roomStatuses) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are CrisisFlow's Crisis State Manager. Synthesize all available intelligence into a unified crisis assessment.

ACTIVE INCIDENTS:
${JSON.stringify(incidents.map(i => ({
  id: i.id, type: i.type, severity: i.severity,
  location: i.location, status: i.status,
  description: i.description, signalCount: i.signalCount,
})), null, 2)}

BUILDING ZONES:
${JSON.stringify(buildingModel.map(z => ({
  id: z.id, name: z.name, floor: z.floorId, type: z.type, capacity: z.capacity,
})), null, 2)}

ROOM STATUSES:
${JSON.stringify(roomStatuses, null, 2)}

Generate a unified crisis assessment as JSON:
{
  "overall_severity": "NONE | MONITORING | ACTIVE | CRITICAL | CATASTROPHIC",
  "danger_zones": [{"zone_id": "...", "level": "safe|caution|danger|critical", "reason": "..."}],
  "safe_routes": [{"from": "zone_id", "to": "exit_zone_id", "avoid": ["danger_zone_id"]}],
  "unaccounted_residents": <integer>,
  "resource_gaps": ["descriptive string of what's needed"],
  "priority_actions": ["immediate action needed"],
  "estimated_resolution_time": "<string like '15-30 minutes'>"
}

Return ONLY the JSON object.`;

  try {
    console.log('[CRISIS STATE] Synthesizing unified assessment...');
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const state = JSON.parse(cleaned);
    console.log('[CRISIS STATE] Assessment complete:', state.overall_severity);
    return state;
  } catch (e) {
    console.error('[CRISIS STATE] Synthesis error:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. IMAGE TRIAGE — Analyze staff-uploaded photos for tactical awareness
// ═══════════════════════════════════════════════════════════════════════════════
export async function analyzeTriageImage(imageBase64, roomContext = 'Unknown Location') {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are CrisisFlow's Tactical Image Analyzer. A first responder or staff member has uploaded an image from ${roomContext}.
Analyze the image and assess the situational safety and passability of the area.

Required JSON fields:
- hazard_detected: (boolean)
- hazard_type: (string or null — e.g., "Fire", "Smoke", "Debris", "Medical", "Clear")
- confidence_score: (float 0.0 - 1.0 — your confidence in this analysis)
- is_passable: (boolean — can people safely evacuate through this area?)
- description: (short, concise tactical description for the command center)

Return ONLY the JSON object. No markdown, no explanation.`;

  console.log('[GEMINI] Analyzing triage image...');
  const parts = [
    { text: prompt },
    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
  ];

  try {
    const result = await model.generateContent(parts);
    const raw = result.response.text();
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(cleaned);
    console.log('[GEMINI] Triage complete:', analysis);
    return analysis;
  } catch (e) {
    console.error('[GEMINI] Image triage error:', e);
    throw new Error('AI analysis failed. Please try again.');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. FLOOR PLAN AUTO-DETECT — Analyze uploaded floor plan to extract rooms
// ═══════════════════════════════════════════════════════════════════════════════
export async function autoDetectFloorPlanRooms(imageBase64) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are CrisisFlow's AI Floor Plan Architect. A user has uploaded a floor plan image (e.g., lobby, floor 1).
Analyze the image and detect all distinct rooms, zones, corridors, stairs, and spaces.

Required JSON format:
An array of objects, where each object represents a detected room/space with the following fields:
- name: (string — e.g., "Reception", "Admin Office", "Kitchen", "Restaurant", "Lounge", "Art Gallery", "Stairs", "Corridor")
- type: (string — one of "room", "corridor", "stairs", "exit")
- points: (array of {xPercent, yPercent} — roughly outlining the boundary of the space. xPercent and yPercent should be float values between 0.0 and 1.0 representing the X and Y coordinates on the image where 0,0 is top-left. Provide 4 or more points to outline the shape. For curved walls, provide multiple points to approximate the curve.)

Return ONLY the JSON array. No markdown, no explanation.`;

  console.log('[GEMINI] Analyzing floor plan...');
  const parts = [
    { text: prompt },
    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
  ];

  try {
    const result = await model.generateContent(parts);
    const raw = result.response.text();
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const analysis = JSON.parse(cleaned);
    console.log('[GEMINI] Floor plan detection complete:', analysis);
    return analysis;
  } catch (e) {
    console.error('[GEMINI] Floor plan detection error:', e);
    throw new Error('AI analysis failed. Please try again.');
  }
}
