// ── Privacy & DLP Service ────────────────────────────────────────────────────
// Sanitizes personal identifiers from incident reports before they hit the
// command dashboard. Uses pattern matching for PII detection.
// In production, this would integrate with Google Cloud DLP API.

const PII_PATTERNS = [
  { type: 'email',        regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,          replacement: '[EMAIL REDACTED]' },
  { type: 'phone',        regex: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,  replacement: '[PHONE REDACTED]' },
  { type: 'ssn',          regex: /\d{3}-\d{2}-\d{4}/g,                                         replacement: '[SSN REDACTED]' },
  { type: 'credit_card',  regex: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,               replacement: '[CARD REDACTED]' },
  { type: 'passport',     regex: /\b[A-Z]\d{7,8}\b/g,                                          replacement: '[PASSPORT REDACTED]' },
  { type: 'room_guest',   regex: /(?:guest|mr\.?|mrs\.?|ms\.?)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/gi, replacement: '[GUEST NAME REDACTED]' },
  { type: 'aadhaar',      regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,                                 replacement: '[ID REDACTED]' },
];

/**
 * Sanitize text by removing PII patterns.
 * @param {string} text - Raw text to sanitize
 * @returns {{ sanitized: string, redactions: Array<{type: string, count: number}> }}
 */
export function sanitizeText(text) {
  if (!text) return { sanitized: '', redactions: [] };

  let sanitized = text;
  const redactions = [];

  for (const pattern of PII_PATTERNS) {
    const matches = sanitized.match(pattern.regex);
    if (matches && matches.length > 0) {
      redactions.push({ type: pattern.type, count: matches.length });
      sanitized = sanitized.replace(pattern.regex, pattern.replacement);
    }
  }

  if (redactions.length > 0) {
    console.log('[DLP] Redacted PII:', redactions);
  }

  return { sanitized, redactions };
}

/**
 * Sanitize an incident object before it hits the dashboard.
 */
export function sanitizeIncident(incident) {
  if (!incident) return incident;

  const descResult = sanitizeText(incident.description);
  const locResult  = sanitizeText(incident.location);

  return {
    ...incident,
    description: descResult.sanitized,
    location: locResult.sanitized,
    _piiRedacted: true,
    _redactions: [...descResult.redactions, ...locResult.redactions],
  };
}

/**
 * Strip EXIF metadata from image base64 to prevent location leakage.
 * In production, this would use a canvas re-encoding approach.
 */
export function stripImageMetadata(base64Image) {
  // Re-encode through canvas to strip EXIF
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      // Re-export strips all EXIF metadata
      const cleanBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      resolve(cleanBase64);
    };
    img.onerror = () => resolve(base64Image); // Fallback to original
    img.src = `data:image/jpeg;base64,${base64Image}`;
  });
}
