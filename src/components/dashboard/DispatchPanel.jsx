import { useState, useEffect } from 'react';
import { findRankedCandidates, assignStaffToIncident } from '../../services/firebaseService';

/**
 * DispatchPanel — Manager sees ranked staff candidates and manually assigns one.
 * Implements the NON-SACRIFICE DIRECTIVE: staff in danger zones are filtered out.
 */
export default function DispatchPanel({ incident, onClose }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [assigned, setAssigned] = useState(false);

  useEffect(() => {
    if (!incident) return;

    const floor = extractFloor(incident.location || '');
    const dangerFloors = incident.severity >= 8 ? [floor] : [];

    findRankedCandidates(incident.requiredSkills || [], floor, dangerFloors)
      .then(results => {
        setCandidates(results);
        setLoading(false);
      });
  }, [incident]);

  const handleAssign = async (staff) => {
    setAssigning(staff.id);
    await assignStaffToIncident(
      incident.id,
      staff,
      incident.location,
      incident.description,
    );
    setAssigned(true);
    setTimeout(() => onClose?.(), 2000);
  };

  if (!incident) return null;

  if (assigned) {
    return (
      <div className="dispatch-panel">
        <div className="dispatch-assigned">
          <div className="dispatch-assigned-icon">✅</div>
          <div className="dispatch-assigned-title">Staff Assigned</div>
          <div className="dispatch-assigned-sub">Tactical alert sent to their device.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dispatch-panel">
      <div className="dispatch-panel-header">
        <div>
          <h3 className="dispatch-panel-title">Assign Responder</h3>
          <p className="dispatch-panel-sub">
            {incident.type?.toUpperCase()} — {incident.location}
          </p>
        </div>
        <button className="dispatch-panel-close" onClick={onClose}>✕</button>
      </div>

      {/* Safety Warning for crisis */}
      {incident.severity >= 8 && (
        <div className="dispatch-safety-warning">
          <span className="dispatch-safety-icon">🛡️</span>
          <span>NON-SACRIFICE MODE: Staff in danger zones have been excluded</span>
        </div>
      )}

      {/* Required Skills */}
      {incident.requiredSkills?.length > 0 && (
        <div className="dispatch-skills-needed">
          <span className="dispatch-skills-label">Skills needed:</span>
          {incident.requiredSkills.map(s => (
            <span key={s} className="dispatch-skill-tag">{s}</span>
          ))}
        </div>
      )}

      {/* Candidate List */}
      <div className="dispatch-candidates">
        {loading ? (
          <div className="dispatch-loading">Ranking candidates...</div>
        ) : candidates.length === 0 ? (
          <div className="dispatch-no-match">
            <span>No available staff matching required skills.</span>
          </div>
        ) : (
          candidates.map((staff, idx) => (
            <div key={staff.id} className={`dispatch-candidate ${idx === 0 ? 'top-pick' : ''}`}>
              <div className="dispatch-candidate-rank">#{idx + 1}</div>
              <div className="dispatch-candidate-avatar">{staff.name.charAt(0)}</div>
              <div className="dispatch-candidate-info">
                <div className="dispatch-candidate-name">
                  {staff.name}
                  {idx === 0 && <span className="dispatch-best-match">BEST MATCH</span>}
                </div>
                <div className="dispatch-candidate-role">{staff.role}</div>
                <div className="dispatch-candidate-meta">
                  <span>📍 Floor {staff.floor}</span>
                  <span>⏱ {staff.eta}</span>
                  <span>🎯 {staff.matchScore}% match</span>
                </div>
                <div className="dispatch-candidate-skills">
                  {staff.skills.slice(0, 3).map(s => (
                    <span key={s} className="dispatch-cand-skill">{s}</span>
                  ))}
                </div>
              </div>
              <button
                className="dispatch-assign-btn"
                onClick={() => handleAssign(staff)}
                disabled={assigning === staff.id}
              >
                {assigning === staff.id ? '...' : 'ASSIGN'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function extractFloor(location) {
  const lower = (location || '').toLowerCase();
  const match = lower.match(/floor\s*(\d+)/);
  if (match) return parseInt(match[1], 10);
  if (lower.includes('4th')) return 4;
  if (lower.includes('3rd')) return 3;
  if (lower.includes('2nd')) return 2;
  if (lower.includes('1st')) return 1;
  if (lower.includes('basement')) return 0;
  if (lower.includes('ground') || lower.includes('lobby')) return 1;
  return 1;
}
