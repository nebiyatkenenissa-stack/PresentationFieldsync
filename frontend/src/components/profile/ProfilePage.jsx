// components/profile/ProfilePage.jsx
// Profile as a full page (own tab) with password visibility toggles

import React, { useState, useEffect } from 'react';
import { db, syncQueue, checkRealInternet, getApiBase } from '../../services/database';
import { getProfilePhotoUrl } from '../../utils/helpers';

const inputStyle = {
  width: '100%',
  padding: '11px 48px 11px 14px',
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

function PasswordField({ value, onChange, placeholder, visible, onToggleVisible }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={inputStyle}
      />
      <button
        type="button"
        onClick={onToggleVisible}
        title={visible ? 'Hide password' : 'Show password'}
        aria-label={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          borderRadius: '6px',
          transition: 'color 0.2s, background 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#1e3a5f';
          e.currentTarget.style.background = '#f1f5f9';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#94a3b8';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {visible ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
            <line x1="2" y1="2" x2="22" y2="22"/>
          </svg>
        )}
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function ProfilePage({ user, setUser, setUsers }) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    currentPassword: '',
    password: '',
    confirmPassword: ''
  });

  const [photoPreview, setPhotoPreview] = useState(
    user?.profilePhoto ? getProfilePhotoUrl(user.profilePhoto) : null
  );
  const [selectedProfileFile, setSelectedProfileFile] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verificationWarning, setVerificationWarning] = useState(null);

  // ===== DETECT 'SUSPICIOUS' STATUS FROM VERIFICATION HISTORY =====
  // Flagged after 3+ consecutive failed verifications.
  useEffect(() => {
    if (!user) return;

    const computeWarning = async () => {
      try {
        let records = [];
        const saved = localStorage.getItem(`verification_${user.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          records = parsed.history || [];
        }
        if (db && db.verification_history) {
          const dbRecords = await db.verification_history
            .where('officerId')
            .equals(user.id)
            .toArray();
          if (dbRecords.length > records.length) {
            records = dbRecords;
          }
        }
        const sorted = [...records].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        let consecutiveFailures = 0;
        for (const h of sorted) {
          if (h.success === false) consecutiveFailures += 1;
          else break;
        }
        setVerificationWarning(consecutiveFailures >= 3
          ? `${consecutiveFailures} consecutive failed verifications. Your account has been flagged as suspicious and your supervisor has been notified.`
          : null);
      } catch (e) {
        console.error('Error checking verification status:', e);
      }
    };

    computeWarning();

    const handleUpdate = (event) => {
      if (event.detail?.officerId === user.id) computeWarning();
    };
    window.addEventListener('verification-update', handleUpdate);
    return () => window.removeEventListener('verification-update', handleUpdate);
  }, [user]);

  const set = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2 MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed.');
      return;
    }
    setSelectedProfileFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    if (!form.name.trim() || !form.email.trim()) {
      alert('Name and Email are required.');
      setSaving(false);
      return;
    }

    if (form.phone.trim() && !/^(\+251|0)9\d{8}$/.test(form.phone.trim())) {
      alert('Phone must start with 09 or +2519 and have 9 digits after 0/+251 (e.g. 0912345678).');
      setSaving(false);
      return;
    }

    if (form.password || form.confirmPassword) {
      if (form.password !== form.confirmPassword) {
        alert('Passwords do not match.');
        setSaving(false);
        return;
      }
      if (form.password.length < 4) {
        alert('Password must be at least 4 characters.');
        setSaving(false);
        return;
      }
      if (!form.currentPassword) {
        alert('Please enter your current password to change it.');
        setSaving(false);
        return;
      }
    }

    const online = await checkRealInternet();
    let updatedUser = { ...user };
    let serverSuccess = false;

    const updatedFields = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim()
    };

    if (online) {
      try {
        const response = await fetch(`${getApiBase()}/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedFields)
        });
        if (response.ok) {
          const serverUser = await response.json();
          updatedUser = {
            ...user,
            ...serverUser,
            profilePhoto: serverUser.profile_photo || user.profilePhoto || null,
            password: user.password
          };
          serverSuccess = true;
          console.log('✅ Profile info updated on server');
        } else {
          throw new Error(await response.text());
        }
      } catch (err) {
        console.error('Server update failed:', err);
      }
    }

    if (serverSuccess) {
      setUser(updatedUser);
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      await db.users.update(user.id, updatedUser);
    } else {
      updatedUser = { ...user, ...updatedFields };
      setUser(updatedUser);
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      await db.users.update(user.id, updatedUser);
      if (!online) {
        const queueItems = syncQueue.getAll();
        const alreadyQueued = queueItems.some(item => item.id === user.id && item.type === 'user_update');
        if (!alreadyQueued) {
          syncQueue.add({ type: 'user_update', id: user.id, data: updatedUser });
          alert('📋 Profile saved offline. Will sync when online.');
        }
      } else {
        alert('Profile saved locally, but server update failed. Please try again later.');
      }
    }

    if (form.password) {
      const localPwMatches = !user.password || form.currentPassword === user.password;
      if (!localPwMatches) {
        alert('❌ Current password is incorrect.');
      } else {
        const pwPayload = {
          email: user.email,
          currentPassword: form.currentPassword,
          newPassword: form.password
        };
        if (online) {
          try {
            const pwRes = await fetch(`${getApiBase()}/auth/change-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(pwPayload)
            });
            if (pwRes.ok) {
              const userWithPw = { ...updatedUser, password: form.password };
              setUser(userWithPw);
              setUsers(prev => prev.map(u => u.id === userWithPw.id ? userWithPw : u));
              await db.users.update(user.id, userWithPw);
              alert('✅ Password changed successfully!');
            } else {
              const errData = await pwRes.json();
              if (user.password && (errData.error === 'Current password is incorrect' || errData.error === 'User not found')) {
                const userWithPw = { ...updatedUser, password: form.password, must_change_password: false };
                setUser(userWithPw);
                setUsers(prev => prev.map(u => u.id === userWithPw.id ? userWithPw : u));
                await db.users.update(user.id, userWithPw);
                try {
                  await fetch(`${getApiBase()}/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      type: 'user',
                      data: { ...userWithPw, password: form.password, mustChangePassword: false }
                    })
                  });
                } catch (syncErr) {
                  console.error('Password sync error:', syncErr);
                }
                alert("✅ Password changed! The server couldn't verify your old password, so it was updated locally and synced.");
              } else {
                alert(`❌ Password change failed: ${errData.error || 'Unknown error'}`);
              }
            }
          } catch (err) {
            console.error('Password change error:', err);
            alert('Network error while changing password.');
          }
        } else {
          alert('Offline: password change will be synced later.');
          const userWithPw = { ...updatedUser, password: form.password };
          setUser(userWithPw);
          setUsers(prev => prev.map(u => u.id === userWithPw.id ? userWithPw : u));
          await db.users.update(user.id, userWithPw);
          const queueItems = syncQueue.getAll();
          const alreadyQueued = queueItems.some(item => item.id === user.id && item.type === 'user_update');
          if (!alreadyQueued) {
            syncQueue.add({ type: 'user_update', id: user.id, data: userWithPw });
          }
        }
      }
    }

    if (selectedProfileFile) {
      const formData = new FormData();
      formData.append('profilePhoto', selectedProfileFile);
      if (online) {
        try {
          const photoRes = await fetch(`${getApiBase()}/users/${user.id}/photo`, {
            method: 'POST',
            body: formData
          });
          if (photoRes.ok) {
            const photoData = await photoRes.json();
            const userWithPhoto = { ...updatedUser, profilePhoto: photoData.profilePhoto };
            setUser(userWithPhoto);
            setUsers(prev => prev.map(u => u.id === userWithPhoto.id ? userWithPhoto : u));
            await db.users.update(user.id, userWithPhoto);
            setPhotoPreview(getProfilePhotoUrl(photoData.profilePhoto));
            console.log('✅ Photo uploaded');
          } else {
            throw new Error('Photo upload failed');
          }
        } catch (err) {
          console.error('Photo upload error:', err);
          alert('Photo upload failed. Please try again.');
        }
      } else {
        alert('Offline: photo will be uploaded when online.');
      }
    }

    setForm(prev => ({ ...prev, currentPassword: '', password: '', confirmPassword: '' }));
    setSelectedProfileFile(null);
    setSaving(false);
    alert('✅ Profile updated successfully!');
  };

  const initials = (user?.name || 'U')
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const sectionHeaderStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#1e3a5f',
    marginBottom: '18px',
    paddingBottom: '12px',
    borderBottom: '1px solid #e2e8f0'
  };

  return (
    <div className="all-reports-view">
      <div className="form-card" style={{
        padding: 0,
        overflow: 'hidden',
        borderRadius: '14px',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
        border: '1px solid #e2e8f0',
        width: '100%'
      }}>
        {/* Profile Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f 0%, #274b74 55%, #4fc3f7 130%)',
          padding: '40px 32px 0',
          position: 'relative',
          color: '#fff'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap'
          }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: '108px',
                height: '108px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '4px solid #fff',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{
                    fontSize: '38px',
                    fontWeight: '700',
                    color: '#1e3a5f',
                    fontFamily: 'inherit'
                  }}>
                    {initials}
                  </span>
                )}
              </div>
              <label
                style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '-2px',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#4fc3f7',
                  border: '3px solid #fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#29b3ef'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#4fc3f7'; }}
                title="Change photo"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0f2239" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: 'none' }} />
              </label>
            </div>

            <div style={{ flex: 1, minWidth: '200px' }}>
              <h3 style={{ fontSize: '22px', fontWeight: '600', margin: 0 }}>{user?.name || 'My Profile'}</h3>
              <p style={{ fontSize: '13px', opacity: '0.85', margin: '4px 0 0' }}>
                {user?.email || ''}
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
                <span style={{
                  background: 'rgba(255, 255, 255, 0.16)',
                  color: '#fff',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  letterSpacing: '0.4px',
                  textTransform: 'capitalize'
                }}>
                  {(user?.role || 'Officer').replace('_', ' ')}
                </span>
                <span style={{
                  background: 'rgba(255, 255, 255, 0.16)',
                  color: '#fff',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  letterSpacing: '0.4px'
                }}>
                  ID: {user?.employeeId || '—'}
                </span>
                <span style={{
                  background: 'rgba(255, 255, 255, 0.16)',
                  color: '#fff',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  letterSpacing: '0.4px'
                }}>
                  {user?.region || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 32px 32px' }}>
          {verificationWarning && (
            <div style={{
              marginBottom: '20px',
              padding: '14px 16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderLeft: '4px solid #dc2626',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#991b1b',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}>
              <span style={{ fontSize: '20px', lineHeight: 1 }}>⚠️</span>
              <span>
                <strong>Your account is flagged as suspicious.</strong> {verificationWarning}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={sectionHeaderStyle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4fc3f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Personal Information
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '0 20px'
            }}>
              <Field label="Full Name *">
                <input type="text" value={form.name} onChange={set('name')} style={inputStyle} required />
              </Field>
              <Field label="Email Address *">
                <input type="email" value={form.email} onChange={set('email')} style={inputStyle} required />
              </Field>
              <Field label="Phone Number">
                <input type="text" placeholder="e.g. 0912345678" value={form.phone} onChange={set('phone')} style={inputStyle} />
              </Field>
            </div>

            <div style={sectionHeaderStyle}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4fc3f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              Change Password (optional)
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '0 20px'
            }}>
              <Field label="Current Password">
                <PasswordField
                  value={form.currentPassword}
                  onChange={set('currentPassword')}
                  placeholder="Required to change password"
                  visible={showCurrentPassword}
                  onToggleVisible={() => setShowCurrentPassword(v => !v)}
                />
              </Field>
              <Field label="New Password">
                <PasswordField
                  value={form.password}
                  onChange={set('password')}
                  placeholder="Leave blank to keep current"
                  visible={showPassword}
                  onToggleVisible={() => setShowPassword(v => !v)}
                />
              </Field>
              <Field label="Confirm Password">
                <PasswordField
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                  placeholder="Confirm new password"
                  visible={showConfirmPassword}
                  onToggleVisible={() => setShowConfirmPassword(v => !v)}
                />
              </Field>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '8px',
              paddingTop: '20px',
              borderTop: '1px solid #e2e8f0'
            }}>
              <button type="submit" disabled={saving} style={{
                padding: '12px 32px',
                borderRadius: '8px',
                border: 'none',
                background: '#1e3a5f',
                color: '#fff',
                cursor: saving ? 'wait' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                letterSpacing: '0.5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(30, 58, 95, 0.25)',
                transition: 'background 0.2s, transform 0.2s, box-shadow 0.2s'
              }}
                onMouseEnter={(e) => {
                  if (saving) return;
                  e.currentTarget.style.background = '#15324f';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(30, 58, 95, 0.35)';
                }}
                onMouseLeave={(e) => {
                  if (saving) return;
                  e.currentTarget.style.background = '#1e3a5f';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(30, 58, 95, 0.25)';
                }}
              >
                {saving ? (
                  <>
                    <span style={{
                      width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite'
                    }}></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                      <polyline points="17 21 17 13 7 13 7 21"/>
                      <polyline points="7 3 7 8 15 8"/>
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
