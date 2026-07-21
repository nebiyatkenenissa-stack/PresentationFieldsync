// components/leaves/LeaveManagement.js – FINAL: offline-safe creation + approval

import React, { useState, useEffect } from 'react';
import { db } from '../../services/database';
import { uid } from '../../utils/helpers';
import { syncQueue, checkRealInternet } from '../../services/database';

const API_BASE = 'http://localhost:5000/api';

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [displayLeaves, setDisplayLeaves] = useState([]);
  const [errors, setErrors] = useState({});
  const [newLeave, setNewLeave] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    reason: '',
    type: 'annual'
  });

  // ===== UPDATE DISPLAY LEAVES (only synced = true) =====
  const updateDisplayLeaves = () => {
    if (!leaves || leaves.length === 0) {
      setDisplayLeaves([]);
      return;
    }

    let filtered = [];
    if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      filtered = leaves.filter(l =>
        l.employeeId === user.employeeId || teamIds.includes(l.employeeId)
      );
    } else if (isOfficer && user) {
      filtered = leaves.filter(l => l.employeeId === user.employeeId);
    } else {
      filtered = leaves;
    }

    // ONLY show records that have been synced to the server
    let syncedLeaves = filtered.filter(l => l.synced === true);
    syncedLeaves.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setDisplayLeaves(syncedLeaves);
  };

  // ===== REFRESH DATA FROM INDEXEDDB =====
  const refreshDataFromIndexedDB = async () => {
    try {
      const allLeaves = await db.leaves.toArray();
      if (setLeaves && typeof setLeaves === 'function') {
        setLeaves(allLeaves);
      }
    } catch (err) {
      console.error('Error refreshing leaves from IndexedDB:', err);
    }
  };

  // ===== CHECK ONLINE STATUS & AUTO-SYNC =====
  useEffect(() => {
    const checkNetwork = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
      const count = syncQueue.count();
      setPendingCount(count);
      if (online && count > 0) {
        console.log(`🔄 Back online! Auto-syncing ${count} leave requests...`);
        window.dispatchEvent(new CustomEvent('force-sync'));
      }
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 3000);

    const handleSyncComplete = async () => {
      console.log('🔄 Sync complete - refreshing leaves...');
      await refreshDataFromIndexedDB();
      const count = syncQueue.count();
      setPendingCount(count);
      updateDisplayLeaves();
    };

    const handleQueueUpdate = () => {
      const count = syncQueue.count();
      setPendingCount(count);
      updateDisplayLeaves();
    };

    window.addEventListener('sync-complete', handleSyncComplete);
    window.addEventListener('sync-queue-updated', handleQueueUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sync-complete', handleSyncComplete);
      window.removeEventListener('sync-queue-updated', handleQueueUpdate);
    };
  }, []);

  useEffect(() => {
    updateDisplayLeaves();
  }, [leaves, user, isSupervisor, isOfficer, teamMembers]);

  const pendingLeaves = displayLeaves.filter(l => l.status === 'pending');
  const approvedLeaves = displayLeaves.filter(l => l.status === 'approved');
  const rejectedLeaves = displayLeaves.filter(l => l.status === 'rejected');

  // ===== VALIDATION =====
  const validateLeave = () => {
    const newErrors = {};
    if (!newLeave.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    if (!newLeave.endDate) {
      newErrors.endDate = 'End date is required';
    } else if (newLeave.startDate && newLeave.endDate < newLeave.startDate) {
      newErrors.endDate = 'End date must be after start date';
    }
    if (newLeave.startDate && newLeave.endDate) {
      const start = new Date(newLeave.startDate);
      const end = new Date(newLeave.endDate);
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        newErrors.endDate = 'Leave cannot exceed 30 days';
      }
    }
    if (newLeave.startDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(newLeave.startDate);
      if (start < today) {
        newErrors.startDate = 'Start date cannot be in the past';
      }
    }
    if (!newLeave.reason || newLeave.reason.trim().length < 3) {
      newErrors.reason = 'Reason must be at least 3 characters';
    } else if (newLeave.reason.trim().length > 200) {
      newErrors.reason = 'Reason cannot exceed 200 characters';
    }
    if (isManager && !newLeave.employeeId) {
      newErrors.employeeId = 'Please select an employee';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ===== REQUEST LEAVE (creation) – unchanged =====
  const handleRequestLeave = async (e) => {
    e.preventDefault();

    if (!validateLeave()) {
      const firstError = document.querySelector('.form-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);

    const leave = {
      id: uid(),
      employeeId: (isOfficer || isSupervisor) ? user.employeeId : newLeave.employeeId,
      employeeName: (isOfficer || isSupervisor) ? user.name : users?.find(u => u.employeeId === newLeave.employeeId)?.name || user.name,
      startDate: newLeave.startDate,
      endDate: newLeave.endDate,
      reason: newLeave.reason.trim(),
      type: newLeave.type,
      status: 'pending',
      createdAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      synced: false
    };

    try {
      // 1. Save to IndexedDB
      await db.leaves.add(leave);
      if (setLeaves && typeof setLeaves === 'function') {
        setLeaves(prev => [leave, ...prev]);
      }

      // 2. Try to send to PostgreSQL immediately if online
      if (isOnline) {
        try {
          const response = await fetch(`${API_BASE}/leaves`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leave)
          });
          if (response.ok) {
            await db.leaves.update(leave.id, { synced: true });
            if (setLeaves) {
              setLeaves(prev => prev.map(l => l.id === leave.id ? { ...l, synced: true } : l));
            }
            alert('✅ Leave request submitted successfully!');
          } else {
            throw new Error('Server error');
          }
        } catch (err) {
          console.warn('Server unreachable, queueing leave:', err.message);
          syncQueue.add({ type: 'leave', id: leave.id, data: leave });
          setPendingCount(syncQueue.count());
          alert('⚠️ Server unreachable. Request saved and will sync later.');
        }
      } else {
        // Offline – queue immediately
        console.warn('Offline, queueing leave...');
        syncQueue.add({ type: 'leave', id: leave.id, data: leave });
        setPendingCount(syncQueue.count());
        alert('📅 Leave request saved offline! Will sync when online.');
      }

      if (addNotification) {
        addNotification(
          user.id,
          '📅 Leave Request',
          `Leave request submitted from ${leave.startDate} to ${leave.endDate}`,
          'info'
        );
      }
    } catch (error) {
      console.error('Error submitting leave:', error);
      alert('❌ Error submitting leave request: ' + error.message);
    } finally {
      setIsSubmitting(false);
      setShowModal(false);
      setNewLeave({ employeeId: '', startDate: '', endDate: '', reason: '', type: 'annual' });
      setErrors({});
    }
  };

  // ===== APPROVE LEAVE – UPDATED with PUT and offline queue =====
  const approveLeave = async (leaveId, approve) => {
    try {
      const leave = leaves.find(l => l.id === leaveId);
      if (!leave) {
        alert('Leave request not found');
        return;
      }

      if (isSupervisor) {
        if (leave.employeeId === user.employeeId) {
          alert('❌ You cannot approve your own leave request.');
          return;
        }
        const teamIds = teamMembers.map(m => m.employeeId);
        if (!teamIds.includes(leave.employeeId)) {
          alert('❌ You can only approve team members.');
          return;
        }
      }

      if (isOfficer) {
        alert('❌ You cannot approve leave requests.');
        return;
      }

      const status = approve ? 'approved' : 'rejected';
      const updatedLeave = {
        ...leave,
        status,
        approvedBy: user.employeeId,
        approvedAt: new Date().toISOString(),
        synced: false   // will become true only after server confirms
      };

      // 1. Update IndexedDB locally (synced: false)
      await db.leaves.update(leaveId, updatedLeave);
      if (setLeaves) {
        setLeaves(prev => prev.map(l => l.id === leaveId ? updatedLeave : l));
      }

      // 2. Try to send PUT to server if online
      if (isOnline) {
        try {
          const response = await fetch(`${API_BASE}/leaves/${leaveId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedLeave)
          });
          if (response.ok) {
            // Server confirmed – now mark as synced
            await db.leaves.update(leaveId, { synced: true });
            if (setLeaves) {
              setLeaves(prev => prev.map(l => l.id === leaveId ? { ...l, synced: true } : l));
            }
            alert(`✅ Leave ${approve ? 'approved' : 'rejected'}!`);
          } else {
            throw new Error('Server error');
          }
        } catch (err) {
          console.warn('Failed to sync approval, queueing:', err.message);
          syncQueue.add({ type: 'leave_update', id: leaveId, data: updatedLeave });
          setPendingCount(syncQueue.count());
          alert(`⚠️ Leave ${approve ? 'approved' : 'rejected'} locally, but not yet synced. Will sync when online.`);
        }
      } else {
        // Offline – queue the update
        console.warn('Offline, queueing leave approval...');
        syncQueue.add({ type: 'leave_update', id: leaveId, data: updatedLeave });
        setPendingCount(syncQueue.count());
        alert(`📋 Leave ${approve ? 'approved' : 'rejected'} locally! Will sync when online.`);
      }

      if (addNotification) {
        const officer = users?.find(u => u.employeeId === leave.employeeId);
        if (officer) {
          addNotification(
            officer.id,
            'Leave Request Update',
            `Your leave request has been ${approve ? 'approved ✅' : 'rejected ❌'} by ${user.name}`,
            approve ? 'success' : 'error'
          );
        }
      }
    } catch (error) {
      console.error('Error updating leave:', error);
      alert('❌ Error updating leave: ' + error.message);
    }
  };

  // ===== GET DISPLAY LEAVES (based on tab) =====
  const getDisplayLeaves = () => {
    if (selectedTab === 'pending') return pendingLeaves;
    if (selectedTab === 'approved') return approvedLeaves;
    if (selectedTab === 'rejected') return rejectedLeaves;
    return displayLeaves;
  };

  // ===== MODAL RENDER =====
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
          <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600' }}>
              Request Leave
              {!isOnline && <span style={{ fontSize: '12px', color: '#f59e0b', marginLeft: '8px' }}>📡 Offline</span>}
            </h3>
            <button className="modal-close" onClick={() => setShowModal(false)} style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#64748b'
            }}>✕</button>
          </div>

          {!isOnline && (
            <div style={{
              padding: '12px 16px',
              background: '#fef3c7',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              marginBottom: '16px'
            }}>
              <strong>📡 Offline Mode:</strong> Your request will be saved and appear when online.
              {pendingCount > 0 && (
                <span style={{ marginLeft: '8px' }}>({pendingCount} pending sync)</span>
              )}
            </div>
          )}

          <form onSubmit={handleRequestLeave} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isManager && (
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Employee *</label>
                <select
                  value={newLeave.employeeId}
                  onChange={e => setNewLeave({ ...newLeave, employeeId: e.target.value })}
                  required
                  style={{
                    padding: '8px 12px',
                    border: `1px solid ${errors.employeeId ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    width: '100%',
                    background: 'white'
                  }}
                >
                  <option value="">Select Employee</option>
                  {users?.map(u => (
                    <option key={u.id} value={u.employeeId}>{u.name}</option>
                  ))}
                </select>
                {errors.employeeId && (
                  <div className="form-error" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                    ⚠️ {errors.employeeId}
                  </div>
                )}
              </div>
            )}
            {(isSupervisor || isOfficer) && (
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Employee</label>
                <input
                  type="text"
                  value={user?.name || ''}
                  readOnly
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: '#f3f4f6', width: '100%' }}
                />
              </div>
            )}
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Start Date *</label>
                <input
                  type="date"
                  value={newLeave.startDate}
                  onChange={e => setNewLeave({ ...newLeave, startDate: e.target.value })}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  style={{
                    padding: '8px 12px',
                    border: `1px solid ${errors.startDate ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    width: '100%'
                  }}
                />
                {errors.startDate && (
                  <div className="form-error" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                    ⚠️ {errors.startDate}
                  </div>
                )}
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>End Date *</label>
                <input
                  type="date"
                  value={newLeave.endDate}
                  onChange={e => setNewLeave({ ...newLeave, endDate: e.target.value })}
                  required
                  min={newLeave.startDate || new Date().toISOString().split('T')[0]}
                  style={{
                    padding: '8px 12px',
                    border: `1px solid ${errors.endDate ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    width: '100%'
                  }}
                />
                {errors.endDate && (
                  <div className="form-error" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                    ⚠️ {errors.endDate}
                  </div>
                )}
              </div>
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Leave Type</label>
              <select
                value={newLeave.type}
                onChange={e => setNewLeave({ ...newLeave, type: e.target.value })}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', width: '100%', background: 'white' }}
              >
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="personal">Personal</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>Reason *</label>
              <textarea
                value={newLeave.reason}
                onChange={e => setNewLeave({ ...newLeave, reason: e.target.value })}
                placeholder="Enter reason for leave (min 3 characters)"
                rows="3"
                required
                maxLength="200"
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${errors.reason ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical',
                  minHeight: '60px',
                  width: '100%'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                <span>{errors.reason && <span style={{ color: '#dc2626' }}>⚠️ {errors.reason}</span>}</span>
                <span>{newLeave.reason.length}/200</span>
              </div>
            </div>
            <div style={{
              padding: '12px',
              background: !isOnline ? '#fef3c7' : '#dbeafe',
              borderRadius: '8px',
              fontSize: '13px',
              color: !isOnline ? '#92400e' : '#1e40af'
            }}>
              <strong>ℹ️ {isOnline ? 'Online' : 'Offline'}:</strong>
              {isOnline ? ' Your request will be sent immediately.' : ' Your request will be saved and appear when online.'}
            </div>
            <div className="modal-actions" style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button type="submit" className="btn-submit" disabled={isSubmitting} style={{
                background: isOnline ? '#0b7e4b' : '#f59e0b',
                color: 'white',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '6px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: isSubmitting ? 0.7 : 1,
                visibility: 'visible',
                display: 'inline-flex'
              }}>
                {isSubmitting ? 'Submitting...' : isOnline ? 'Submit Request' : '💾 Save Offline'}
              </button>
              <button type="button" className="btn-cancel" onClick={() => {
                setShowModal(false);
                setErrors({});
              }} style={{
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

  // ===== SUPERVISOR VIEW =====
  const renderSupervisorView = () => {
    const teamIds = teamMembers.map(m => m.employeeId);
    const teamPendingLeaves = pendingLeaves.filter(l => teamIds.includes(l.employeeId));
    const ownPendingLeaves = pendingLeaves.filter(l => l.employeeId === user.employeeId);

    return (
      <div className="leaves-view">
        {!isOnline && pendingCount > 0 && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <span>📡 Offline: {pendingCount} request(s) saved. Will appear when online.</span>
            <span style={{ fontSize: '12px', color: '#92400e' }}>⏳ Waiting for connection...</span>
          </div>
        )}

        {isOnline && pendingCount > 0 && (
          <div style={{
            background: '#dbeafe',
            border: '1px solid #3b82f6',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <span>🔄 Syncing: {pendingCount} request(s) being synced...</span>
            <span style={{ fontSize: '12px', color: '#1e40af' }}>⏳ Please wait...</span>
          </div>
        )}

        <div className="form-card">
          <div className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3>📅 Leave Management</h3>
              <p>Your leaves + Team leaves (approve team members)</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="form-badge" style={{ background: '#fef3c7', color: '#92400e' }}>
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
            <span style={{ color: '#0369a1', fontSize: '13px' }}>ℹ️ You can approve team members' leaves, but not your own</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedTab('requests')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'requests' ? '#1e3a5f' : '#f3f4f6', color: selectedTab === 'requests' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'requests' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>All ({displayLeaves.length})</button>
            <button onClick={() => setSelectedTab('pending')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'pending' ? '#d97706' : '#f3f4f6', color: selectedTab === 'pending' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'pending' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>⏳ Pending ({pendingLeaves.length})</button>
            <button onClick={() => setSelectedTab('approved')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'approved' ? '#0b7e4b' : '#f3f4f6', color: selectedTab === 'approved' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'approved' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>✅ Approved ({approvedLeaves.length})</button>
            <button onClick={() => setSelectedTab('rejected')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'rejected' ? '#dc2626' : '#f3f4f6', color: selectedTab === 'rejected' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'rejected' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>❌ Rejected ({rejectedLeaves.length})</button>
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
                  const isPending = l.status === 'pending';

                  return (
                    <tr key={l.id}>
                      <td><strong>{l.employeeName}</strong>{isOwnLeave && <span style={{ fontSize: '11px', color: '#6b7f94', marginLeft: '6px' }}>(You)</span>}{isTeamMember && !isOwnLeave && <span style={{ fontSize: '11px', color: '#0369a1', marginLeft: '6px' }}>(Team)</span>}</td>
                      <td><span style={{ textTransform: 'capitalize' }}>{l.type}</span></td>
                      <td>{l.startDate}</td>
                      <td>{l.endDate}</td>
                      <td>{l.reason}</td>
                      <td>
                        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: l.status === 'pending' ? '#fef3c7' : l.status === 'approved' ? '#d1fae5' : '#fee2e2', color: l.status === 'pending' ? '#92400e' : l.status === 'approved' ? '#065f37' : '#991b1b' }}>
                          {l.status}
                        </span>
                      </td>
                      <td>
                        {isPending ? (
                          canApprove ? (
                            <>
                              <button
                                onClick={() => approveLeave(l.id, true)}
                                style={{
                                  background: '#0b7e4b',
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
                                ✅ Approve
                              </button>
                              <button
                                onClick={() => approveLeave(l.id, false)}
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
                                ❌ Reject
                              </button>
                            </>
                          ) : isOwnLeave ? (
                            <span style={{ fontSize: '12px', color: '#6b7f94' }}>⏳ Wait for Manager</span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#6b7f94' }}>—</span>
                          )
                        ) : (
                          <span style={{ fontSize: '12px', color: '#6b7f94' }}>—</span>
                        )}
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

  // ===== OFFICER VIEW =====
  const renderOfficerView = () => {
    return (
      <div className="leaves-view">
        {!isOnline && pendingCount > 0 && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <span>📡 Offline: {pendingCount} request(s) saved. Will appear when online.</span>
            <span style={{ fontSize: '12px', color: '#92400e' }}>⏳ Waiting for connection...</span>
          </div>
        )}

        {isOnline && pendingCount > 0 && (
          <div style={{
            background: '#dbeafe',
            border: '1px solid #3b82f6',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <span>🔄 Syncing: {pendingCount} request(s) being synced...</span>
            <span style={{ fontSize: '12px', color: '#1e40af' }}>⏳ Please wait...</span>
          </div>
        )}

        <div className="form-card">
          <div className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3>📅 My Leave Requests</h3>
              <p>View and manage your own leave requests</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="form-badge" style={{ background: '#fef3c7', color: '#92400e' }}>{pendingLeaves.length} Pending</span>
              <button onClick={() => setShowModal(true)} style={{ background: '#1e3a5f', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: 1, visibility: 'visible' }}>📋 Request Leave</button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedTab('requests')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'requests' ? '#1e3a5f' : '#f3f4f6', color: selectedTab === 'requests' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'requests' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>All ({displayLeaves.length})</button>
            <button onClick={() => setSelectedTab('pending')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'pending' ? '#d97706' : '#f3f4f6', color: selectedTab === 'pending' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'pending' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>⏳ Pending ({pendingLeaves.length})</button>
            <button onClick={() => setSelectedTab('approved')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'approved' ? '#0b7e4b' : '#f3f4f6', color: selectedTab === 'approved' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'approved' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>✅ Approved ({approvedLeaves.length})</button>
            <button onClick={() => setSelectedTab('rejected')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'rejected' ? '#dc2626' : '#f3f4f6', color: selectedTab === 'rejected' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'rejected' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>❌ Rejected ({rejectedLeaves.length})</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>
                {getDisplayLeaves().length === 0 && (<tr><td colSpan="6" className="empty-state"><div className="empty-icon">📋</div><div>No leave requests found</div></td></tr>)}
                {getDisplayLeaves().map(l => (
                  <tr key={l.id}>
                    <td><strong>{l.employeeName}</strong></td>
                    <td><span style={{ textTransform: 'capitalize' }}>{l.type}</span></td>
                    <td>{l.startDate}</td>
                    <td>{l.endDate}</td>
                    <td>{l.reason}</td>
                    <td>
                      <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: l.status === 'pending' ? '#fef3c7' : l.status === 'approved' ? '#d1fae5' : '#fee2e2', color: l.status === 'pending' ? '#92400e' : l.status === 'approved' ? '#065f37' : '#991b1b' }}>
                        {l.status}
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

  // ===== MANAGER VIEW =====
  const renderManagerView = () => {
    return (
      <div className="leaves-view">
        {!isOnline && pendingCount > 0 && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <span>📡 Offline: {pendingCount} request(s) saved. Will appear when online.</span>
            <span style={{ fontSize: '12px', color: '#92400e' }}>⏳ Waiting for connection...</span>
          </div>
        )}

        {isOnline && pendingCount > 0 && (
          <div style={{
            background: '#dbeafe',
            border: '1px solid #3b82f6',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <span>🔄 Syncing: {pendingCount} request(s) being synced...</span>
            <span style={{ fontSize: '12px', color: '#1e40af' }}>⏳ Please wait...</span>
          </div>
        )}

        <div className="form-card">
          <div className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3>📅 Leave Management</h3>
              <p>Manage all leave requests</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="form-badge" style={{ background: '#fef3c7', color: '#92400e' }}>{pendingLeaves.length} Pending</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedTab('requests')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'requests' ? '#1e3a5f' : '#f3f4f6', color: selectedTab === 'requests' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'requests' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>All ({displayLeaves.length})</button>
            <button onClick={() => setSelectedTab('pending')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'pending' ? '#d97706' : '#f3f4f6', color: selectedTab === 'pending' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'pending' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>⏳ Pending ({pendingLeaves.length})</button>
            <button onClick={() => setSelectedTab('approved')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'approved' ? '#0b7e4b' : '#f3f4f6', color: selectedTab === 'approved' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'approved' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>✅ Approved ({approvedLeaves.length})</button>
            <button onClick={() => setSelectedTab('rejected')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'rejected' ? '#dc2626' : '#f3f4f6', color: selectedTab === 'rejected' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'rejected' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>❌ Rejected ({rejectedLeaves.length})</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {getDisplayLeaves().length === 0 && (<tr><td colSpan="7" className="empty-state"><div className="empty-icon">📋</div><div>No leave requests found</div></td></tr>)}
                {getDisplayLeaves().map(l => (
                  <tr key={l.id}>
                    <td><strong>{l.employeeName}</strong></td>
                    <td><span style={{ textTransform: 'capitalize' }}>{l.type}</span></td>
                    <td>{l.startDate}</td>
                    <td>{l.endDate}</td>
                    <td>{l.reason}</td>
                    <td>
                      <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: l.status === 'pending' ? '#fef3c7' : l.status === 'approved' ? '#d1fae5' : '#fee2e2', color: l.status === 'pending' ? '#92400e' : l.status === 'approved' ? '#065f37' : '#991b1b' }}>
                        {l.status}
                      </span>
                    </td>
                    <td>
                      {l.status === 'pending' && (
                        <>
                          <button
                            onClick={() => approveLeave(l.id, true)}
                            style={{
                              background: '#0b7e4b',
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
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => approveLeave(l.id, false)}
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
                            ❌ Reject
                          </button>
                        </>
                      )}
                      {l.status !== 'pending' && <span style={{ fontSize: '12px', color: '#6b7f94' }}>—</span>}
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