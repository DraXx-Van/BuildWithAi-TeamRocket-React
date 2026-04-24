export default function StaffCard({ member }) {
  const statusColor = member.isAvailable ? 'var(--color-success)' : 'var(--color-warning)';
  const initial = member.name.charAt(0);

  return (
    <div style={{
      background: 'rgba(39,39,42,0.5)',
      border: '1px solid rgba(63,63,70,0.4)',
      borderRadius: 'var(--radius-lg)',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* Top: Avatar + name + status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(139,92,246,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: 'var(--color-primary)',
        }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-hi)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-mid)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.role}</div>
        </div>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: statusColor,
          flexShrink: 0,
          boxShadow: `0 0 8px ${statusColor}80`,
        }} />
      </div>

      {/* Floor + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-mid)' }}>📍 Floor {member.floor}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: statusColor, letterSpacing: 1 }}>
          {member.isAvailable ? 'ON DUTY' : 'BUSY'}
        </span>
      </div>

      {/* Skills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {member.skills.slice(0, 3).map((s, i) => (
          <span key={i} style={{
            padding: '2px 7px',
            background: 'rgba(63,63,70,0.5)',
            borderRadius: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 600,
            color: 'var(--color-text-mid)',
          }}>{s}</span>
        ))}
      </div>
    </div>
  );
}
