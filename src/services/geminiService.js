import { GoogleGenerativeAI } from '@google/generative-ai';

// The hardcoded key was revoked by Google for being leaked.
// Please create a .env file with VITE_GEMINI_API_KEY=your_new_key
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyAACsG4EqWHHRpBccfKA7PKIo8JQI7g-Jw';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ── analyzeIncident — port of GeminiService.analyzeIncident ─────────────────
export async function analyzeIncident(transcript, imageBase64 = null) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are the Aegis Crisis Orchestrator. Analyze the following emergency transcript and accompanying scene image (if provided).
Extract incident details in JSON format.

Transcript: "${transcript}"

Required JSON fields:
- hazard: (fire, medical, security, leak, or other)
- severity: (integer 1-10)
- location: (string)
- description: (short summary of what's happening based on BOTH audio and image)
- skills_needed: (list of strings, e.g., ["CPR", "Fire Fighting", "Hazmat"])

CRITICAL RULE: If the visual image indicates a DIFFERENT or ADDITIONAL hazard (e.g., transcript says "medical" but image shows a "fire"), you MUST update the hazard field and description to reflect the true visual reality.

Return ONLY the JSON object.`;

  console.log('[GEMINI] Analyzing scene...');
  const parts = [{ text: prompt }];

  if (imageBase64) {
    console.log('[GEMINI] Attaching image payload...');
    parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
  }

  const result = await model.generateContent(parts);
  const raw = result.response.text();
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  console.log('[GEMINI] Response received:', cleaned);
  return JSON.parse(cleaned);
}

// ── getSopSteps — port of SopService.getSopSteps ────────────────────────────
export async function getSopSteps(hazardType, location) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are the Safety Officer for a 5-star luxury hotel. A crisis has just been reported.
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
    model: 'gemini-2.5-flash',
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
  const parts = [
    { text: prompt },
    { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } } // Use generic jpeg, Gemini handles it
  ];

  try {
    const result = await model.generateContent(parts);
    const raw = result.response.text();
    console.log('[GEMINI] Blueprint JSON:', raw);
    return JSON.parse(raw);
  } catch (e) {
    console.error('[GEMINI] Error analyzing blueprint:', e);
    throw e;
  }
}
