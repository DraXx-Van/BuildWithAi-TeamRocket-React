// ── Crisis State Model ───────────────────────────────────────────────────────
// The output of the Gemini "State Manager" — a unified view of the crisis.
// This is what all three surfaces (Command, Staff, Room) consume.

export const CrisisSeverity = {
  NONE:       'NONE',
  MONITORING: 'MONITORING',
  ACTIVE:     'ACTIVE',
  CRITICAL:   'CRITICAL',
  CATASTROPHIC: 'CATASTROPHIC',
};

export const VerifiedStatus = {
  UNVERIFIED:     'unverified',
  AI_VERIFIED:    'ai_verified',
  HUMAN_VERIFIED: 'human_verified',
};

// ── Create a CrisisState object ──────────────────────────────────────────────
export function createCrisisState({
  overallSeverity,
  dangerZones,
  safeEvacuationRoutes,
  unaccountedResidents,
  resourceGaps,
  activeIncidentCount,
  timestamp,
} = {}) {
  return {
    overallSeverity:       overallSeverity ?? CrisisSeverity.NONE,
    dangerZones:           dangerZones ?? [],           // [{zoneId, level, reason, incidentIds}]
    safeEvacuationRoutes:  safeEvacuationRoutes ?? [],  // [{from, to, path[], estimatedTime}]
    unaccountedResidents:  unaccountedResidents ?? 0,
    resourceGaps:          resourceGaps ?? [],           // ["Need 2 fire marshals on Floor 3"]
    activeIncidentCount:   activeIncidentCount ?? 0,
    timestamp:             timestamp ?? new Date().toISOString(),
  };
}

// ── Compute crisis severity from active incidents ────────────────────────────
export function computeOverallSeverity(incidents) {
  if (!incidents || incidents.length === 0) return CrisisSeverity.NONE;

  const maxSeverity = Math.max(...incidents.map(i => i.severity));
  const activeCount = incidents.filter(i => i.status === 'active').length;

  if (maxSeverity >= 9 || activeCount >= 5) return CrisisSeverity.CATASTROPHIC;
  if (maxSeverity >= 7 || activeCount >= 3) return CrisisSeverity.CRITICAL;
  if (maxSeverity >= 4 || activeCount >= 1) return CrisisSeverity.ACTIVE;
  if (incidents.length > 0) return CrisisSeverity.MONITORING;
  return CrisisSeverity.NONE;
}

// ── Severity color mapping ───────────────────────────────────────────────────
export const SEVERITY_COLORS = {
  NONE:         '#10b981',   // emerald
  MONITORING:   '#3b82f6',   // blue
  ACTIVE:       '#f59e0b',   // amber
  CRITICAL:     '#ef4444',   // red
  CATASTROPHIC: '#dc2626',   // deep red
};

// ── Derive danger zones from incidents + building zones ──────────────────────
export function deriveDangerZones(incidents, zones) {
  const dangerMap = new Map();

  for (const incident of incidents) {
    if (incident.status === 'resolved') continue;

    // Match incident location to zones
    const matchedZones = zones.filter(zone => {
      const locLower = incident.location.toLowerCase();
      const zoneLower = zone.name.toLowerCase();
      const zoneIdLower = zone.id.replace(/_/g, ' ').toLowerCase();
      return locLower.includes(zoneLower) ||
             zoneLower.includes(locLower) ||
             locLower.includes(zoneIdLower);
    });

    // Also use impactedZones from Gemini analysis if available
    const aiZones = incident.impactedZones ?? [];

    const affectedZoneIds = [
      ...matchedZones.map(z => z.id),
      ...aiZones,
    ];

    for (const zoneId of affectedZoneIds) {
      const existing = dangerMap.get(zoneId);
      const level = incident.severity >= 8 ? 'critical' :
                    incident.severity >= 5 ? 'danger' : 'caution';

      if (!existing || severityRank(level) > severityRank(existing.level)) {
        dangerMap.set(zoneId, {
          zoneId,
          level,
          reason: `${incident.type}: ${incident.description.slice(0, 60)}`,
          incidentIds: [...(existing?.incidentIds ?? []), incident.id],
        });
      }
    }
  }

  return Array.from(dangerMap.values());
}

function severityRank(level) {
  return { safe: 0, caution: 1, danger: 2, critical: 3 }[level] ?? 0;
}
