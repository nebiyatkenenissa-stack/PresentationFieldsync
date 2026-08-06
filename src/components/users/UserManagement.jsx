// components/users/UserManagement.js - WITH FULL VALIDATION + LANGUAGE SELECTOR + HIERARCHICAL LOCATIONS

import React, { useState } from 'react';
import { db, syncQueue, checkRealInternet } from '../../services/database';
import { uid } from '../../utils/helpers';
import { useUserLanguage } from '../context/UserLanguageContext';
import UserLanguageSelector from './UserLanguageSelector';
import LocationSelect from '../common/LocationSelect';

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
  
  // Validation errors (local to this component)
  const [errors, setErrors] = useState({
    name: '',
    password: '',
    phone: ''
  });

  // ===== VALIDATION FUNCTIONS =====
  const validateName = (name) => {
    if (!name.trim()) return userT('userManagement.nameRequired') || 'Full name is required';
    if (/[0-9]/.test(name)) return userT('userManagement.nameNoNumbers') || 'Full name must not contain numbers';
    return '';
  };

  const validatePassword = (password) => {
    if (!password || password.length < 6) return 'Password must be at least 6 characters';
    if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
    return '';
  };

  const validatePhone = (phone) => {
    const fullPhone = phone.trim();
    if (!fullPhone) return ''; // optional
    if (!/^\+2519\d{8}$/.test(fullPhone)) {
      return 'Phone must be in format +2519XXXXXXXX (8 digits after +2519)';
    }
    return '';
  };

  // ===== HANDLE FIELD CHANGES WITH REAL-TIME VALIDATION =====
  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewUser(prev => ({ ...prev, [name]: value }));

    if (name === 'name') {
      setErrors(prev => ({ ...prev, name: validateName(value) }));
    } else if (name === 'password') {
      setErrors(prev => ({ ...prev, password: validatePassword(value) }));
    } else if (name === 'phone') {
      setErrors(prev => ({ ...prev, phone: validatePhone(value) }));
    }
  };

  // ===== SUBMIT =====
  const onSubmit = async (e) => {
    e.preventDefault();

    // Final validation
    const nameError = validateName(newUser.name);
    const passwordError = validatePassword(newUser.password);
    const phoneError = validatePhone(newUser.phone);
    setErrors({ name: nameError, password: passwordError, phone: phoneError });

    if (nameError || passwordError || phoneError) {
      alert('Please fix the validation errors before submitting.');
      return;
    }

    const userExists = users.some(u => u.email === newUser.email);
    if (userExists) {
      alert(userT('userManagement.userExists'));
      return;
    }

    if (!newUser.name || !newUser.email || !newUser.password || !newUser.role) {
      alert(userT('userManagement.fillRequired'));
      return;
    }

    if (newUser.role === 'field_officer' && !selectedLocations.woreda) {
      alert('Please select a Woreda for Field Officers.');
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

  return (
    <div className="user-management" style={{padding: '0'}}>
      {/* ===== LANGUAGE SELECTOR ===== */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '20px'
      }}>
        <UserLanguageSelector />
      </div>

      {/* ===== CREATE USER FORM ===== */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <h3 style={{fontSize: '18px', fontWeight: '600', margin: 0}}>👤 {userT('userManagement.createUser')}</h3>
            <p style={{fontSize: '14px', color: '#64748b', margin: '4px 0 0 0'}}>{userT('userManagement.createUserSub')}</p>
          </div>
          <span style={{
            background: '#d1fae5',
            color: '#065f37',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            {userT('userManagement.totalUsers', { count: users.length })}
          </span>
        </div>

        <form onSubmit={onSubmit} noValidate>
          {/* Basic Info */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>
                {userT('userManagement.fullName')} *
              </label>
              <input 
                type="text" 
                name="name"
                value={newUser.name} 
                onChange={handleChange}
                placeholder={userT('userManagement.enterName')} 
                required
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${errors.name ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
              {errors.name && (
                <span style={{color: '#dc2626', fontSize: '12px', marginTop: '2px'}}>{errors.name}</span>
              )}
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.email')} *</label>
              <input 
                type="email" 
                name="email"
                value={newUser.email} 
                onChange={handleChange}
                placeholder={userT('userManagement.enterEmail')} 
                required
                style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
              />
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginTop: '16px'
          }}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>
                {userT('userManagement.password')} *
              </label>
              <input 
                type="password" 
                name="password"
                value={newUser.password} 
                onChange={handleChange}
                placeholder={userT('userManagement.enterPassword')} 
                required
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${errors.password ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
              {errors.password && (
                <span style={{color: '#dc2626', fontSize: '12px', marginTop: '2px'}}>{errors.password}</span>
              )}
              <small style={{color: '#64748b', fontSize: '11px'}}>Must contain at least one letter and one number</small>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.phone')}</label>
              <input 
                type="tel" 
                name="phone"
                value={newUser.phone} 
                onChange={handleChange}
                placeholder="+2519XXXXXXXX (8 digits after +2519)"
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${errors.phone ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
              {errors.phone && (
                <span style={{color: '#dc2626', fontSize: '12px', marginTop: '2px'}}>{errors.phone}</span>
              )}
              <small style={{color: '#64748b', fontSize: '11px'}}>Format: +2519XXXXXXXX (e.g., +251912345678)</small>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginTop: '16px'
          }}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.role')} *</label>
              <select 
                name="role"
                value={newUser.role} 
                onChange={handleChange}
                required
                style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
              >
                <option value="">{userT('userManagement.selectRole')}</option>
                <option value="field_officer">{userT('userManagement.fieldOfficer')}</option>
                <option value="supervisor">{userT('userManagement.supervisor')}</option>
              </select>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.shift')}</label>
              <select 
                name="shift"
                value={newUser.shift} 
                onChange={handleChange}
                style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
              >
                <option value="Day">{userT('userManagement.day')}</option>
                <option value="Night">{userT('userManagement.night')}</option>
                <option value="Flexible">{userT('userManagement.flexible')}</option>
              </select>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginTop: '16px'
          }}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.department')}</label>
              <input 
                type="text" 
                name="department"
                value={newUser.department} 
                onChange={handleChange}
                placeholder={userT('userManagement.enterDepartment')}
                style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
              />
            </div>
          </div>

          {/* ===== LOCATION HIERARCHY ===== */}
          <div style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <h4 style={{fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1e293b'}}>📍 Location</h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <LocationSelect
                level="country"
                parentId={null}
                selectedValue={selectedLocations.country}
                onSelect={onLocationSelect}
              />
              <LocationSelect
                level="region"
                parentId={selectedLocations.country}
                selectedValue={selectedLocations.region}
                onSelect={onLocationSelect}
                disabled={!selectedLocations.country}
              />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginTop: '12px'
            }}>
              <LocationSelect
                level="zone"
                parentId={selectedLocations.region}
                selectedValue={selectedLocations.zone}
                onSelect={onLocationSelect}
                disabled={!selectedLocations.region}
              />
              <LocationSelect
                level="woreda"
                parentId={selectedLocations.zone}
                selectedValue={selectedLocations.woreda}
                onSelect={onLocationSelect}
                disabled={!selectedLocations.zone}
                required={newUser.role === 'field_officer'}
              />
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginTop: '12px'
            }}>
              <LocationSelect
                level="kebele"
                parentId={selectedLocations.woreda}
                selectedValue={selectedLocations.kebele}
                onSelect={onLocationSelect}
                disabled={!selectedLocations.woreda}
              />
              <LocationSelect
                level="community"
                parentId={selectedLocations.kebele}
                selectedValue={selectedLocations.community}
                onSelect={onLocationSelect}
                disabled={!selectedLocations.kebele}
              />
            </div>
          </div>

          {/* ===== SUPERVISOR (filtered by woreda) ===== */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginTop: '16px'
          }}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.supervisor')}</label>
              <select 
                name="supervisorId"
                value={newUser.supervisorId || ''} 
                onChange={handleChange}
                disabled={!selectedLocations.woreda || loadingSupervisors}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: !selectedLocations.woreda ? '#f3f4f6' : 'white'
                }}
              >
                <option value="">{loadingSupervisors ? 'Loading...' : 'Select Supervisor (optional)'}</option>
                {woredaSupervisors.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.name} ({sup.employeeId})
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned Sites (for field officers) */}
            {newUser.role === 'field_officer' && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.assignedSites')}</label>
                <input 
                  type="text" 
                  name="assignedSites"
                  value={newUser.assignedSites || ''} 
                  onChange={handleChange}
                  placeholder={userT('userManagement.sitePlaceholder')}
                  style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                />
              </div>
            )}
          </div>

          <div style={{marginTop: '20px', display: 'flex', gap: '12px'}}>
            <button 
              type="submit" 
              disabled={isSubmitting}
              style={{
                background: '#0b7e4b',
                color: 'white',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '6px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: isSubmitting ? 0.7 : 1,
                visibility: 'visible',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isSubmitting ? userT('userManagement.creating') : userT('userManagement.create')}
            </button>
          </div>
        </form>
      </div>

      {/* ===== USERS TABLE (unchanged) ===== */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #e5e7eb',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h3 style={{fontSize: '16px', fontWeight: '600', margin: 0}}>{userT('userManagement.allUsers')}</h3>
            <p style={{fontSize: '13px', color: '#64748b', margin: '4px 0 0 0'}}>
              {userT('userManagement.totalUsers', { count: users.length })}
            </p>
          </div>
        </div>

        <div style={{overflowX: 'auto'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '14px'}}>
            <thead>
              <tr style={{background: '#f8fafc'}}>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>{userT('userManagement.employeeId')}</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>{userT('userManagement.name')}</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>{userT('userManagement.email')}</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>{userT('userManagement.role')}</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>{userT('userManagement.region')}</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>{userT('userManagement.shift')}</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>{userT('userManagement.status')}</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#374151', borderBottom: '2px solid #e5e7eb'}}>{userT('userManagement.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan="8" style={{textAlign: 'center', padding: '40px 20px', color: '#64748b'}}>
                    <div style={{fontSize: '48px', marginBottom: '8px'}}>👤</div>
                    <div>{userT('userManagement.noUsers')}</div>
                  </td>
                </tr>
              )}
              {users.map(u => (
                <tr key={u.id} style={{borderBottom: '1px solid #e5e7eb'}}>
                  <td style={{padding: '12px 16px'}}>{u.employeeId}</td>
                  <td style={{padding: '12px 16px', fontWeight: '600'}}>{u.name}</td>
                  <td style={{padding: '12px 16px'}}>{u.email}</td>
                  <td style={{padding: '12px 16px'}}>
                    <span style={{
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: u.role === 'manager' ? '#dbeafe' : u.role === 'supervisor' ? '#d1fae5' : '#fef3c7',
                      color: u.role === 'manager' ? '#1e40af' : u.role === 'supervisor' ? '#065f37' : '#92400e'
                    }}>
                      {u.role === 'field_officer' && userT('userManagement.fieldOfficer')}
                      {u.role === 'supervisor' && userT('userManagement.supervisor')}
                      {u.role === 'manager' && userT('userManagement.manager')}
                    </span>
                  </td>
                  <td style={{padding: '12px 16px'}}>{u.region}</td>
                  <td style={{padding: '12px 16px'}}>{u.shift || 'Day'}</td>
                  <td style={{padding: '12px 16px'}}>
                    <span style={{
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: u.status === 'active' ? '#d1fae5' : '#fee2e2',
                      color: u.status === 'active' ? '#065f37' : '#991b1b'
                    }}>
                      {u.status === 'active' ? userT('userManagement.active') : userT('userManagement.inactive')}
                    </span>
                  </td>
                  <td style={{padding: '12px 16px'}}>
                    <button 
                      onClick={() => toggleUserStatus(u.id)}
                      style={{
                        background: u.status === 'active' ? '#dc2626' : '#0b7e4b',
                        color: 'white',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        marginRight: '4px',
                        opacity: 1,
                        visibility: 'visible',
                        display: 'inline-flex'
                      }}
                    >
                      {u.status === 'active' ? userT('userManagement.deactivate') : userT('userManagement.activate')}
                    </button>
                    <button 
                      onClick={() => deleteUser(u.id)}
                      style={{
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        opacity: 1,
                        visibility: 'visible',
                        display: 'inline-flex'
                      }}
                    >
                      {userT('userManagement.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default UserManagement;