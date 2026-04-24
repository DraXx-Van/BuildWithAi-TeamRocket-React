import { v4 as uuidv4 } from 'uuid';

// ── Incident status & type enums ────────────────────────────────────────────
export const IncidentStatus = { active: 'active', dispatched: 'dispatched', resolved: 'resolved', cancelled: 'cancelled' };
export const IncidentType   = { fire: 'fire', medical: 'medical', security: 'security', leak: 'leak', other: 'other' };

// ── Create a new Incident object (mirrors Dart class constructor) ───────────
export function createIncident({
  id, type, severity, location, description,
  status = 'active', timestamp, requiredSkills = [],
  sopUrl, imageUrl, metaData, assignedTo, dispatchedAt,
  evidenceLogs = [], signalCount = 1,
} = {}) {
  return {
    id:            id ?? uuidv4(),
    type:          type ?? 'other',
    severity:      severity ?? 5,
    location:      location ?? 'Unknown',
    description:   description ?? '',
    status,
    timestamp:     timestamp ?? new Date().toISOString(),
    requiredSkills,
    sopUrl:        sopUrl ?? null,
    imageUrl:      imageUrl ?? null,
    metaData:      metaData ?? null,
    assignedTo:    assignedTo ?? null,
    dispatchedAt:  dispatchedAt ?? null,
    evidenceLogs,
    signalCount,
  };
}

// ── fromJson (mirrors Incident.fromJson) ────────────────────────────────────
export function incidentFromJson(json) {
  return createIncident({
    id:            json.id,
    type:          json.type ?? 'other',
    severity:      json.severity ?? 5,
    location:      json.location ?? 'Unknown',
    description:   json.description ?? '',
    status:        json.status ?? 'active',
    timestamp:     json.timestamp ?? new Date().toISOString(),
    requiredSkills: json.requiredSkills ?? [],
    sopUrl:        json.sopUrl ?? null,
    imageUrl:      json.imageUrl ?? null,
    metaData:      json.metaData ?? null,
    assignedTo:    json.assignedTo ?? null,
    dispatchedAt:  json.dispatchedAt ?? null,
    evidenceLogs:  json.evidenceLogs ?? [],
    signalCount:   json.signalCount ?? 1,
  });
}

// ── copyWith (mirrors Incident.copyWith) ────────────────────────────────────
export function incidentCopyWith(incident, updates) {
  return { ...incident, ...updates };
}

// ── Time helpers (mirrors Dart getters) ─────────────────────────────────────
export function formattedTime(isoString) {
  const d = new Date(isoString);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

export function elapsedLabel(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function fullTimestamp(isoString) {
  return `${formattedTime(isoString)}  (${elapsedLabel(isoString)})`;
}

// ── Severity color helper ────────────────────────────────────────────────────
export function severityColor(severity) {
  if (severity >= 8) return '#ef4444';
  if (severity >= 5) return '#f59e0b';
  return '#8b5cf6';
}
