import React, { useState } from 'react';
import { db } from '../../services/database';
import { uid } from '../../utils/helpers';

function PermissionManagement({ 
  filteredPermissions,
  permissions,     
  setPermissions,  
  user, 
  isManager, 
  isSupervisor, 
  isOfficer, 
  teamMembers, 
  users, 
  addNotification,
  renderPermissions,
  renderPermissionRequestModal
}) {
  const [showModal, setShowModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState('requests');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPermission, setNewPermission] = useState({
    employeeId: '',
    permissionType: '',
    startDate: '',
    endDate: '',
    reason: ''
  });

  // ========== FILTER PERMISSIONS BASED ON ROLE ==========
  const getFilteredPermissions = () => {
    if (!permissions) return [];
    
    // SUPERVISOR: Sees their OWN permissions + their TEAM's permissions (for approval)
    if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      return permissions.filter(p => 
        p.employeeId === user.employeeId || teamIds.includes(p.employeeId)
      );
    }
    
    // OFFICER: ONLY their own permissions
    if (isOfficer && user) {
      return permissions.filter(p => p.employeeId === user.employeeId);
    }
    
    // MANAGER: All permissions
    return permissions;
  };

  const filtered = getFilteredPermissions();
  const pendingPermissions = filtered.filter(p => p.status === 'pending');
  const approvedPermissions = filtered.filter(p => p.status === 'approved');
  const rejectedPermissions = filtered.filter(p => p.status === 'rejected');

  // ========== HANDLE REQUEST PERMISSION ==========
  const handleRequestPermission = async (e) => {
    e.preventDefault();
    
    if (!newPermission.permissionType || !newPermission.startDate || !newPermission.endDate || !newPermission.reason) {
      alert('Please fill all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const permission = {
        id: uid(),
        employeeId: (isOfficer || isSupervisor) ? user.employeeId : newPermission.employeeId,
        employeeName: (isOfficer || isSupervisor) ? user.name : users?.find(u => u.employeeId === newPermission.employeeId)?.name || user.name,
        permissionType: newPermission.permissionType,
        startDate: newPermission.startDate,
        endDate: newPermission.endDate,
        reason: newPermission.reason,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        approvedBy: null,
        approvedAt: null
      };

      await db.permissions.add(permission);
      
      if (setPermissions && typeof setPermissions === 'function') {
        const updated = [permission, ...permissions];
        setPermissions(updated);
      } else {
        const allPermissions = await db.permissions.toArray();
        if (setPermissions) setPermissions(allPermissions);
      }
      
      if (addNotification) {
        addNotification(user.id, '📋 Permission Request', `Permission request for ${newPermission.permissionType} submitted`, 'info');
      }
      
      setShowModal(false);
      setNewPermission({ employeeId: '', permissionType: '', startDate: '', endDate: '', reason: '' });
      alert('✅ Permission request submitted successfully!');
    } catch (error) {
      console.error('Error submitting permission:', error);
      alert('❌ Error submitting permission request: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ========== APPROVE PERMISSION ==========
  const approvePermission = async (permissionId, approve) => {
    try {
      const permission = permissions?.find(p => p.id === permissionId);
      if (!permission) {
        alert('Permission request not found');
        return;
      }

      // APPROVAL RULES
      if (isSupervisor) {
        if (permission.employeeId === user.employeeId) {
          alert('❌ You cannot approve your own permission request. Please wait for Manager approval.');
          return;
        }
        const teamIds = teamMembers.map(m => m.employeeId);
        if (!teamIds.includes(permission.employeeId)) {
          alert('❌ You can only approve permission requests from your team members.');
          return;
        }
      }

      if (isOfficer) {
        alert('❌ You do not have permission to approve permission requests.');
        return;
      }

      const updatedPermission = {
        ...permission,
        status: approve ? 'approved' : 'rejected',
        approvedBy: user.employeeId,
        approvedAt: new Date().toISOString()
      };

      await db.permissions.update(permissionId, updatedPermission);
      
      if (setPermissions && typeof setPermissions === 'function') {
        const updated = permissions.map(p => 
          p.id === permissionId ? updatedPermission : p
        );
        setPermissions(updated);
      }
      
      const officer = users?.find(u => u.employeeId === permission.employeeId);
      if (officer && addNotification) {
        addNotification(
          officer.id, 
          'Permission Request Update', 
          `Your permission request has been ${approve ? 'approved ✅' : 'rejected ❌'} by ${user.name}`, 
          approve ? 'success' : 'error'
        );
      }
      
      alert(`✅ Permission ${approve ? 'approved' : 'rejected'} successfully!`);
    } catch (error) {
      console.error('Error updating permission:', error);
      alert('❌ Error updating permission: ' + error.message);
    }
  };

  const getDisplayPermissions = () => {
    if (selectedTab === 'pending') return pendingPermissions;
    if (selectedTab === 'approved') return approvedPermissions;
    if (selectedTab === 'rejected') return rejectedPermissions;
    return filtered;
  };

  // ========== MODAL ==========
  const renderModal = () => {
    return (
      <div className="modal-overlay" onClick={() => setShowModal(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '640px',
          width: '95%',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}>
          <div className="modal-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
            <h3 style={{fontSize: '20px', fontWeight: '600'}}>Request Permission</h3>
            <button className="modal-close" onClick={() => setShowModal(false)} style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#64748b'
            }}>✕</button>
          </div>
          <form onSubmit={handleRequestPermission} className="modal-form" style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            {isManager && (
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Employee *</label>
                <select 
                  value={newPermission.employeeId} 
                  onChange={e => setNewPermission({...newPermission, employeeId: e.target.value})}
                  required
                  style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                >
                  <option value="">Select Employee</option>
                  {users?.map(u => (
                    <option key={u.id} value={u.employeeId}>{u.name}</option>
                  ))}
                </select>
              </div>
            )}
            {(isSupervisor || isOfficer) && (
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Employee</label>
                <input 
                  type="text" 
                  value={user?.name || ''} 
                  readOnly 
                  style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: '#f3f4f6'}}
                />
              </div>
            )}
            <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Permission Type *</label>
              <select 
                value={newPermission.permissionType} 
                onChange={e => setNewPermission({...newPermission, permissionType: e.target.value})}
                required
                style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
              >
                <option value="">Select Type</option>
                <option value="Work Permission">Work Permission</option>
                <option value="Personal Permission">Personal Permission</option>
                <option value="Medical Permission">Medical Permission</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Start Date *</label>
                <input type="date" value={newPermission.startDate} onChange={e => setNewPermission({...newPermission, startDate: e.target.value})} required style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}} />
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>End Date *</label>
                <input type="date" value={newPermission.endDate} onChange={e => setNewPermission({...newPermission, endDate: e.target.value})} required style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}} />
              </div>
            </div>
            <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Reason *</label>
              <textarea value={newPermission.reason} onChange={e => setNewPermission({...newPermission, reason: e.target.value})} placeholder="Enter reason for permission" rows="3" required style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', resize: 'vertical', minHeight: '60px'}} />
            </div>
            <div className="modal-actions" style={{display: 'flex', gap: '12px', marginTop: '8px'}}>
              <button type="submit" className="btn-submit" disabled={isSubmitting} style={{
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
                display: 'inline-flex'
              }}>
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
              <button type="button" className="btn-cancel" onClick={() => setShowModal(false)} style={{
                background: '#e5e7eb',
                color: '#374151',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: 1,
                visibility: 'visible',
                display: 'inline-flex'
              }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ========== SUPERVISOR VIEW ==========
  const renderSupervisorView = () => {
    const teamIds = teamMembers.map(m => m.employeeId);
    const teamPendingPermissions = pendingPermissions.filter(p => teamIds.includes(p.employeeId));
    const ownPendingPermissions = pendingPermissions.filter(p => p.employeeId === user.employeeId);

    return (
      <div className="permissions-view">
        <div className="form-card">
          <div className="form-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
            <div>
              <h3>📋 Permission Management</h3>
              <p>Your permissions + Team permissions (approve team members)</p>
            </div>
            <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
              <span className="form-badge" style={{background: '#fef3c7', color: '#92400e'}}>{pendingPermissions.length} Pending</span>
              <button onClick={() => setShowModal(true)} style={{background: '#1e3a5f', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: 1, visibility: 'visible'}}>📋 Request Permission</button>
            </div>
          </div>

          <div style={{background: '#e0f2fe', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
            <span>👤 <strong>Your pending:</strong> {ownPendingPermissions.length}</span>
            <span>👥 <strong>Team pending:</strong> {teamPendingPermissions.length}</span>
            <span style={{color: '#0369a1', fontSize: '13px'}}>ℹ️ You can approve team members' permissions, but not your own</span>
          </div>

          <div style={{display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap'}}>
            <button onClick={() => setSelectedTab('requests')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'requests' ? '#1e3a5f' : '#f3f4f6', color: selectedTab === 'requests' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'requests' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>All ({filtered.length})</button>
            <button onClick={() => setSelectedTab('pending')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'pending' ? '#d97706' : '#f3f4f6', color: selectedTab === 'pending' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'pending' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>⏳ Pending ({pendingPermissions.length})</button>
            <button onClick={() => setSelectedTab('approved')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'approved' ? '#0b7e4b' : '#f3f4f6', color: selectedTab === 'approved' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'approved' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>✅ Approved ({approvedPermissions.length})</button>
            <button onClick={() => setSelectedTab('rejected')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'rejected' ? '#dc2626' : '#f3f4f6', color: selectedTab === 'rejected' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'rejected' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>❌ Rejected ({rejectedPermissions.length})</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead><tr><th>Employee</th><th>Permission Type</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {getDisplayPermissions().length === 0 && (<tr><td colSpan="7" className="empty-state"><div className="empty-icon">📋</div><div>No permission requests found</div></td></tr>)}
                {getDisplayPermissions().map(p => {
                  const isOwnPermission = p.employeeId === user.employeeId;
                  const isTeamMember = teamIds.includes(p.employeeId);
                  const canApprove = isTeamMember && !isOwnPermission;
                  return (
                    <tr key={p.id}>
                      <td><strong>{p.employeeName}</strong>{isOwnPermission && <span style={{fontSize: '11px', color: '#6b7f94', marginLeft: '6px'}}>(You)</span>}{isTeamMember && !isOwnPermission && <span style={{fontSize: '11px', color: '#0369a1', marginLeft: '6px'}}>(Team)</span>}</td>
                      <td>{p.permissionType}</td>
                      <td>{p.startDate}</td>
                      <td>{p.endDate}</td>
                      <td>{p.reason}</td>
                      <td><span style={{padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: p.status === 'pending' ? '#fef3c7' : p.status === 'approved' ? '#d1fae5' : '#fee2e2', color: p.status === 'pending' ? '#92400e' : p.status === 'approved' ? '#065f37' : '#991b1b'}}>{p.status}</span></td>
                      <td>
                        {p.status === 'pending' && (
                          canApprove ? (
                            <>
                              <button onClick={() => approvePermission(p.id, true)} style={{background: '#0b7e4b', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '4px', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>✅ Approve</button>
                              <button onClick={() => approvePermission(p.id, false)} style={{background: '#dc2626', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>❌ Reject</button>
                            </>
                          ) : isOwnPermission ? <span style={{fontSize: '12px', color: '#6b7f94'}}>⏳ Wait for Manager</span> : <span style={{fontSize: '12px', color: '#6b7f94'}}>—</span>
                        )}
                        {p.status !== 'pending' && <span style={{fontSize: '12px', color: '#6b7f94'}}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && renderModal()}
      </div>
    );
  };

  // ========== OFFICER VIEW ==========
  const renderOfficerView = () => {
    return (
      <div className="permissions-view">
        <div className="form-card">
          <div className="form-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
            <div>
              <h3>📋 My Permission Requests</h3>
              <p>View and manage your own permission requests</p>
            </div>
            <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
              <span className="form-badge" style={{background: '#fef3c7', color: '#92400e'}}>{pendingPermissions.length} Pending</span>
              <button onClick={() => setShowModal(true)} style={{background: '#1e3a5f', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: 1, visibility: 'visible'}}>📋 Request Permission</button>
            </div>
          </div>

          <div style={{display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap'}}>
            <button onClick={() => setSelectedTab('requests')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'requests' ? '#1e3a5f' : '#f3f4f6', color: selectedTab === 'requests' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'requests' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>All ({filtered.length})</button>
            <button onClick={() => setSelectedTab('pending')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'pending' ? '#d97706' : '#f3f4f6', color: selectedTab === 'pending' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'pending' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>⏳ Pending ({pendingPermissions.length})</button>
            <button onClick={() => setSelectedTab('approved')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'approved' ? '#0b7e4b' : '#f3f4f6', color: selectedTab === 'approved' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'approved' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>✅ Approved ({approvedPermissions.length})</button>
            <button onClick={() => setSelectedTab('rejected')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'rejected' ? '#dc2626' : '#f3f4f6', color: selectedTab === 'rejected' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'rejected' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>❌ Rejected ({rejectedPermissions.length})</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead><tr><th>Employee</th><th>Permission Type</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>
                {getDisplayPermissions().length === 0 && (<tr><td colSpan="6" className="empty-state"><div className="empty-icon">📋</div><div>No permission requests found</div></td></tr>)}
                {getDisplayPermissions().map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.employeeName}</strong></td>
                    <td>{p.permissionType}</td>
                    <td>{p.startDate}</td>
                    <td>{p.endDate}</td>
                    <td>{p.reason}</td>
                    <td><span style={{padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: p.status === 'pending' ? '#fef3c7' : p.status === 'approved' ? '#d1fae5' : '#fee2e2', color: p.status === 'pending' ? '#92400e' : p.status === 'approved' ? '#065f37' : '#991b1b'}}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {showModal && renderModal()}
      </div>
    );
  };

  // ========== MANAGER VIEW ==========
  const renderManagerView = () => {
    return (
      <div className="permissions-view">
        <div className="form-card">
          <div className="form-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
            <div>
              <h3>📋 Permission Management</h3>
              <p>Manage all permission requests</p>
            </div>
            <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
              <span className="form-badge" style={{background: '#fef3c7', color: '#92400e'}}>{pendingPermissions.length} Pending</span>
              {/* ✅ REMOVED: Request Permission button for Manager - Manager only approves/rejects */}
            </div>
          </div>

          <div style={{display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap'}}>
            <button onClick={() => setSelectedTab('requests')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'requests' ? '#1e3a5f' : '#f3f4f6', color: selectedTab === 'requests' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'requests' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>All ({filtered.length})</button>
            <button onClick={() => setSelectedTab('pending')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'pending' ? '#d97706' : '#f3f4f6', color: selectedTab === 'pending' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'pending' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>⏳ Pending ({pendingPermissions.length})</button>
            <button onClick={() => setSelectedTab('approved')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'approved' ? '#0b7e4b' : '#f3f4f6', color: selectedTab === 'approved' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'approved' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>✅ Approved ({approvedPermissions.length})</button>
            <button onClick={() => setSelectedTab('rejected')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'rejected' ? '#dc2626' : '#f3f4f6', color: selectedTab === 'rejected' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'rejected' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>❌ Rejected ({rejectedPermissions.length})</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead><tr><th>Employee</th><th>Permission Type</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {getDisplayPermissions().length === 0 && (<tr><td colSpan="7" className="empty-state"><div className="empty-icon">📋</div><div>No permission requests found</div></td></tr>)}
                {getDisplayPermissions().map(p => (
                  <tr key={p.id}>
                    <td><strong>{p.employeeName}</strong></td>
                    <td>{p.permissionType}</td>
                    <td>{p.startDate}</td>
                    <td>{p.endDate}</td>
                    <td>{p.reason}</td>
                    <td><span style={{padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: p.status === 'pending' ? '#fef3c7' : p.status === 'approved' ? '#d1fae5' : '#fee2e2', color: p.status === 'pending' ? '#92400e' : p.status === 'approved' ? '#065f37' : '#991b1b'}}>{p.status}</span></td>
                    <td>
                      {p.status === 'pending' && (
                        <>
                          <button onClick={() => approvePermission(p.id, true)} style={{background: '#0b7e4b', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '4px', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>✅ Approve</button>
                          <button onClick={() => approvePermission(p.id, false)} style={{background: '#dc2626', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>❌ Reject</button>
                        </>
                      )}
                      {p.status !== 'pending' && <span style={{fontSize: '12px', color: '#6b7f94'}}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {/* ✅ Modal removed for Manager - Manager does not request permission */}
      </div>
    );
  };

  // ========== MAIN RENDER ==========
  if (isSupervisor) return renderSupervisorView();
  if (isOfficer) return renderOfficerView();
  if (isManager) return renderManagerView();
  return <div className="permissions-view"><div className="form-card"><p>Loading...</p></div></div>;
}

export default PermissionManagement;