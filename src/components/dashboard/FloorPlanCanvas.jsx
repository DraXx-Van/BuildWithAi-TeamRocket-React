import { useState, useEffect } from 'react';
import useIncidentStore from '../../store/useIncidentStore';
import { severityColor } from '../../models/incident';

const ZONES = [
  { id: 'lobby',       label: 'MAIN LOBBY',   subtitle: 'Floor 1', top: 60, left: 60, width: 240, height: 160 },
  { id: 'front_desk',  label: 'FRONT DESK',   subtitle: 'Floor 1', top: 60, left: 340, width: 180, height: 160 },
  { id: 'kitchen',     label: 'KITCHEN',      subtitle: 'Basement',top: 270, left: 60, width: 200, height: 180 },
  { id: 'server_room', label: 'SERVER ROOM',  subtitle: 'B2',      top: 270, left: 300, width: 220, height: 180 },
  { id: 'pool',        label: 'POOL & SPA',   subtitle: 'Floor 2', top: 500, left: 60, width: 200, height: 180 },
  { id: 'corridor',    label: 'CORRIDOR A',   subtitle: 'Floors 1-4', top: 500, left: 300, width: 220, height: 180 }
];

export default function FloorPlanCanvas() {
  const { liveIncidents } = useIncidentStore();

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: 'var(--color-bg)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border)',
      overflow: 'hidden',
      backgroundImage: 'radial-gradient(rgba(161, 161, 170, 0.1) 1px, transparent 1px)',
      backgroundSize: '20px 20px',
    }}>
      {ZONES.map(zone => {
        // Find if any active incident matches this zone loosely by location
        const activeIncident = liveIncidents.find(i => 
          i.location.toLowerCase().includes(zone.label.toLowerCase()) || 
          i.location.toLowerCase().includes(zone.id.replace('_', ' ')) ||
          (zone.id === 'server_room' && i.location.toLowerCase().includes('server room'))
        );

        const isAlert = Boolean(activeIncident);
        const color = isAlert ? severityColor(activeIncident.severity) : 'var(--color-surface-3)';

        return (
          <div key={zone.id} style={{
            position: 'absolute',
            top: zone.top,
            left: zone.left,
            width: zone.width,
            height: zone.height,
            border: `2px solid ${isAlert ? color : 'rgba(161, 161, 170, 0.2)'}`,
            background: isAlert ? `${color}20` : 'rgba(39, 39, 42, 0.4)',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            animation: isAlert ? 'pulseAlert 2s infinite' : 'none',
          }}>
            {isAlert && (
              <div style={{
                position: 'absolute', top: -10, right: -10,
                width: 20, height: 20, borderRadius: '50%', background: color,
                boxShadow: `0 0 10px ${color}`
              }} />
            )}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: isAlert ? color : 'var(--color-text-mid)', letterSpacing: 1.5 }}>
              {zone.label}
            </div>
            <div style={{ fontSize: 9, color: 'var(--color-text-mid)' }}>{zone.subtitle}</div>
          </div>
        );
      })}

      <style>{`
        @keyframes pulseAlert {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}
