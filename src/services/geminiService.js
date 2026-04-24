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
