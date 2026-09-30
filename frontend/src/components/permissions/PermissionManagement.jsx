// components/permissions/PermissionManagement.js – FINAL: offline-safe creation + approval

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { db } from '../../services/database';
import { uid } from '../../utils/helpers';
import { syncQueue, checkRealInternet } from '../../services/database';
import UserAvatar from '../common/UserAvatar';

import { getServerBase } from '../../utils/helpers';
const API_BASE = getServerBase() + '/api';

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
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState('requests');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [displayPermissions, setDisplayPermissions] = useState([]);
  const [errors, setErrors] = useState({});
  const [rejectModalId, setRejectModalId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [newPermission, setNewPermission] = useState({
    employeeId: '',
    permissionType: '',
    startDate: '',
    endDate: '',
    reason: ''
  });

  // ===== UPDATE DISPLAY PERMISSIONS (only synced = true) =====
  const supervisorEmployeeIds = React.useMemo(() => {
    return new Set((users || []).filter(u => u.role === 'supervisor').map(u => u.employeeId));
  }, [users]);

  const updateDisplayPermissions = () => {
    if (!permissions || permissions.length === 0) {
      setDisplayPermissions([]);
      return;
    }

    let filtered = [];
    if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      filtered = permissions.filter(p =>
        p.employeeId === user.employeeId || teamIds.includes(p.employeeId)
      );
    } else if (isOfficer && user) {
      filtered = permissions.filter(p => p.employeeId === user.employeeId);
    } else if (isManager && user) {
      // Manager only sees and approves SUPERVISOR permission requests
      filtered = permissions.filter(p => supervisorEmployeeIds.has(p.employeeId));
    } else {
      filtered = permissions;
    }

    // ONLY show records that have been synced to the server
    let syncedPermissions = filtered.filter(p => p.synced === true);
    syncedPermissions.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
    setDisplayPermissions(syncedPermissions);
  };

  // ===== REFRESH DATA FROM INDEXEDDB =====
  const refreshDataFromIndexedDB = async () => {
    try {
      const allPermissions = await db.permissions.toArray();
      if (setPermissions && typeof setPermissions === 'function') {
        setPermissions(allPermissions);
      }
    } catch (err) {
      console.error('Error refreshing permissions from IndexedDB:', err);
    }
  };

  // ===== CHECK ONLINE STATUS & AUTO-SYNC =====
  useEffect(() => {
    const checkNetwork = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
      const count = syncQueue.countByTypes(['permission', 'permission_update']);
      setPendingCount(count);
      if (online && count > 0) {
        console.log(`🔄 Back online! Auto-syncing ${count} permission requests...`);
        window.dispatchEvent(new CustomEvent('force-sync'));
      }
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 3000);

    const handleSyncComplete = async () => {
      console.log('🔄 Sync complete - refreshing permissions...');
      await refreshDataFromIndexedDB();
      const count = syncQueue.countByTypes(['permission', 'permission_update']);
      setPendingCount(count);
      updateDisplayPermissions();
    };

    const handleQueueUpdate = () => {
      const count = syncQueue.countByTypes(['permission', 'permission_update']);
      setPendingCount(count);
      updateDisplayPermissions();
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
    updateDisplayPermissions();
  }, [permissions, user, isSupervisor, isOfficer, teamMembers, supervisorEmployeeIds]);

  const pendingPermissions = displayPermissions.filter(p => p.status === 'pending');
  const approvedPermissions = displayPermissions.filter(p => p.status === 'approved');
  const rejectedPermissions = displayPermissions.filter(p => p.status === 'rejected');

  // ===== VALIDATION =====
  const validatePermission = () => {
    const newErrors = {};
    if (!newPermission.permissionType) {
      newErrors.permissionType = t('permission.error_permission_type_required');
    }
    if (!newPermission.startDate) {
      newErrors.startDate = t('permission.error_start_date_required');
    }
    if (!newPermission.endDate) {
      newErrors.endDate = t('permission.error_end_date_required');
    } else if (newPermission.startDate && newPermission.endDate < newPermission.startDate) {
      newErrors.endDate = t('permission.error_end_date_after_start');
    }
    if (newPermission.startDate && newPermission.endDate) {
      const start = new Date(newPermission.startDate);
      const end = new Date(newPermission.endDate);
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays > 7) {
        newErrors.endDate = t('permission.error_max_7_days');
      }
    }
    if (newPermission.startDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(newPermission.startDate);
      if (start < today) {
        newErrors.startDate = t('permission.error_start_date_past');
      }
    }
    if (!newPermission.reason || newPermission.reason.trim().length < 3) {
      newErrors.reason = t('permission.error_reason_min');
    } else if (newPermission.reason.trim().length > 200) {
      newErrors.reason = t('permission.error_reason_max');
    }
    if (isManager && !newPermission.employeeId) {
      newErrors.employeeId = t('permission.error_select_employee');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ===== REQUEST PERMISSION (creation) – unchanged =====
  const handleRequestPermission = async (e) => {
    e.preventDefault();

    if (!validatePermission()) {
      const firstError = document.querySelector('.form-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setIsSubmitting(true);

    const permission = {
      id: uid(),
      employeeId: (isOfficer || isSupervisor) ? user.employeeId : newPermission.employeeId,
      employeeName: (isOfficer || isSupervisor) ? user.name : users?.find(u => u.employeeId === newPermission.employeeId)?.name || user.name,
      permissionType: newPermission.permissionType,
      startDate: newPermission.startDate,
      endDate: newPermission.endDate,
      reason: newPermission.reason.trim(),
      status: 'pending',
      requestedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      synced: false
    };

    try {
      await db.permissions.add(permission);
      if (setPermissions) {
        setPermissions(prev => [permission, ...prev]);
      }

      if (isOnline) {
        try {
          const response = await fetch(`${API_BASE}/permissions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(permission)
          });
          if (response.ok) {
            await db.permissions.update(permission.id, { synced: true });
            if (setPermissions) {
              setPermissions(prev => prev.map(p => p.id === permission.id ? { ...p, synced: true } : p));
            }
            toast(t('permission.toast_submit_success'));
          } else {
            throw new Error('Server error');
          }
        } catch (err) {
          console.warn('Server unreachable, queueing permission:', err.message);
          syncQueue.add({ type: 'permission', id: permission.id, data: permission });
          setPendingCount(syncQueue.countByTypes(['permission', 'permission_update']));
          toast(t('permission.toast_server_unreachable'));
        }
      } else {
        console.warn('Offline, queueing permission...');
        syncQueue.add({ type: 'permission', id: permission.id, data: permission });
        setPendingCount(syncQueue.countByTypes(['permission', 'permission_update']));
        toast(t('permission.toast_saved_offline'));
      }

      if (addNotification) {
        addNotification(
          user.id,
          t('permission.notification_request_title'),
          t('permission.notification_request_body', { type: newPermission.permissionType }),
          'info',
          '/permissions'
        );
      }
    } catch (error) {
      console.error('Error submitting permission:', error);
      toast(t('permission.toast_submit_error', { error: error.message }));
    } finally {
      setIsSubmitting(false);
      setShowModal(false);
      setNewPermission({ employeeId: '', permissionType: '', startDate: '', endDate: '', reason: '' });
      setErrors({});
    }
  };

  // ===== APPROVE PERMISSION – UPDATED with PUT and offline queue =====
  const approvePermission = async (permissionId, approve, rejectionReason = null) => {
    try {
      const permission = permissions.find(p => p.id === permissionId);
      if (!permission) {
        toast(t('permission.toast_not_found'));
        return;
      }

      if (isSupervisor) {
        if (permission.employeeId === user.employeeId) {
          toast(t('permission.toast_cannot_approve_own'));
          return;
        }
        const teamIds = teamMembers.map(m => m.employeeId);
        if (!teamIds.includes(permission.employeeId)) {
          toast(t('permission.toast_only_team'));
          return;
        }
      }

      if (isOfficer) {
        toast(t('permission.toast_officer_cannot_approve'));
        return;
      }

      if (!approve && (!rejectionReason || rejectionReason.trim().length < 3)) {
        toast(t('permission.toast_reject_reason_required'));
        return;
      }

      const status = approve ? 'approved' : 'rejected';
      const statusLabel = approve ? t('permission.status.approved') : t('permission.status.rejected');
      const updatedPermission = {
        ...permission,
        status,
        approvedBy: user.employeeId,
        approvedAt: new Date().toISOString(),
        rejectReason: approve ? null : rejectionReason.trim(),
        synced: false   // will become true only after server confirms
      };

      // 1. Update IndexedDB locally (synced: false)
      await db.permissions.update(permissionId, updatedPermission);
      if (setPermissions) {
        setPermissions(prev => prev.map(p => p.id === permissionId ? updatedPermission : p));
      }

      // 2. Try to send PUT to server if online
      if (isOnline) {
        try {
          const response = await fetch(`${API_BASE}/permissions/${permissionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedPermission)
          });
          if (response.ok) {
            await db.permissions.update(permissionId, { synced: true });
            if (setPermissions) {
              setPermissions(prev => prev.map(p => p.id === permissionId ? { ...p, synced: true } : p));
            }
            toast(t('permission.toast_status_change', { status: statusLabel }));
          } else {
            throw new Error('Server error');
          }
        } catch (err) {
          console.warn('Failed to sync approval, queueing:', err.message);
          syncQueue.add({ type: 'permission_update', id: permissionId, data: updatedPermission });
          setPendingCount(syncQueue.countByTypes(['permission', 'permission_update']));
          toast(t('permission.toast_status_local_queued', { status: statusLabel }));
        }
      } else {
        console.warn('Offline, queueing permission approval...');
        syncQueue.add({ type: 'permission_update', id: permissionId, data: updatedPermission });
        setPendingCount(syncQueue.countByTypes(['permission', 'permission_update']));
        toast(t('permission.toast_status_offline', { status: statusLabel }));
      }

      if (addNotification) {
        const officer = users?.find(u => u.employeeId === permission.employeeId);
        if (officer) {
          addNotification(
            officer.id,
            t('permission.notification_update_title'),
            t('permission.notification_update_body', { status: statusLabel, name: user.name }),
            approve ? 'success' : 'error',
            '/permissions'
          );
        }
      }
    } catch (error) {
      console.error('Error updating permission:', error);
      toast(t('permission.toast_update_error', { error: error.message }));
    }
  };

  // ===== REJECT REASON MODAL =====
  const openRejectModal = (permissionId) => {
    setRejectModalId(permissionId);
    setRejectReason('');
  };

  const closeRejectModal = () => {
    setRejectModalId(null);
    setRejectReason('');
  };

  const submitRejection = async () => {
    if (!rejectReason || rejectReason.trim().length < 3) {
      toast(t('permission.toast_reject_reason_missing'));
      return;
    }
    const id = rejectModalId;
    closeRejectModal();
    await approvePermission(id, false, rejectReason.trim());
  };

  const renderRejectModal = () => {
    if (!rejectModalId) return null;
    const permission = permissions.find(p => p.id === rejectModalId);
    return (
      <div className="modal-overlay" onClick={closeRejectModal}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '520px',
          width: '95%'
        }}>
          <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#991b1b' }}>{t('permission.reject_modal_title')}</h3>
            <button
              className="modal-close"
              onClick={closeRejectModal}
              style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}
            >✕</button>
          </div>

          <div style={{
            padding: '12px 16px',
            background: '#f8fafc',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#374151'
          }}>
            <strong>{permission?.employeeName}</strong> — {permission?.permissionType}
            <span style={{ display: 'block', fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              {permission?.startDate} → {permission?.endDate}
            </span>
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
              {t('permission.reject_reason_label')} *
            </label>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder={t('permission.reject_reason_placeholder')}
              rows="3"
              maxLength="200"
              autoFocus
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical',
                minHeight: '60px',
                width: '100%'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              <span>{t('permission.required')}</span>
              <span>{rejectReason.length}/200</span>
            </div>
          </div>

          <div className="modal-actions" style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button onClick={submitRejection} style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {t('permission.confirm_rejection')}
            </button>
            <button onClick={closeRejectModal} style={{
              background: '#e5e7eb',
              color: '#374151',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ===== GET DISPLAY PERMISSIONS (based on tab) =====
  const getSenderUser = (permission) => users?.find(u => u.employeeId === permission.employeeId);

  const getDisplayPermissions = () => {
    if (selectedTab === 'pending') return pendingPermissions;
    if (selectedTab === 'approved') return approvedPermissions;
    if (selectedTab === 'rejected') return rejectedPermissions;
    return displayPermissions;
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
              {t('permission.request_permission')}
              {!isOnline && <span style={{ fontSize: '12px', color: '#f59e0b', marginLeft: '8px' }}>📡 {t('header.offline')}</span>}
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
              <strong>📡 {t('permission.offline_mode')}:</strong> {t('permission.offline_banner_saved')}
              {pendingCount > 0 && (
                <span style={{ marginLeft: '8px' }}>({t('permission.pending_sync', { count: pendingCount })})</span>
              )}
            </div>
          )}

          <form onSubmit={handleRequestPermission} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isManager && (
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{t('permission.employee_label')} *</label>
                <select
                  value={newPermission.employeeId}
                  onChange={e => setNewPermission({ ...newPermission, employeeId: e.target.value })}
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
                  <option value="">{t('permission.select_employee')}</option>
                  {users?.map(u => (
                    <option key={u.id} value={u.employeeId}>{u.name}</option>
                  ))}
                </select>
                {errors.employeeId && (
                  <div className="form-error" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                    {errors.employeeId}
                  </div>
                )}
              </div>
            )}
            {(isSupervisor || isOfficer) && (
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{t('permission.employee')}</label>
                <input
                  type="text"
                  value={user?.name || ''}
                  readOnly
                  style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: '#f3f4f6', width: '100%' }}
                />
              </div>
            )}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{t('permission.permission_type_label')} *</label>
              <select
                value={newPermission.permissionType}
                onChange={e => setNewPermission({ ...newPermission, permissionType: e.target.value })}
                required
                style={{
                  padding: '8px 12px',
                  border: `1px solid ${errors.permissionType ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  width: '100%',
                  background: 'white'
                }}
              >
                <option value="">{t('permission.select_type')}</option>
                <option value="Work Permission">{t('permission.type_work')}</option>
                <option value="Personal Permission">{t('permission.type_personal')}</option>
                <option value="Medical Permission">{t('permission.type_medical')}</option>
                <option value="Other">{t('permission.type_other')}</option>
              </select>
              {errors.permissionType && (
                <div className="form-error" style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                  {errors.permissionType}
                </div>
              )}
            </div>
            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{t('permission.start_date_label')} *</label>
                <input
                  type="date"
                  value={newPermission.startDate}
                  onChange={e => setNewPermission({ ...newPermission, startDate: e.target.value })}
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
                    {errors.startDate}
                  </div>
                )}
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{t('permission.end_date_label')} *</label>
                <input
                  type="date"
                  value={newPermission.endDate}
                  onChange={e => setNewPermission({ ...newPermission, endDate: e.target.value })}
                  required
                  min={newPermission.startDate || new Date().toISOString().split('T')[0]}
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
                    {errors.endDate}
                  </div>
                )}
              </div>
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{t('permission.reason_label')} *</label>
              <textarea
                value={newPermission.reason}
                onChange={e => setNewPermission({ ...newPermission, reason: e.target.value })}
                placeholder={t('permission.reason_placeholder')}
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
                <span>{errors.reason && <span style={{ color: '#dc2626' }}>{errors.reason}</span>}</span>
                <span>{newPermission.reason.length}/200</span>
              </div>
            </div>
            <div style={{
              padding: '12px',
              background: !isOnline ? '#fef3c7' : '#dbeafe',
              borderRadius: '8px',
              fontSize: '13px',
              color: !isOnline ? '#92400e' : '#1e40af'
            }}>
              <strong>ℹ️ {isOnline ? t('header.online') : t('header.offline')}:</strong>
              {isOnline ? t('permission.online_notice') : t('permission.offline_notice')}
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
                {isSubmitting ? t('permission.submitting') : isOnline ? t('permission.submit_request') : t('permission.save_offline')}
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
                {t('common.cancel')}
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
    const teamPendingPermissions = pendingPermissions.filter(p => teamIds.includes(p.employeeId));
    const ownPendingPermissions = pendingPermissions.filter(p => p.employeeId === user.employeeId);

    return (
      <div className="permissions-view">
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
            <span>📡 {t('permission.offline_banner', { count: pendingCount })}</span>
            <span style={{ fontSize: '12px', color: '#92400e' }}>⏳ {t('permission.waiting_connection')}</span>
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
            <span>🔄 {t('permission.syncing_banner', { count: pendingCount })}</span>
            <span style={{ fontSize: '12px', color: '#1e40af' }}>⏳ {t('permission.please_wait')}</span>
          </div>
        )}

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
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>{t('permission.title')}</h2>
            <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
              {t('permission.subtitle_supervisor')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(252,211,77,0.4)',
              padding: '6px 14px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              ⏳ {pendingPermissions.length} {t('permission.pending_count')}
            </span>
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: '#0b7e4b',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '24px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📋 {t('permission.request_permission')}
            </button>
          </div>
        </div>

        <div className="form-card">

          <div style={{
            background: '#e0f2fe',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <span>👤 <strong>{t('permission.your_pending')}:</strong> {ownPendingPermissions.length}</span>
            <span>👥 <strong>{t('permission.team_pending')}:</strong> {teamPendingPermissions.length}</span>
            <span style={{ color: '#0369a1', fontSize: '13px' }}>ℹ️ {t('permission.team_approval_note')}</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedTab('requests')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'requests' ? '#1e3a5f' : '#f3f4f6', color: selectedTab === 'requests' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'requests' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>{t('permission.tab_all')} ({displayPermissions.length})</button>
            <button onClick={() => setSelectedTab('pending')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'pending' ? '#d97706' : '#f3f4f6', color: selectedTab === 'pending' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'pending' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>⏳ {t('permission.tab_pending')} ({pendingPermissions.length})</button>
            <button onClick={() => setSelectedTab('approved')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'approved' ? '#0b7e4b' : '#f3f4f6', color: selectedTab === 'approved' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'approved' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>✅ {t('permission.tab_approved')} ({approvedPermissions.length})</button>
            <button onClick={() => setSelectedTab('rejected')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'rejected' ? '#dc2626' : '#f3f4f6', color: selectedTab === 'rejected' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'rejected' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>❌ {t('permission.tab_rejected')} ({rejectedPermissions.length})</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead><tr><th>{t('permission.employee')}</th><th>{t('permission.permission_type')}</th><th>{t('permission.start')}</th><th>{t('permission.end')}</th><th>{t('permission.reason')}</th><th>{t('common.status')}</th><th>{t('permission.action')}</th></tr></thead>
              <tbody>
                {getDisplayPermissions().length === 0 && (<tr><td colSpan="7" className="empty-state"><div className="empty-icon">📋</div><div>{t('permission.no_requests')}</div></td></tr>)}
                {getDisplayPermissions().map(p => {
                  const isOwnPermission = p.employeeId === user.employeeId;
                  const isTeamMember = teamIds.includes(p.employeeId);
                  const canApprove = isTeamMember && !isOwnPermission;
                  const isPending = p.status === 'pending';

                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <UserAvatar photo={getSenderUser(p)?.profilePhoto} name={p.employeeName} size={32} />
                          <div>
                            <strong>{p.employeeName}</strong>{isOwnPermission && <span style={{ fontSize: '11px', color: '#6b7f94', marginLeft: '6px' }}>({t('permission.you_badge')})</span>}{isTeamMember && !isOwnPermission && <span style={{ fontSize: '11px', color: '#0369a1', marginLeft: '6px' }}>({t('permission.team_badge')})</span>}
                          </div>
                        </div>
                      </td>
                      <td>{p.permissionType}</td>
                      <td>{p.startDate}</td>
                      <td>{p.endDate}</td>
                      <td>
                        {p.status === 'rejected'
                          ? p.rejectReason
                          : p.reason}
                      </td>
                      <td>
                        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: p.status === 'pending' ? '#fef3c7' : p.status === 'approved' ? '#d1fae5' : '#fee2e2', color: p.status === 'pending' ? '#92400e' : p.status === 'approved' ? '#065f37' : '#991b1b' }}>
                          {t(`permission.status.${p.status}`, { defaultValue: p.status })}
                        </span>
                      </td>
                      <td>
                        {isPending ? (
                          canApprove ? (
                            <>
                              <button
                                onClick={() => approvePermission(p.id, true)}
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
                                {t('common.approve')}
                              </button>
                              <button
                                onClick={() => openRejectModal(p.id)}
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
                                {t('common.reject')}
                              </button>
                            </>
                          ) : isOwnPermission ? (
                            <span style={{ fontSize: '12px', color: '#6b7f94' }}>⏳ {t('permission.wait_for_manager')}</span>
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
        {renderRejectModal()}
      </div>
    );
  };

  // ===== OFFICER VIEW =====
  const renderOfficerView = () => {
    return (
      <div className="permissions-view">
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
            <span>📡 {t('permission.offline_banner', { count: pendingCount })}</span>
            <span style={{ fontSize: '12px', color: '#92400e' }}>⏳ {t('permission.waiting_connection')}</span>
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
            <span>🔄 {t('permission.syncing_banner', { count: pendingCount })}</span>
            <span style={{ fontSize: '12px', color: '#1e40af' }}>⏳ {t('permission.please_wait')}</span>
          </div>
        )}

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
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>{t('permission.title_my_requests')}</h2>
            <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
              {t('permission.subtitle_officer')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(252,211,77,0.4)',
              padding: '6px 14px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              ⏳ {pendingPermissions.length} {t('permission.pending_count')}
            </span>
            <button
              onClick={() => setShowModal(true)}
              style={{
                background: '#0b7e4b',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '24px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              📋 {t('permission.request_permission')}
            </button>
          </div>
        </div>

        <div className="form-card">

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedTab('requests')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'requests' ? '#1e3a5f' : '#f3f4f6', color: selectedTab === 'requests' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'requests' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>{t('permission.tab_all')} ({displayPermissions.length})</button>
            <button onClick={() => setSelectedTab('pending')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'pending' ? '#d97706' : '#f3f4f6', color: selectedTab === 'pending' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'pending' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>⏳ {t('permission.tab_pending')} ({pendingPermissions.length})</button>
            <button onClick={() => setSelectedTab('approved')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'approved' ? '#0b7e4b' : '#f3f4f6', color: selectedTab === 'approved' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'approved' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>✅ {t('permission.tab_approved')} ({approvedPermissions.length})</button>
            <button onClick={() => setSelectedTab('rejected')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'rejected' ? '#dc2626' : '#f3f4f6', color: selectedTab === 'rejected' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'rejected' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>❌ {t('permission.tab_rejected')} ({rejectedPermissions.length})</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead><tr><th>{t('permission.employee')}</th><th>{t('permission.permission_type')}</th><th>{t('permission.start')}</th><th>{t('permission.end')}</th><th>{t('permission.reason')}</th><th>{t('common.status')}</th></tr></thead>
              <tbody>
                {getDisplayPermissions().length === 0 && (<tr><td colSpan="6" className="empty-state"><div className="empty-icon">📋</div><div>{t('permission.no_requests')}</div></td></tr>)}
                {getDisplayPermissions().map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserAvatar photo={getSenderUser(p)?.profilePhoto} name={p.employeeName} size={32} />
                        <strong>{p.employeeName}</strong>
                      </div>
                    </td>
                    <td>{p.permissionType}</td>
                    <td>{p.startDate}</td>
                    <td>{p.endDate}</td>
                    <td>
                      {p.status === 'rejected'
                        ? p.rejectReason
                        : p.reason}
                    </td>
                    <td>
                      <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: p.status === 'pending' ? '#fef3c7' : p.status === 'approved' ? '#d1fae5' : '#fee2e2', color: p.status === 'pending' ? '#92400e' : p.status === 'approved' ? '#065f37' : '#991b1b' }}>
                        {t(`permission.status.${p.status}`, { defaultValue: p.status })}
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
      <div className="permissions-view">
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
            <span>📡 {t('permission.offline_banner', { count: pendingCount })}</span>
            <span style={{ fontSize: '12px', color: '#92400e' }}>⏳ {t('permission.waiting_connection')}</span>
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
            <span>🔄 {t('permission.syncing_banner', { count: pendingCount })}</span>
            <span style={{ fontSize: '12px', color: '#1e40af' }}>⏳ {t('permission.please_wait')}</span>
          </div>
        )}

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
            <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>{t('permission.title')}</h2>
            <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
              {t('permission.subtitle_manager')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(252,211,77,0.4)',
              padding: '6px 14px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              ⏳ {pendingPermissions.length} {t('permission.pending_count')}
            </span>
          </div>
        </div>

        <div className="form-card">

          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setSelectedTab('requests')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'requests' ? '#1e3a5f' : '#f3f4f6', color: selectedTab === 'requests' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'requests' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>{t('permission.tab_all')} ({displayPermissions.length})</button>
            <button onClick={() => setSelectedTab('pending')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'pending' ? '#d97706' : '#f3f4f6', color: selectedTab === 'pending' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'pending' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>⏳ {t('permission.tab_pending')} ({pendingPermissions.length})</button>
            <button onClick={() => setSelectedTab('approved')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'approved' ? '#0b7e4b' : '#f3f4f6', color: selectedTab === 'approved' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'approved' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>✅ {t('permission.tab_approved')} ({approvedPermissions.length})</button>
            <button onClick={() => setSelectedTab('rejected')} style={{ padding: '8px 16px', border: 'none', background: selectedTab === 'rejected' ? '#dc2626' : '#f3f4f6', color: selectedTab === 'rejected' ? 'white' : '#374151', borderRadius: '6px', cursor: 'pointer', fontWeight: selectedTab === 'rejected' ? '600' : '400', opacity: 1, visibility: 'visible', display: 'inline-flex' }}>❌ {t('permission.tab_rejected')} ({rejectedPermissions.length})</button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead><tr><th>{t('permission.employee')}</th><th>{t('permission.permission_type')}</th><th>{t('permission.start')}</th><th>{t('permission.end')}</th><th>{t('permission.reason')}</th><th>{t('common.status')}</th><th>{t('permission.action')}</th></tr></thead>
              <tbody>
                {getDisplayPermissions().length === 0 && (<tr><td colSpan="7" className="empty-state"><div className="empty-icon">📋</div><div>{t('permission.no_requests')}</div></td></tr>)}
                {getDisplayPermissions().map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserAvatar photo={getSenderUser(p)?.profilePhoto} name={p.employeeName} size={32} />
                        <strong>{p.employeeName}</strong>
                      </div>
                    </td>
                    <td>{p.permissionType}</td>
                    <td>{p.startDate}</td>
                    <td>{p.endDate}</td>
                    <td>
                      {p.status === 'rejected'
                        ? p.rejectReason
                        : p.reason}
                    </td>
                    <td>
                      <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: p.status === 'pending' ? '#fef3c7' : p.status === 'approved' ? '#d1fae5' : '#fee2e2', color: p.status === 'pending' ? '#92400e' : p.status === 'approved' ? '#065f37' : '#991b1b' }}>
                        {t(`permission.status.${p.status}`, { defaultValue: p.status })}
                      </span>
                    </td>
                    <td>
                      {p.status === 'pending' && (
                        <>
                          <button
                            onClick={() => approvePermission(p.id, true)}
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
                            {t('common.approve')}
                          </button>
                          <button
                            onClick={() => openRejectModal(p.id)}
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
                            {t('common.reject')}
                          </button>
                        </>
                      )}
                      {p.status !== 'pending' && <span style={{ fontSize: '12px', color: '#6b7f94' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {renderRejectModal()}
      </div>
    );
  };

  if (isSupervisor) return renderSupervisorView();
  if (isOfficer) return renderOfficerView();
  if (isManager) return renderManagerView();
  return <div className="permissions-view"><div className="form-card"><p>{t('common.loading')}</p></div></div>;
}

export default PermissionManagement;