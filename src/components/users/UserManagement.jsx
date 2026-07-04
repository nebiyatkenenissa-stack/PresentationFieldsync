import React, { useState } from 'react';
import { db } from '../../services/database';
import { uid } from '../../utils/helpers';
import { useUserLanguage } from '../context/UserLanguageContext';
import UserLanguageSelector from './UserLanguageSelector';

function UserManagement({ 
  users, 
  setUsers, 
  newUser, 
  setNewUser, 
  handleCreateUser, 
  toggleUserStatus, 
  deleteUser,
  addNotification 
}) {
  const { userT } = useUserLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localNewUser, setLocalNewUser] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: '',
    region: '',
    supervisorId: '',
    assignedSites: '',
    shift: 'Day',
    department: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const userExists = users.some(u => u.email === localNewUser.email);
      if (userExists) {
        alert(userT('userManagement.userExists'));
        setIsSubmitting(false);
        return;
      }

      if (!localNewUser.name || !localNewUser.email || !localNewUser.password || !localNewUser.role || !localNewUser.region) {
        alert(userT('userManagement.fillRequired'));
        setIsSubmitting(false);
        return;
      }

      const newUserObj = {
        id: uid(),
        employeeId: localNewUser.role === 'supervisor'
          ? `SUP${String(users.filter(u => u.role === 'supervisor').length + 1).padStart(3, '0')}`
          : `FO${String(users.filter(u => u.role === 'field_officer').length + 1).padStart(3, '0')}`,
        name: localNewUser.name,
        email: localNewUser.email,
        password: localNewUser.password,
        phone: localNewUser.phone || '',
        role: localNewUser.role,
        region: localNewUser.region,
        supervisorId: localNewUser.role === 'field_officer' ? localNewUser.supervisorId : null,
        assignedSites: localNewUser.role === 'field_officer' ? localNewUser.assignedSites.split(',').map(s => s.trim()).filter(s => s) : [],
        status: 'active',
        managerId: 'm1',
        shift: localNewUser.shift || 'Day',
        department: localNewUser.department || '',
        createdAt: new Date().toISOString()
      };

      await db.users.add(newUserObj);
      setUsers([...users, newUserObj]);
      
      if (addNotification) {
        addNotification(newUserObj.id, 'Account Created', `Welcome ${newUserObj.name}! Your account has been created.`, 'success');
      }
      
      alert(userT('userManagement.createSuccess', { name: newUserObj.name }));

      setLocalNewUser({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: '',
        region: '',
        supervisorId: '',
        assignedSites: '',
        shift: 'Day',
        department: ''
      });
    } catch (error) {
      console.error('Error creating user:', error);
      alert(userT('userManagement.createError', { error: error.message }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="user-management" style={{padding: '0'}}>
      {/* Language Selector */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginBottom: '20px'
      }}>
        <UserLanguageSelector />
      </div>

      {/* Create User Form */}
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

        <form onSubmit={handleSubmit}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.fullName')}</label>
              <input 
                type="text" 
                value={localNewUser.name} 
                onChange={e => setLocalNewUser({...localNewUser, name: e.target.value})}
                placeholder={userT('userManagement.enterName')} 
                required
                style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
              />
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.email')}</label>
              <input 
                type="email" 
                value={localNewUser.email} 
                onChange={e => setLocalNewUser({...localNewUser, email: e.target.value})}
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
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.password')}</label>
              <input 
                type="password" 
                value={localNewUser.password} 
                onChange={e => setLocalNewUser({...localNewUser, password: e.target.value})}
                placeholder={userT('userManagement.enterPassword')} 
                required
                style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
              />
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.phone')}</label>
              <input 
                type="tel" 
                value={localNewUser.phone} 
                onChange={e => setLocalNewUser({...localNewUser, phone: e.target.value})}
                placeholder={userT('userManagement.enterPhone')}
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
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.role')}</label>
              <select 
                value={localNewUser.role} 
                onChange={e => setLocalNewUser({...localNewUser, role: e.target.value})}
                required
                style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
              >
                <option value="">{userT('userManagement.selectRole')}</option>
                <option value="field_officer">{userT('userManagement.fieldOfficer')}</option>
                <option value="supervisor">{userT('userManagement.supervisor')}</option>
              </select>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.region')}</label>
              <select 
                value={localNewUser.region} 
                onChange={e => setLocalNewUser({...localNewUser, region: e.target.value})}
                required
                style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
              >
                <option value="">{userT('userManagement.selectRegion')}</option>
                <option value="North">{userT('userManagement.north')}</option>
                <option value="South">{userT('userManagement.south')}</option>
                <option value="East">{userT('userManagement.east')}</option>
                <option value="West">{userT('userManagement.west')}</option>
                <option value="Central">{userT('userManagement.central')}</option>
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
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.shift')}</label>
              <select 
                value={localNewUser.shift} 
                onChange={e => setLocalNewUser({...localNewUser, shift: e.target.value})}
                style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
              >
                <option value="Day">{userT('userManagement.day')}</option>
                <option value="Night">{userT('userManagement.night')}</option>
                <option value="Flexible">{userT('userManagement.flexible')}</option>
              </select>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.department')}</label>
              <input 
                type="text" 
                value={localNewUser.department} 
                onChange={e => setLocalNewUser({...localNewUser, department: e.target.value})}
                placeholder={userT('userManagement.department')}
                style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
              />
            </div>
          </div>

          {localNewUser.role === 'field_officer' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginTop: '16px'
            }}>
              <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.supervisor')}</label>
                <select 
                  value={localNewUser.supervisorId} 
                  onChange={e => setLocalNewUser({...localNewUser, supervisorId: e.target.value})}
                  style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                >
                  <option value="">{userT('userManagement.selectSupervisor')}</option>
                  {users.filter(u => u.role === 'supervisor').map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.region})</option>
                  ))}
                </select>
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>{userT('userManagement.assignedSites')}</label>
                <input 
                  type="text" 
                  value={localNewUser.assignedSites} 
                  onChange={e => setLocalNewUser({...localNewUser, assignedSites: e.target.value})}
                  placeholder={userT('userManagement.sitePlaceholder')}
                  style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                />
              </div>
            </div>
          )}

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
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: 1,
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

      {/* Users Table */}
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
            <p style={{fontSize: '13px', color: '#64748b', margin: '4px 0 0 0'}}>{userT('userManagement.totalUsers', { count: users.length })}</p>
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