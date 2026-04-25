import { useState, useEffect, useCallback } from 'react';
import { fetchStaff, addStaffMember, updateStaffMember, deleteStaffMember } from '../../services/firebaseService';

const ALL_SKILLS = [
  'Plumbing', 'Leak Control', 'Electrician', 'Electrical Safety', 'HVAC', 'Maintenance',
  'Housekeeping', 'Cleaning', 'Room Service', 'F&B', 'Carpentry',
  'Fire Fighting', 'Fire Marshal', 'Kitchen Safety', 'CPR', 'First Aid', 'AED',
  'Medical Emergency', 'Security', 'Emergency Evacuation', 'Guest Coordination',
  'Gas Safety', 'Hazmat', 'Rescue', 'Structural Engineering',
];

const ROLES = [
  'Plumber', 'Electrician', 'Room Cleaner', 'Housekeeping Supervisor', 'HVAC Technician',
  'Room Service Attendant', 'Head Chef', 'Security Officer', 'Hotel Nurse',
  'Maintenance Engineer', 'Front Desk Manager', 'Duty Manager', 'Security Guard',
  'Electrician Sr.', 'Housekeeping Lead', 'F&B Supervisor',
];

export default function StaffManager() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', role: '', floor: 1, skills: [], shift: 'day', phone: '', photoUrl: '', isAvailable: true });
  const [filter, setFilter] = useState('all');

  const loadStaff = useCallback(async () => {
    setLoading(true);
    const data = await fetchStaff();
    setStaff(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const resetForm = () => {
    setForm({ name: '', role: '', floor: 1, skills: [], shift: 'day', phone: '', photoUrl: '', isAvailable: true });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (s) => {
    setForm({ name: s.name, role: s.role, floor: s.floor, skills: [...s.skills], shift: s.shift || 'day', phone: s.phone || '', photoUrl: s.photoUrl || '', isAvailable: s.isAvailable });
    setEditingId(s.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.role) return;

    if (editingId) {
      await updateStaffMember(editingId, form);
    } else {
      await addStaffMember(form);
    }
    resetForm();
    await loadStaff();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this staff member?')) return;
    await deleteStaffMember(id);
    await loadStaff();
  };

  const toggleSkill = (skill) => {
    setForm(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const filtered = filter === 'all'
    ? staff
    : filter === 'available'
      ? staff.filter(s => s.isAvailable)
      : filter === 'utility'
        ? staff.filter(s => ['Plumber', 'Electrician', 'Room Cleaner', 'HVAC Technician', 'Housekeeping Supervisor', 'Room Service Attendant', 'Maintenance Engineer', 'Housekeeping Lead'].includes(s.role))
        : staff.filter(s => ['Security Officer', 'Security Guard', 'Hotel Nurse', 'Duty Manager', 'Fire Marshal', 'Head Chef'].includes(s.role));

  return (
    <div className="staff-mgr">
      <div className="staff-mgr-header">
        <div>
          <h1 className="staff-mgr-title">Staff & Skills Registry</h1>
          <p className="staff-mgr-sub">{staff.length} personnel · {staff.filter(s => s.isAvailable).length} on duty</p>
        </div>
        <button className="staff-mgr-add" onClick={() => setShowForm(true)}>
          + Add Staff
        </button>
      </div>

      {/* Filters */}
      <div className="staff-mgr-filters">
        {[
          { key: 'all', label: 'All' },
          { key: 'available', label: 'On Duty' },
          { key: 'utility', label: 'Utility' },
          { key: 'emergency', label: 'Emergency' },
        ].map(f => (
          <button
            key={f.key}
            className={`staff-filter-btn ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="staff-form-overlay" onClick={(e) => e.target === e.currentTarget && resetForm()}>
          <form className="staff-form" onSubmit={handleSubmit}>
            <h2 className="staff-form-title">{editingId ? 'Edit Staff' : 'Add Staff Member'}</h2>

            <div className="staff-form-grid">
              <div className="staff-form-field">
                <label>Full Name</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Mukesh Yadav" required />
              </div>
              <div className="staff-form-field">
                <label>Role</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} required>
                  <option value="">Select role...</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="staff-form-field">
                <label>Floor Assignment</label>
                <select value={form.floor} onChange={e => setForm({...form, floor: parseInt(e.target.value)})}>
                  {[-1, 0, 1, 2, 3, 4].map(f => <option key={f} value={f}>{f === -1 ? 'Basement' : f === 0 ? 'Ground' : `Floor ${f}`}</option>)}
                </select>
              </div>
              <div className="staff-form-field">
                <label>Shift</label>
                <select value={form.shift} onChange={e => setForm({...form, shift: e.target.value})}>
                  <option value="day">Day (6am-6pm)</option>
                  <option value="night">Night (6pm-6am)</option>
                  <option value="swing">Swing (2pm-10pm)</option>
                </select>
              </div>
              <div className="staff-form-field">
                <label>Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+91-9800000001" />
              </div>
              <div className="staff-form-field">
                <label>Photo URL (Optional)</label>
                <input type="url" value={form.photoUrl} onChange={e => setForm({...form, photoUrl: e.target.value})} placeholder="https://example.com/photo.jpg" />
              </div>
              <div className="staff-form-field">
                <label>
                  <input type="checkbox" checked={form.isAvailable} onChange={e => setForm({...form, isAvailable: e.target.checked})} />
                  {' '}Available for dispatch
                </label>
              </div>
            </div>

            <div className="staff-form-skills">
              <label>Skills & Certifications</label>
              <div className="staff-skill-grid">
                {ALL_SKILLS.map(skill => (
                  <button
                    key={skill}
                    type="button"
                    className={`staff-skill-chip ${form.skills.includes(skill) ? 'selected' : ''}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>

            <div className="staff-form-actions">
              <button type="button" className="staff-form-cancel" onClick={resetForm}>Cancel</button>
              <button type="submit" className="staff-form-submit">{editingId ? 'Update' : 'Add'} Staff</button>
            </div>
          </form>
        </div>
      )}

      {/* Staff Grid */}
      {loading ? (
        <div className="staff-mgr-loading">Loading personnel registry...</div>
      ) : (
        <div className="staff-grid">
          {filtered.map(s => (
            <div key={s.id} className={`staff-card ${!s.isAvailable ? 'unavailable' : ''}`}>
              <div className="staff-card-top">
                {s.photoUrl ? (
                  <div className="staff-card-avatar" style={{ backgroundImage: `url(${s.photoUrl})`, backgroundSize: 'cover', color: 'transparent' }}>
                    {s.name.charAt(0)}
                  </div>
                ) : (
                  <div className="staff-card-avatar">{s.name.charAt(0)}</div>
                )}
                <div className="staff-card-info">
                  <div className="staff-card-name">{s.name}</div>
                  <div className="staff-card-role">{s.role}</div>
                </div>
                <div className={`staff-card-status ${s.isAvailable ? 'on' : 'off'}`}>
                  {s.isAvailable ? 'ON DUTY' : 'OFF'}
                </div>
              </div>

              <div className="staff-card-meta">
                <span>📍 {s.floor === -1 ? 'Basement' : s.floor === 0 ? 'Ground' : `Floor ${s.floor}`}</span>
                <span>🕐 {(s.shift || 'day').charAt(0).toUpperCase() + (s.shift || 'day').slice(1)}</span>
              </div>

              <div className="staff-card-skills">
                {s.skills.slice(0, 4).map(sk => (
                  <span key={sk} className="staff-card-skill-tag">{sk}</span>
                ))}
                {s.skills.length > 4 && <span className="staff-card-skill-more">+{s.skills.length - 4}</span>}
              </div>

              <div className="staff-card-actions">
                <button className="staff-card-edit" onClick={() => handleEdit(s)}>Edit</button>
                <button className="staff-card-delete" onClick={() => handleDelete(s.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
