import React, { useState } from 'react';
import { db } from '../../services/database';
import { uid } from '../../utils/helpers';
import { syncQueue } from '../../services/database';

function LeaveManagement({ 
  filteredLeaves,
  leaves,          
  setLeaves,       
  user, 
  isManager, 
  isSupervisor, 
  isOfficer, 
  teamMembers, 
  users, 
  addNotification,
  renderLeaves,
  renderLeaveModal
}) {
  const [showModal, setShowModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState('requests');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newLeave, setNewLeave] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    reason: '',
    type: 'annual'
  });

  const getFilteredLeaves = () => {
    if (!leaves) return [];
    
    if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      return leaves.filter(l => 
        l.employeeId === user.employeeId || teamIds.includes(l.employeeId)
      );
    }
    
    if (isOfficer && user) {
      return leaves.filter(l => l.employeeId === user.employeeId);
    }
    
    return leaves;
  };

  const filtered = getFilteredLeaves();
  const pendingLeaves = filtered.filter(l => l.status === 'pending');
  const approvedLeaves = filtered.filter(l => l.status === 'approved');
  const rejectedLeaves = filtered.filter(l => l.status === 'rejected');

  const handleRequestLeave = async (e) => {
    e.preventDefault();
    
    if (!newLeave.startDate || !newLeave.endDate || !newLeave.reason) {
      alert('Please fill all required fields');
      return;
    }

    const online = navigator.onLine;
    setIsSubmitting(true);

    try {
      const leave = {
        id: uid(),
        employeeId: (isOfficer || isSupervisor) ? user.employeeId : newLeave.employeeId,
        employeeName: (isOfficer || isSupervisor) ? user.name : users?.find(u => u.employeeId === newLeave.employeeId)?.name || user.name,
        startDate: newLeave.startDate,
        endDate: newLeave.endDate,
        reason: newLeave.reason,
        type: newLeave.type,
        status: 'pending',
        createdAt: new Date().toISOString(),
        approvedBy: null,
        approvedAt: null,
        synced: online ? true : false
      };

      await db.leaves.add(leave);
      
      if (setLeaves && typeof setLeaves === 'function') {
        const updated = [leave, ...leaves];
        setLeaves(updated);
      }
      
      if (!online) {
        syncQueue.add({
          type: 'leave_request',
          id: leave.id,
          data: leave
        });
        alert('📅 Leave request saved offline! Will sync when online.');
      } else {
        if (addNotification) {
          addNotification(user.id, '📅 Leave Request', `Leave request submitted from ${leave.startDate} to ${leave.endDate}`, 'info');
        }
        alert('✅ Leave request submitted successfully!');
      }
      
      setShowModal(false);
      setNewLeave({ employeeId: '', startDate: '', endDate: '', reason: '', type: 'annual' });
    } catch (error) {
      console.error('Error submitting leave:', error);
      alert('❌ Error submitting leave request: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const approveLeave = async (leaveId, approve) => {
    try {
      const leave = leaves?.find(l => l.id === leaveId);
      if (!leave) {
        alert('Leave request not found');
        return;
      }

      if (isSupervisor) {
        if (leave.employeeId === user.employeeId) {
          alert('❌ You cannot approve your own leave request. Please wait for Manager approval.');
          return;
        }
        const teamIds = teamMembers.map(m => m.employeeId);
        if (!teamIds.includes(leave.employeeId)) {
          alert('❌ You can only approve leave requests from your team members.');
          return;
        }
      }

      if (isOfficer) {
        alert('❌ You do not have permission to approve leave requests.');
        return;
      }

      const online = navigator.onLine;
      const status = approve ? 'approved' : 'rejected';

      const updatedLeave = {
        ...leave,
        status,
        approvedBy: user.employeeId,
        approvedAt: new Date().toISOString(),
        synced: online ? true : false
      };

      await db.leaves.update(leaveId, updatedLeave);
      
      if (setLeaves && typeof setLeaves === 'function') {
        const updated = leaves.map(l => 
          l.id === leaveId ? updatedLeave : l
        );
        setLeaves(updated);
      }
      
      if (!online) {
        syncQueue.add({
          type: 'leave_update',
          id: leaveId,
          data: { leaveId, status }
        });
        alert(`📋 Leave ${approve ? 'approved' : 'rejected'} offline! Will sync when online.`);
      } else {
        const officer = users?.find(u => u.employeeId === leave.employeeId);
        if (officer && addNotification) {
          addNotification(
            officer.id, 
            'Leave Request Update', 
            `Your leave request has been ${approve ? 'approved ✅' : 'rejected ❌'} by ${user.name}`, 
            approve ? 'success' : 'error'
          );
        }
        alert(`✅ Leave ${approve ? 'approved' : 'rejected'} successfully!`);
      }
    } catch (error) {
      console.error('Error updating leave:', error);
      alert('❌ Error updating leave: ' + error.message);
    }
  };

  const getDisplayLeaves = () => {
    if (selectedTab === 'pending') return pendingLeaves;
    if (selectedTab === 'approved') return approvedLeaves;
    if (selectedTab === 'rejected') return rejectedLeaves;
    return filtered;
  };

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
            <h3 style={{fontSize: '20px', fontWeight: '600'}}>
              Request Leave
              {!navigator.onLine && <span style={{fontSize: '12px', color: '#f59e0b', marginLeft: '8px'}}>📡 Offline</span>}
            </h3>
            <button className="modal-close" onClick={() => setShowModal(false)} style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#64748b'
            }}>✕</button>
          </div>
          <form onSubmit={handleRequestLeave} className="modal-form" style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            {isManager && (
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Employee *</label>
                <select 
                  value={newLeave.employeeId} 
                  onChange={e => setNewLeave({...newLeave, employeeId: e.target.value})}
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
            <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Start Date *</label>
                <input type="date" value={newLeave.startDate} onChange={e => setNewLeave({...newLeave, startDate: e.target.value})} required style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}} />
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>End Date *</label>
                <input type="date" value={newLeave.endDate} onChange={e => setNewLeave({...newLeave, endDate: e.target.value})} required style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}} />
              </div>
            </div>
            <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Leave Type</label>
              <select value={newLeave.type} onChange={e => setNewLeave({...newLeave, type: e.target.value})} style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}>
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="personal">Personal</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
              <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Reason *</label>
              <textarea value={newLeave.reason} onChange={e => setNewLeave({...newLeave, reason: e.target.value})} placeholder="Enter reason for leave" rows="3" required style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', resize: 'vertical', minHeight: '60px'}} />
            </div>
            <div style={{
              padding: '12px',
              background: !navigator.onLine ? '#fef3c7' : '#dbeafe',
              borderRadius: '8px',
              fontSize: '13px',
              color: !navigator.onLine ? '#92400e' : '#1e40af'
            }}>
              <strong>ℹ️ {navigator.onLine ? 'Online' : 'Offline'}:</strong>
              {navigator.onLine 
                ? ' Your leave request will be sent immediately.' 
                : ' Your leave request will be saved offline and synced when online.'}
            </div>
            <div className="modal-actions" style={{display: 'flex', gap: '12px', marginTop: '8px'}}>
              <button type="submit" className="btn-submit" disabled={isSubmitting} style={{
                background: navigator.onLine ? '#0b7e4b' : '#f59e0b',
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
                {isSubmitting ? 'Submitting...' : navigator.onLine ? 'Submit Request' : '💾 Save Offline'}
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

  const renderSupervisorView = () => {
    const teamIds = teamMembers.map(m => m.employeeId);
    const teamPendingLeaves = pendingLeaves.filter(l => teamIds.includes(l.employeeId));
    const ownPendingLeaves = pendingLeaves.filter(l => l.employeeId === user.employeeId);

    return (
      <div className="leaves-view">
        {!navigator.onLine && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            📡 You are offline. Leave actions will be saved and synced when online.
          </div>
        )}

        <div className="form-card">
          <div className="form-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
            <div>
              <h3>📅 Leave Management</h3>
              <p>Your leaves + Team leaves (approve team members)</p>
            </div>
            <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
              <span className="form-badge" style={{background: '#fef3c7', color: '#92400e'}}>
                {pendingLeaves.length} Pending
              </span>
              <button 
                className="btn-primary" 
                onClick={() => setShowModal(true)}
                style={{
                  background: '#1e3a5f',
                  color: 'white',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: 1,
                  visibility: 'visible'
                }}
              >
                📋 Request Leave
              </button>
            </div>
          </div>

          <div style={{
            background: '#e0f2fe',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <span>👤 <strong>Your pending:</strong> {ownPendingLeaves.length}</span>
            <span>👥 <strong>Team pending:</strong> {teamPendingLeaves.length}</span>
            <span style={{color: '#0369a1', fontSize: '13px'}}>ℹ️ You can approve team members' leaves, but not your own</span>
          </div>

          <div style={{display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap'}}>
            <button onClick={() => setSelectedTab('requests')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'requests' ? '#1e3a5f' : '#f3f4f6', color: selectedTab === 'requests' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'requests' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>All ({filtered.length})</button>
            <button onClick={() => setSelectedTab('pending')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'pending' ? '#d97706' : '#f3f4f6', color: selectedTab === 'pending' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'pending' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>⏳ Pending ({pendingLeaves.length})</button>
            <button onClick={() => setSelectedTab('approved')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'approved' ? '#0b7e4b' : '#f3f4f6', color: selectedTab === 'approved' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'approved' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>✅ Approved ({approvedLeaves.length})</button>
            <button onClick={() => setSelectedTab('rejected')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'rejected' ? '#dc2626' : '#f3f4f6', color: selectedTab === 'rejected' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'rejected' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>❌ Rejected ({rejectedLeaves.length})</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {getDisplayLeaves().length === 0 && (<tr><td colSpan="7" className="empty-state"><div className="empty-icon">📋</div><div>No leave requests found</div></td></tr>)}
                {getDisplayLeaves().map(l => {
                  const isOwnLeave = l.employeeId === user.employeeId;
                  const isTeamMember = teamIds.includes(l.employeeId);
                  const canApprove = isTeamMember && !isOwnLeave;
                  return (
                    <tr key={l.id}>
                      <td><strong>{l.employeeName}</strong>{isOwnLeave && <span style={{fontSize: '11px', color: '#6b7f94', marginLeft: '6px'}}>(You)</span>}{isTeamMember && !isOwnLeave && <span style={{fontSize: '11px', color: '#0369a1', marginLeft: '6px'}}>(Team)</span>}</td>
                      <td><span style={{textTransform: 'capitalize'}}>{l.type}</span></td>
                      <td>{l.startDate}</td>
                      <td>{l.endDate}</td>
                      <td>{l.reason}</td>
                      <td>
                        <span style={{padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: l.status === 'pending' ? '#fef3c7' : l.status === 'approved' ? '#d1fae5' : '#fee2e2', color: l.status === 'pending' ? '#92400e' : l.status === 'approved' ? '#065f37' : '#991b1b'}}>
                          {l.status}
                          {!l.synced && l.status !== 'pending' && <span style={{fontSize: '10px', color: '#f59e0b', marginLeft: '4px'}}>📡</span>}
                        </span>
                      </td>
                      <td>
                        {l.status === 'pending' && (
                          canApprove ? (
                            <>
                              <button onClick={() => approveLeave(l.id, true)} style={{background: '#0b7e4b', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '4px', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>✅ Approve</button>
                              <button onClick={() => approveLeave(l.id, false)} style={{background: '#dc2626', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>❌ Reject</button>
                            </>
                          ) : isOwnLeave ? <span style={{fontSize: '12px', color: '#6b7f94'}}>⏳ Wait for Manager</span> : <span style={{fontSize: '12px', color: '#6b7f94'}}>—</span>
                        )}
                        {l.status !== 'pending' && <span style={{fontSize: '12px', color: '#6b7f94'}}>—</span>}
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

  const renderOfficerView = () => {
    return (
      <div className="leaves-view">
        {!navigator.onLine && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            📡 You are offline. Leave requests will be saved and synced when online.
          </div>
        )}

        <div className="form-card">
          <div className="form-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
            <div>
              <h3>📅 My Leave Requests</h3>
              <p>View and manage your own leave requests</p>
            </div>
            <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
              <span className="form-badge" style={{background: '#fef3c7', color: '#92400e'}}>{pendingLeaves.length} Pending</span>
              <button onClick={() => setShowModal(true)} style={{background: '#1e3a5f', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: 1, visibility: 'visible'}}>📋 Request Leave</button>
            </div>
          </div>

          <div style={{display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap'}}>
            <button onClick={() => setSelectedTab('requests')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'requests' ? '#1e3a5f' : '#f3f4f6', color: selectedTab === 'requests' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'requests' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>All ({filtered.length})</button>
            <button onClick={() => setSelectedTab('pending')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'pending' ? '#d97706' : '#f3f4f6', color: selectedTab === 'pending' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'pending' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>⏳ Pending ({pendingLeaves.length})</button>
            <button onClick={() => setSelectedTab('approved')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'approved' ? '#0b7e4b' : '#f3f4f6', color: selectedTab === 'approved' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'approved' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>✅ Approved ({approvedLeaves.length})</button>
            <button onClick={() => setSelectedTab('rejected')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'rejected' ? '#dc2626' : '#f3f4f6', color: selectedTab === 'rejected' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'rejected' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>❌ Rejected ({rejectedLeaves.length})</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>
                {getDisplayLeaves().length === 0 && (<tr><td colSpan="6" className="empty-state"><div className="empty-icon">📋</div><div>No leave requests found</div></td></tr>)}
                {getDisplayLeaves().map(l => (
                  <tr key={l.id}>
                    <td><strong>{l.employeeName}</strong></td>
                    <td><span style={{textTransform: 'capitalize'}}>{l.type}</span></td>
                    <td>{l.startDate}</td>
                    <td>{l.endDate}</td>
                    <td>{l.reason}</td>
                    <td>
                      <span style={{padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: l.status === 'pending' ? '#fef3c7' : l.status === 'approved' ? '#d1fae5' : '#fee2e2', color: l.status === 'pending' ? '#92400e' : l.status === 'approved' ? '#065f37' : '#991b1b'}}>
                        {l.status}
                        {!l.synced && l.status !== 'pending' && <span style={{fontSize: '10px', color: '#f59e0b', marginLeft: '4px'}}>📡</span>}
                      </span>
                    </td>
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

  const renderManagerView = () => {
    return (
      <div className="leaves-view">
        {!navigator.onLine && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            📡 You are offline. Approvals will be saved and synced when online.
          </div>
        )}

        <div className="form-card">
          <div className="form-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
            <div>
              <h3>📅 Leave Management</h3>
              <p>Manage all leave requests</p>
            </div>
            <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
              <span className="form-badge" style={{background: '#fef3c7', color: '#92400e'}}>{pendingLeaves.length} Pending</span>
            </div>
          </div>

          <div style={{display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap'}}>
            <button onClick={() => setSelectedTab('requests')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'requests' ? '#1e3a5f' : '#f3f4f6', color: selectedTab === 'requests' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'requests' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>All ({filtered.length})</button>
            <button onClick={() => setSelectedTab('pending')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'pending' ? '#d97706' : '#f3f4f6', color: selectedTab === 'pending' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'pending' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>⏳ Pending ({pendingLeaves.length})</button>
            <button onClick={() => setSelectedTab('approved')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'approved' ? '#0b7e4b' : '#f3f4f6', color: selectedTab === 'approved' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'approved' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>✅ Approved ({approvedLeaves.length})</button>
            <button onClick={() => setSelectedTab('rejected')} style={{padding: '8px 16px', border: 'none', background: selectedTab === 'rejected' ? '#dc2626' : '#f3f4f6', color: selectedTab === 'rejected' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'rejected' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>❌ Rejected ({rejectedLeaves.length})</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {getDisplayLeaves().length === 0 && (<tr><td colSpan="7" className="empty-state"><div className="empty-icon">📋</div><div>No leave requests found</div></td></tr>)}
                {getDisplayLeaves().map(l => (
                  <tr key={l.id}>
                    <td><strong>{l.employeeName}</strong></td>
                    <td><span style={{textTransform: 'capitalize'}}>{l.type}</span></td>
                    <td>{l.startDate}</td>
                    <td>{l.endDate}</td>
                    <td>{l.reason}</td>
                    <td>
                      <span style={{padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: l.status === 'pending' ? '#fef3c7' : l.status === 'approved' ? '#d1fae5' : '#fee2e2', color: l.status === 'pending' ? '#92400e' : l.status === 'approved' ? '#065f37' : '#991b1b'}}>
                        {l.status}
                        {!l.synced && l.status !== 'pending' && <span style={{fontSize: '10px', color: '#f59e0b', marginLeft: '4px'}}>📡</span>}
                      </span>
                    </td>
                    <td>
                      {l.status === 'pending' && (
                        <>
                          <button onClick={() => approveLeave(l.id, true)} style={{background: '#0b7e4b', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginRight: '4px', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>✅ Approve</button>
                          <button onClick={() => approveLeave(l.id, false)} style={{background: '#dc2626', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', opacity: 1, visibility: 'visible', display: 'inline-flex'}}>❌ Reject</button>
                        </>
                      )}
                      {l.status !== 'pending' && <span style={{fontSize: '12px', color: '#6b7f94'}}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (isSupervisor) return renderSupervisorView();
  if (isOfficer) return renderOfficerView();
  if (isManager) return renderManagerView();
  return <div className="leaves-view"><div className="form-card"><p>Loading...</p></div></div>;
}

export default LeaveManagement;