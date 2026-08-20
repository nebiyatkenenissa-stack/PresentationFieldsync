// components/users/UserManagement.js - WITH FULL VALIDATION + LANGUAGE SELECTOR + HIERARCHICAL LOCATIONS

import React, { useState } from 'react';
import { db, syncQueue, checkRealInternet, getApiBase } from '../../services/database';
import { useUserLanguage } from '../context/UserLanguageContext';
import UserLanguageSelector from './UserLanguageSelector';
import LocationSelect from '../common/LocationSelect';
import UserAvatar from '../common/UserAvatar';

const fieldStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: '8px',
  border: '1.5px solid #e2e8f0',
  background: '#fafbfc',
  fontSize: '14px',
  color: '#1a202c',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s'
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '600',
  color: '#475569',
  marginBottom: '6px',
  letterSpacing: '0.3px'
};

const disabledFieldStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: '8px',
  border: '1.5px solid #e5e7eb',
  background: '#f3f4f6',
  color: '#6b7280',
  fontSize: '14px',
  outline: 'none'
};

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '15px',
  fontWeight: '600',
  color: '#1e3a5f',
  margin: '0 0 16px'
};

function UserManagement({ 
  users, 
  setUsers, 
  addNotification,
  // Props from parent (App.js)
  newUser,
  setNewUser,
  handleCreateUser,
  toggleUserStatus,
  deleteUser,
  selectedLocations,
  onLocationSelect,
  woredaSupervisors,
  loadingSupervisors
}) {
  const { userT } = useUserLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editErrors, setEditErrors] = useState({ name: '', phone: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const supervisorOptions = (users || []).filter(u => u.role === 'supervisor' && u.status === 'active');
  const activeCount = (users || []).filter(u => u.status === 'active').length;
  const officerCount = (users || []).filter(u => u.role === 'field_officer').length;
  const supervisorCount = (users || []).filter(u => u.role === 'supervisor').length;
  const managerCount = (users || []).filter(u => u.role === 'manager').length;

  const ROLE_MAX_LEVEL = { manager: 'zone', supervisor: 'woreda', field_officer: 'community' };
  const ROLE_REQUIRED_LEVEL = { manager: 'zone', supervisor: 'woreda', field_officer: 'kebele' };
  const LOCATION_LEVELS = ['country', 'region', 'zone', 'woreda', 'kebele', 'community'];
  const maxLevelIdx = Math.max(0, LOCATION_LEVELS.indexOf(ROLE_MAX_LEVEL[newUser.role] || 'community'));
  const requiredLevel = ROLE_REQUIRED_LEVEL[newUser.role];

  // ===== RESET PASSWORD (reset + email new password to the user) =====
  const resendCredentials = async (u) => {
    const online = await checkRealInternet();
    if (!online) {
      alert('You are offline. The password reset email cannot be sent right now.');
      return;
    }
    try {
      let response = await fetch(`${getApiBase()}/users/resend-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: u.email })
      });
      let result = await response.json();

      // If the user never reached the server (created offline), create/sync
      // them first via POST /api/users, which also emails the credentials.
      if (response.status === 404) {
        const syncBody = {
          ...u,
          password: u.password || 'temp123',
          mustChangePassword: true
        };
        response = await fetch(`${getApiBase()}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(syncBody)
        });
        result = await response.json();
      }

      const tempPassword = result.temporaryPassword;
      if (response.ok && tempPassword) {
        await db.users.update(u.id, { password: tempPassword, synced: true, must_change_password: true });
        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, password: tempPassword, synced: true, must_change_password: true } : x));
        alert(`🔑 Password reset and sent to ${u.email}.\n\nNew password: ${tempPassword}\n\nShare this with the user (they will be asked to change it on first login).`);
        if (addNotification) {
          addNotification(u.id, '🔑 Credentials Reset', `Your FieldSync password was reset. Check ${u.email} for the new password.`, 'info');
        }
      } else {
        alert('Could not reset the password: ' + (result.error || 'unknown error'));
      }
    } catch (err) {
      console.error('Error resetting credentials:', err);
      alert('Failed to reach the server. Please try again.');
    }
  };
  
  // Validation errors (local to this component)
  const [errors, setErrors] = useState({
    name: '',
    phone: ''
  });

  // ===== EDIT USER =====
  const ROLE_PREFIX = { manager: 'MGR', supervisor: 'SUP', field_officer: 'FO' };

  // Next free employee ID for a given role (avoids reusing IDs of deleted users).
  const nextEmployeeId = (role) => {
    const prefix = ROLE_PREFIX[role] || 'FO';
    let max = 0;
    (users || []).forEach(u => {
      const m = String(u.employeeId || '').match(new RegExp(`^${prefix}(\\d+)$`));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
  };

  // Keep the numeric suffix when the role changes, but switch to the new
  // role's prefix so manager/supervisor/field officer IDs stay distinct.
  const rePrefix = (employeeId, role) => {
    const current = String(employeeId || '').trim();
    const suffixMatch = current.match(/^[A-Z]+(\d+)$/);
    const suffix = suffixMatch ? suffixMatch[1] : String(nextEmployeeId(role).replace(/^[A-Z]+/, ''));
    return `${ROLE_PREFIX[role] || 'FO'}${String(parseInt(suffix, 10) || 1).padStart(3, '0')}`;
  };

  const validateEmployeeId = (employeeId, excludeUserId) => {
    const value = String(employeeId || '').trim();
    if (!value) return 'Employee ID is required';
    if (!/^[A-Z]+\d{3}$/.test(value)) return 'Employee ID must be letters followed by 3 digits (e.g. SUP001)';
    const taken = (users || []).find(u => u.id !== excludeUserId && String(u.employeeId || '').toUpperCase() === value.toUpperCase());
    if (taken) return `Employee ID ${value} is already used by ${taken.name}`;
    return '';
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setEditForm({
      name: u.name || '',
      email: u.email || '',
      phone: u.phone || '',
      employeeId: u.employeeId || '',
      role: u.role || 'field_officer',
      status: u.status || 'active',
      supervisorId: u.supervisorId || '',
      assignedSites: u.assignedSites || ''
    });
    setEditErrors({ name: '', phone: '', employeeId: '' });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'role') {
        next.employeeId = rePrefix(prev.employeeId, value);
        if (value !== 'field_officer') next.supervisorId = '';
      }
      return next;
    });
    if (name === 'name') {
      setEditErrors(prev => ({ ...prev, name: validateName(value) }));
    } else if (name === 'phone') {
      setEditErrors(prev => ({ ...prev, phone: validatePhone(value) }));
    } else if (name === 'employeeId') {
      setEditErrors(prev => ({ ...prev, employeeId: validateEmployeeId(value, editingUser?.id) }));
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;

    const employeeIdError = validateEmployeeId(editForm.employeeId, editingUser.id);
    setEditErrors(prev => ({ ...prev, employeeId: employeeIdError }));
    if (employeeIdError) {
      alert(employeeIdError);
      return;
    }
    if (!editForm.name.trim() || !editForm.email.trim()) {
      alert('Name and Email are required.');
      return;
    }
    if (editForm.role === 'field_officer' && !editForm.supervisorId) {
      alert('Please select a Supervisor for the Field Officer.');
      return;
    }

    // Name, email and phone are read-only here; only role, status,
    // supervisor, assigned sites and the employee ID may be edited.
    const updatedUser = {
      ...editingUser,
      name: editingUser.name,
      email: editingUser.email,
      phone: editingUser.phone,
      employeeId: String(editForm.employeeId || '').trim().toUpperCase(),
      role: editForm.role,
      status: editForm.status,
      supervisorId: editForm.role === 'field_officer' ? editForm.supervisorId : null,
      assignedSites: editForm.role === 'field_officer' ? editForm.assignedSites : undefined
    };

    setIsSavingEdit(true);
    try {
      setUsers(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u));
      await db.users.update(editingUser.id, updatedUser);

      const online = await checkRealInternet();
      let serverSuccess = false;
      if (online) {
        try {
          const resp = await fetch(`${getApiBase()}/users/${editingUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedUser)
          });
          if (resp.ok) {
            const serverUser = await resp.json();
            setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...serverUser } : u));
            await db.users.update(editingUser.id, serverUser);
            serverSuccess = true;
            console.log('✅ User updated on server');
          } else {
            throw new Error('Server rejected user update');
          }
        } catch (err) {
          console.error('Edit server update failed:', err);
        }
      }

      if (!serverSuccess) {
        const queueItems = syncQueue.getAll();
        const alreadyQueued = queueItems.some(item => item.type === 'user_update' && (item.id === editingUser.id || item.data?.id === editingUser.id));
        if (!alreadyQueued) {
          syncQueue.add({ type: 'user_update', id: editingUser.id, data: updatedUser });
        }
        if (!online) alert('📋 User saved offline. Will sync when online.');
      }
      alert(`✅ User ${updatedUser.name} updated successfully.`);
      setEditingUser(null);
    } catch (err) {
      console.error('Error updating user:', err);
      alert('Failed to update user. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ===== VALIDATION FUNCTIONS =====
  const validateName = (name) => {
    if (!name.trim()) return userT('userManagement.nameRequired') || 'Full name is required';
    if (/[0-9]/.test(name)) return userT('userManagement.nameNoNumbers') || 'Full name must not contain numbers';
    return '';
  };

  const validatePhone = (phone) => {
    const fullPhone = phone.trim();
    if (!fullPhone) return ''; // optional
    if (!/^(\+251|0)9\d{8}$/.test(fullPhone)) {
      return 'Phone must be +2519XXXXXXXX or 09XXXXXXXX (8 digits after the prefix)';
    }
    return '';
  };

  // ===== HANDLE FIELD CHANGES WITH REAL-TIME VALIDATION =====
  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({ ...prev, [name]: value }));

    if (name === 'name') {
      setErrors(prev => ({ ...prev, name: validateName(value) }));
    } else if (name === 'phone') {
      setErrors(prev => ({ ...prev, phone: validatePhone(value) }));
    }
  };

  // ===== SUBMIT =====
  const onSubmit = async (e) => {
    e.preventDefault();

    // Final validation
    const nameError = validateName(newUser.name);
    const phoneError = validatePhone(newUser.phone);
    setErrors({ name: nameError, phone: phoneError });

    if (nameError || phoneError) {
      alert('Please fix the validation errors before submitting.');
      return;
    }

    const userExists = users.some(u => u.email === newUser.email);
    if (userExists) {
      alert(userT('userManagement.userExists'));
      return;
    }

    if (!newUser.name || !newUser.email || !newUser.role) {
      alert(userT('userManagement.fillRequired'));
      return;
    }

    if (newUser.role === 'field_officer' && !selectedLocations.woreda) {
      alert('Please select a Woreda for Field Officers.');
      return;
    }

    if (!selectedLocations[requiredLevel]) {
      alert(`Please select the ${requiredLevel} for ${newUser.role}.`);
      return;
    }

    if (newUser.role === 'field_officer' && !newUser.supervisorId) {
      alert('Please select a Supervisor for the Field Officer.');
      return;
    }

    setIsSubmitting(true);
    try {
      await handleCreateUser(e);
    } catch (error) {
      console.error('Error creating user:', error);
      alert(userT('userManagement.createError', { error: error.message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const chipStyle = {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    padding: '6px 14px',
    borderRadius: '24px',
    fontSize: '13px',
    fontWeight: '600'
  };

  const rolePill = (role) => {
    if (role === 'manager') return { background: '#dbeafe', color: '#1e40af', label: userT('userManagement.manager') };
    if (role === 'supervisor') return { background: '#d1fae5', color: '#065f37', label: userT('userManagement.supervisor') };
    return { background: '#fef3c7', color: '#92400e', label: userT('userManagement.fieldOfficer') };
  };

  return (
    <div className="user-management" style={{ padding: '0' }}>
      {/* ===== HERO HEADER (dashboard style) ===== */}
      <div style={{
        background: 'linear-gradient(135deg, #0f2a4a 0%, #1e3a5f 55%, #2563eb 120%)',
        borderRadius: '16px',
        padding: '28px 28px 26px',
        margin: '0 0 24px',
        color: 'white',
        boxShadow: '0 8px 24px rgba(15,42,74,0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>👥 {userT('userManagement.title')}</h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            Create and manage Field Officers, Supervisors and Managers — roles, locations, status and system-assigned Employee IDs.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span style={chipStyle}>👤 {users.length} Users</span>
          <span style={{ ...chipStyle, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(52,211,153,0.5)' }}>🟢 {activeCount} Active</span>
          <span style={{ ...chipStyle, background: 'rgba(96,165,250,0.2)', border: '1px solid rgba(147,197,253,0.5)' }}>📋 {officerCount} Field Officers</span>
          <span style={{ ...chipStyle, background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(196,181,253,0.5)' }}>🛡️ {supervisorCount} Supervisors</span>
          {managerCount > 0 && (
            <span style={{ ...chipStyle, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(252,211,77,0.4)' }}>🧑‍💼 {managerCount} Managers</span>
          )}
        </div>
      </div>

      {/* ===== LANGUAGE SELECTOR ===== */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '20px'
      }}>
        <UserLanguageSelector />
      </div>

      {/* ===== CREATE USER FORM ===== */}
      <div className="form-card" style={{ marginBottom: '24px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)' }}>
        <div style={sectionHeaderStyle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4fc3f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="8.5" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          <span>{userT('userManagement.createUser')}</span>
        </div>

        <form onSubmit={onSubmit} noValidate>
          {/* Basic Info */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>{userT('userManagement.fullName')} *</label>
              <input
                type="text"
                name="name"
                value={newUser.name}
                onChange={handleChange}
                placeholder={userT('userManagement.enterName')}
                required
                style={{ ...fieldStyle, borderColor: errors.name ? '#dc2626' : undefined }}
              />
              {errors.name && (
                <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>{errors.name}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>{userT('userManagement.email')} *</label>
              <input
                type="email"
                name="email"
                value={newUser.email}
                onChange={handleChange}
                placeholder={userT('userManagement.enterEmail')}
                required
                style={fieldStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>{userT('userManagement.role')} *</label>
              <select
                name="role"
                value={newUser.role}
                onChange={handleChange}
                required
                style={fieldStyle}
              >
                <option value="">{userT('userManagement.selectRole')}</option>
                <option value="field_officer">{userT('userManagement.fieldOfficer')}</option>
                <option value="supervisor">{userT('userManagement.supervisor')}</option>
                <option value="manager">{userT('userManagement.manager')}</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>{userT('userManagement.employeeId')}</label>
              <input
                type="text"
                value={newUser.role ? nextEmployeeId(newUser.role) : ''}
                disabled
                title="Employee ID is system-assigned automatically"
                placeholder="System-assigned"
                style={disabledFieldStyle}
              />
              <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>Assigned automatically by the system</small>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={labelStyle}>{userT('userManagement.phone')}</label>
              <input
                type="tel"
                name="phone"
                value={newUser.phone}
                onChange={handleChange}
                placeholder="+2519XXXXXXXX or 09XXXXXXXX"
                style={{ ...fieldStyle, borderColor: errors.phone ? '#dc2626' : undefined }}
              />
              {errors.phone && (
                <span style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>{errors.phone}</span>
              )}
              <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>e.g., +251912345678</small>
            </div>
          </div>

          {/* ===== LOCATION HIERARCHY (role-based depth) ===== */}
          <div style={{
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid #e2e8f0'
          }}>
            <div style={sectionHeaderStyle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4fc3f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>Location Assignment</span>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              {LOCATION_LEVELS.slice(0, maxLevelIdx + 1).map((level, idx) => {
                const prevLevel = idx === 0 ? null : LOCATION_LEVELS[idx - 1];
                const prev = prevLevel ? selectedLocations[prevLevel] : null;
                const parentId = prev && prev.id !== 'OTHER' ? prev.id : null;
                return (
                  <LocationSelect
                    key={level}
                    level={level}
                    parentId={parentId}
                    selectedValue={selectedLocations[level]}
                    onSelect={onLocationSelect}
                    disabled={idx > 0 && !parentId}
                    required={level === requiredLevel}
                  />
                );
              })}
            </div>
          </div>

          {/* ===== SUPERVISOR (field officers only) ===== */}
          {newUser.role === 'field_officer' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginTop: '16px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>{userT('userManagement.supervisor')} *</label>
                <select
                  name="supervisorId"
                  value={newUser.supervisorId || ''}
                  onChange={handleChange}
                  disabled={!selectedLocations.woreda || loadingSupervisors}
                  style={{ ...fieldStyle, background: !selectedLocations.woreda ? '#f3f4f6' : '#fafbfc' }}
                >
                  <option value="">{loadingSupervisors ? 'Loading...' : 'Select Supervisor'}</option>
                  {woredaSupervisors.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name} ({sup.employeeId})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: '#1e3a5f',
                color: 'white',
                border: 'none',
                padding: '12px 30px',
                borderRadius: '8px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                letterSpacing: '0.5px',
                opacity: isSubmitting ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(30, 58, 95, 0.25)',
                transition: 'background 0.2s, transform 0.2s'
              }}
              onMouseEnter={(e) => {
                if (isSubmitting) return;
                e.currentTarget.style.background = '#15324f';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                if (isSubmitting) return;
                e.currentTarget.style.background = '#1e3a5f';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {isSubmitting ? (
                <>
                  <span style={{
                    width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite'
                  }}></span>
                  {userT('userManagement.creating')}
                </>
              ) : userT('userManagement.create')}
            </button>
          </div>
        </form>
      </div>

      {/* ===== USERS TABLE ===== */}
      <div className="form-card" style={{
        padding: 0,
        borderRadius: '14px',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)'
      }}>
        <div style={{
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e2e8f0',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: '#1a202c' }}>
              👥 {userT('userManagement.allUsers')}
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              {userT('userManagement.totalUsers', { count: users.length })}
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{userT('userManagement.employeeId')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{userT('userManagement.name')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{userT('userManagement.email')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{userT('userManagement.role')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{userT('userManagement.region')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{userT('userManagement.phone')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{userT('userManagement.status')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569', borderBottom: '1px solid #e2e8f0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{userT('userManagement.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>👤</div>
                    <div>{userT('userManagement.noUsers')}</div>
                  </td>
                </tr>
              )}
              {users.map(u => {
                const pill = rolePill(u.role);
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid #eef2f7', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1e3a5f', fontFamily: 'monospace' }}>{u.employeeId}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <UserAvatar user={u} size={36} />
                        <span style={{ fontWeight: '600', color: '#1a202c' }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{u.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: pill.background,
                        color: pill.color
                      }}>
                        {pill.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569', maxWidth: '200px' }}>{u.region}</td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{u.phone || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: u.status === 'active' ? '#d1fae5' : '#fee2e2',
                        color: u.status === 'active' ? '#065f37' : '#991b1b'
                      }}>
                        {u.status === 'active' ? userT('userManagement.active') : userT('userManagement.inactive')}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => openEdit(u)}
                          style={{
                            background: '#ffffff',
                            color: '#1e40af',
                            border: '1px solid #bfdbfe',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            display: 'inline-flex',
                            alignItems: 'center',
                            transition: 'background 0.2s, color 0.2s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                        >
                          {userT('userManagement.edit')}
                        </button>
                        <button
                          onClick={() => toggleUserStatus(u.id)}
                          style={{
                            background: u.status === 'active' ? '#ffffff' : '#0b7e4b',
                            color: u.status === 'active' ? '#b91c1c' : '#ffffff',
                            border: u.status === 'active' ? '1px solid #fecaca' : '1px solid #0b7e4b',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            display: 'inline-flex',
                            alignItems: 'center',
                            transition: 'background 0.2s, color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = u.status === 'active' ? '#fef2f2' : '#0a6e42';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = u.status === 'active' ? '#ffffff' : '#0b7e4b';
                          }}
                        >
                          {u.status === 'active' ? userT('userManagement.deactivate') : userT('userManagement.activate')}
                        </button>
                        <button
                          onClick={() => deleteUser(u.id)}
                          style={{
                            background: '#ffffff',
                            color: '#b91c1c',
                            border: '1px solid #fecaca',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '500',
                            display: 'inline-flex',
                            alignItems: 'center',
                            transition: 'background 0.2s, color 0.2s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                        >
                          {userT('userManagement.delete')}
                        </button>
                        {u.role !== 'manager' && (
                          <button
                            onClick={() => resendCredentials(u)}
                            style={{
                              background: '#ffffff',
                              color: '#1e40af',
                              border: '1px solid #bfdbfe',
                              padding: '6px 14px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '500',
                              display: 'inline-flex',
                              alignItems: 'center',
                              transition: 'background 0.2s, color 0.2s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                          >
                            Reset Password
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== EDIT USER MODAL ===== */}
      {editingUser && (
        <div
          onClick={() => setEditingUser(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(2px)'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: '14px', padding: '28px',
              maxWidth: '600px', width: '94%', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
                  ✏️ Edit User
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  {editForm.name || ''} • {editForm.employeeId || ''}
                </p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}
              >✕</button>
            </div>

            <form onSubmit={handleEditSubmit} noValidate>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={labelStyle}>{userT('userManagement.fullName')}</label>
                  <input type="text" name="name" value={editForm.name || ''} disabled style={disabledFieldStyle} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={labelStyle}>{userT('userManagement.email')}</label>
                  <input type="email" name="email" value={editForm.email || ''} disabled style={disabledFieldStyle} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={labelStyle}>{userT('userManagement.phone')}</label>
                  <input type="tel" name="phone" value={editForm.phone || ''} disabled style={disabledFieldStyle} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={labelStyle}>{userT('userManagement.employeeId')}</label>
                  <input
                    type="text"
                    name="employeeId"
                    value={editForm.employeeId || ''}
                    disabled
                    title="Employee ID is system-assigned and cannot be edited"
                    style={disabledFieldStyle}
                  />
                  <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>System-assigned automatically</small>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ ...labelStyle, color: '#374151' }}>{userT('userManagement.role')} *</label>
                  <select
                    name="role"
                    value={editForm.role || ''}
                    onChange={handleEditChange}
                    style={fieldStyle}
                  >
                    <option value="field_officer">{userT('userManagement.fieldOfficer')}</option>
                    <option value="supervisor">{userT('userManagement.supervisor')}</option>
                    <option value="manager">{userT('userManagement.manager')}</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ ...labelStyle, color: '#374151' }}>{userT('userManagement.status')}</label>
                  <select
                    name="status"
                    value={editForm.status || 'active'}
                    onChange={handleEditChange}
                    style={fieldStyle}
                  >
                    <option value="active">{userT('userManagement.active')}</option>
                    <option value="inactive">{userT('userManagement.inactive')}</option>
                  </select>
                </div>
              </div>

              {editForm.role === 'field_officer' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ ...labelStyle, color: '#374151' }}>{userT('userManagement.supervisor')} *</label>
                    <select
                      name="supervisorId"
                      value={editForm.supervisorId || ''}
                      onChange={handleEditChange}
                      style={fieldStyle}
                    >
                      <option value="">Select Supervisor</option>
                      {supervisorOptions.map(sup => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name} ({sup.employeeId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {editingUser.locationPath && (
                <div style={{ marginTop: '16px', fontSize: '13px', color: '#64748b', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px' }}>
                  📍 {editingUser.locationPath}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  style={{ padding: '10px 22px', borderRadius: '8px', border: '1.5px solid #d1d5db', background: '#ffffff', color: '#374151', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  style={{
                    padding: '10px 26px', borderRadius: '8px', border: 'none',
                    background: '#1e3a5f', color: 'white', cursor: isSavingEdit ? 'wait' : 'pointer',
                    fontSize: '14px', fontWeight: '600', letterSpacing: '0.4px', opacity: isSavingEdit ? 0.7 : 1,
                    boxShadow: '0 4px 14px rgba(30, 58, 95, 0.25)'
                  }}
                >
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
