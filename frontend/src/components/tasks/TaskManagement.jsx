// components/tasks/TaskManagement.js

import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { uid } from '../../utils/helpers';
import { db } from '../../services/database';
import { syncQueue, checkRealInternet } from '../../services/database';

import { getServerBase } from '../../utils/helpers';

// Set your API base URL (adjust to your backend)
const API_BASE_URL = getServerBase() + '/api';

function TaskManagement({
  filteredTasks,
  tasks,
  users,
  user,
  isManager,
  isSupervisor,
  isOfficer,
  teamMembers,
  addNotification,
  setTasks
}) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [taskFilter, setTaskFilter] = useState('all');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newTask, setNewTask] = useState({
    employeeId: '',
    title: '',
    description: '',
    deadline: '',
    priority: 'medium'
  });

  // ===== CHECK ONLINE STATUS =====
  const getPendingTaskCount = () => syncQueue.countByTypes(['task', 'task_update']);

  useEffect(() => {
    const checkNetwork = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
      setPendingCount(getPendingTaskCount());
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 5000);

    const handleQueueUpdate = () => {
      setPendingCount(getPendingTaskCount());
    };

    window.addEventListener('sync-queue-updated', handleQueueUpdate);
    window.addEventListener('sync-complete', handleQueueUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sync-queue-updated', handleQueueUpdate);
      window.removeEventListener('sync-complete', handleQueueUpdate);
    };
  }, []);

  // ===== HELPERS TO CALL SERVER =====
  const sendTaskToServer = async (task) => {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task)
    });
    if (!response.ok) {
      throw new Error(t('task.server_error', { status: response.status }));
    }
    return await response.json();
  };

  const sendTaskUpdateToServer = async (taskId, updateData) => {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    if (!response.ok) {
      throw new Error(t('task.server_error', { status: response.status }));
    }
    return await response.json();
  };

  // ===== FILTER LOGIC =====
  const getFilteredTasks = () => {
    let filtered = tasks;

    if (isOfficer && user) {
      filtered = tasks.filter(t => t.employeeId === user.employeeId);
    } else if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      filtered = tasks.filter(t => teamIds.includes(t.employeeId) || t.employeeId === user.employeeId);
    }

    if (taskFilter !== 'all') {
      filtered = filtered.filter(t => t.status === taskFilter);
    }

    return filtered;
  };

  // ===== CREATE TASK (OFFLINE + ONLINE) =====
  const handleCreateTask = async (e) => {
    e.preventDefault();

    if (!newTask.employeeId || !newTask.title || !newTask.deadline) {
      toast(t('task.fill_required_fields'));
      return;
    }

    const online = await checkRealInternet();
    setIsOnline(online);

    const task = {
      id: uid(),
      employeeId: newTask.employeeId,
      assignedBy: user.employeeId,
      assignedByName: user.name,
      title: newTask.title,
      description: newTask.description || '',
      deadline: newTask.deadline,
      priority: newTask.priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
      updatedAt: new Date().toISOString(),
      synced: online ? true : false
    };

    try {
      // 1. Save to IndexedDB
      await db.tasks.add(task);

      if (setTasks) {
        setTasks(prev => [task, ...prev]);
      }

      // 2. If online, try to sync to server
      if (online) {
        try {
          await sendTaskToServer(task);
          // Optionally mark as synced (already true)
        } catch (serverError) {
          console.error('Server sync failed:', serverError);
          // Mark as unsynced and queue for retry
          await db.tasks.update(task.id, { synced: false });
          syncQueue.add({
            type: 'task',
            id: task.id,
            data: task
          });
          setPendingCount(getPendingTaskCount());
          toast(t('task.sync_failed_save'));
          if (addNotification) {
            await addNotification(
              user.id,
              t('task.sync_failed'),
              t('task.notif_save_failed', { title: task.title }),
              'warning',
              '/tasks'
            );
          }
          return; // exit early to avoid double alert
        }
      } else {
        // Offline: queue for later sync
        syncQueue.add({
          type: 'task',
          id: task.id,
          data: task
        });
        setPendingCount(getPendingTaskCount());
        toast(t('task.saved_offline'));
        if (addNotification) {
          await addNotification(
            user.id,
            t('task.offline_save'),
            t('task.notif_offline_save', { title: task.title }),
            'warning',
            '/tasks'
          );
        }
        return;
      }

      // 3. Online + server success → send notifications
      const assignedUser = users.find(u => u.employeeId === task.employeeId);
      if (assignedUser && addNotification) {
        await addNotification(
          assignedUser.id,
          t('task.notif_new_task'),
          t('task.notif_assigned', { title: task.title, name: user.name }),
          'info',
          '/tasks'
        );
      }
      toast(t('task.assigned_success'));

      setShowModal(false);
      setNewTask({ employeeId: '', title: '', description: '', deadline: '', priority: 'medium' });
    } catch (error) {
      console.error('Error creating task:', error);
      toast(t('task.error_creating', { message: error.message }));
    }
  };

  // ===== UPDATE TASK STATUS (OFFLINE + ONLINE) =====
  const updateTaskStatus = async (taskId, newStatus) => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        toast(t('task.not_found'));
        setIsUpdating(false);
        return;
      }

      // Permission checks
      if (isOfficer && task.employeeId !== user.employeeId) {
        toast(t('task.only_own_tasks'));
        setIsUpdating(false);
        return;
      }

      if (isSupervisor) {
        const teamIds = teamMembers.map(m => m.employeeId);
        if (!teamIds.includes(task.employeeId) && task.employeeId !== user.employeeId) {
          toast(t('task.only_team_tasks'));
          setIsUpdating(false);
          return;
        }
      }

      const online = await checkRealInternet();
      setIsOnline(online);

      const updatedTask = {
        ...task,
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : task.completedAt,
        updatedAt: new Date().toISOString(),
        updatedBy: user.employeeId,
        updatedByName: user.name,
        synced: online ? true : false
      };

      // 1. Update IndexedDB
      await db.tasks.update(taskId, updatedTask);

      if (setTasks) {
        setTasks(prev => prev.map(t =>
          t.id === taskId ? updatedTask : t
        ));
      }

      // 2. If online, try to sync to server
      if (online) {
        try {
          const updatePayload = { status: newStatus };
          await sendTaskUpdateToServer(taskId, updatePayload);
        } catch (serverError) {
          console.error('Server update failed:', serverError);
          await db.tasks.update(taskId, { synced: false });
          syncQueue.add({
            type: 'task_update',
            id: taskId,
            data: { taskId, status: newStatus }
          });
          setPendingCount(getPendingTaskCount());
          toast(t('task.update_sync_failed'));
          if (addNotification) {
            await addNotification(
              user.id,
              t('task.sync_failed'),
              t('task.notif_update_sync_failed', { title: task.title }),
              'warning',
              '/tasks'
            );
          }
          setIsUpdating(false);
          return;
        }
      } else {
        // Offline: queue for later
        syncQueue.add({
          type: 'task_update',
          id: taskId,
          data: { taskId, status: newStatus }
        });
        setPendingCount(getPendingTaskCount());
        toast(t('task.status_updated_offline'));
        if (addNotification) {
          await addNotification(
            user.id,
            t('task.offline_update'),
            t('task.notif_offline_update', { title: task.title, status: newStatus.replace('_', ' ') }),
            'warning',
            '/tasks'
          );
        }
        setIsUpdating(false);
        return;
      }

      // 3. Online + server success → send notifications
      const assignedUser = users.find(u => u.employeeId === task.employeeId);
      if (assignedUser && addNotification && assignedUser.id !== user.id) {
        await addNotification(
          assignedUser.id,
          t('task.notif_status_updated'),
          t('task.notif_changed_by', { title: task.title, status: newStatus.replace('_', ' '), name: user.name }),
          'info',
          '/tasks'
        );
      }

      const manager = users.find(u => u.role === 'manager');
      if (manager && manager.id !== user.id && addNotification) {
        await addNotification(
          manager.id,
          t('task.notif_status_updated'),
          t('task.notif_manager_changed', { name: user.name, title: task.title, status: newStatus.replace('_', ' ') }),
          'info',
          '/tasks'
        );
      }

      toast(t('task.status_updated_success', { status: newStatus.replace('_', ' ') }));
    } catch (error) {
      console.error('Error updating task:', error);
      toast(t('task.error_updating', { message: error.message }));
    } finally {
      setIsUpdating(false);
    }
  };

  // ===== STYLING HELPERS =====
  const getStatusBadgeStyle = (status) => {
    const styles = {
      pending: { background: '#fef3c7', color: '#92400e' },
      in_progress: { background: '#dbeafe', color: '#1e40af' },
      completed: { background: '#d1fae5', color: '#065f37' }
    };
    return styles[status] || styles.pending;
  };

  const getPriorityBadgeStyle = (priority) => {
    const styles = {
      low: { background: '#d1fae5', color: '#065f37' },
      medium: { background: '#fef3c7', color: '#92400e' },
      high: { background: '#fee2e2', color: '#991b1b' }
    };
    return styles[priority] || styles.medium;
  };

  const displayTasks = getFilteredTasks();

  const taskStats = {
    total: displayTasks.length,
    pending: displayTasks.filter(t => t.status === 'pending').length,
    inProgress: displayTasks.filter(t => t.status === 'in_progress').length,
    completed: displayTasks.filter(t => t.status === 'completed').length
  };

  // ===== RENDER =====
  return (
    <div className="tasks-view" style={{ padding: '20px' }}>
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
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>📋 {t('header.page_titles.tasks')}</h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            {isManager ? t('task.hero_manage_all') : isSupervisor ? t('task.hero_manage_team') : t('task.hero_your_tasks')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{
            background: 'rgba(251,191,36,0.15)',
            border: '1px solid rgba(252,211,77,0.4)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {t('task.pending_count', { count: taskStats.pending })}
          </span>
          <span style={{
            background: 'rgba(96,165,250,0.2)',
            border: '1px solid rgba(147,197,253,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {t('task.in_progress_count', { count: taskStats.inProgress })}
          </span>
          <span style={{
            background: 'rgba(16,185,129,0.2)',
            border: '1px solid rgba(52,211,153,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {t('task.completed_count', { count: taskStats.completed })}
          </span>
          {pendingCount > 0 && (
            <span style={{
              background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(252,211,77,0.4)',
              padding: '6px 14px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              {t('task.pending_sync_count', { count: pendingCount })}
            </span>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px',
        background: isOnline ? '#d1fae5' : '#fee2e2',
        borderRadius: '8px',
        marginBottom: '16px',
        border: isOnline ? '1px solid #0b7e4b' : '1px solid #dc2626',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span style={{ fontWeight: '500', color: isOnline ? '#065f37' : '#991b1b' }}>
          {isOnline ? `✅ ${t('header.online')}` : `❌ ${t('header.offline')}`}
        </span>
        {pendingCount > 0 && (
          <span style={{
            background: '#f59e0b',
            color: 'white',
            padding: '2px 12px',
            borderRadius: '12px',
            fontSize: '12px'
          }}>
            {t('task.pending_sync', { count: pendingCount })}
          </span>
        )}
      </div>

      {/* Offline banner */}
      {!isOnline && (
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
          <span>{t('task.offline_banner')}</span>
          {pendingCount > 0 && (
            <span style={{
              background: '#f59e0b',
              color: 'white',
              padding: '2px 12px',
              borderRadius: '12px',
              fontSize: '12px'
            }}>
              {t('task.pending_sync', { count: pendingCount })}
            </span>
          )}
        </div>
      )}

      <div className="form-card" style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* Controls */}
        <div className="tasks-management" style={{ padding: '20px 24px' }}>
          <div className="tasks-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div className="tasks-filters">
              <select
                value={taskFilter}
                onChange={e => setTaskFilter(e.target.value)}
                className="filter-select"
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '13px',
                  background: 'white'
                }}
              >
                <option value="all">{t('task.all_tasks')} ({taskStats.total})</option>
                <option value="pending">{t('task.pending')} ({taskStats.pending})</option>
                <option value="in_progress">{t('task.in_progress')} ({taskStats.inProgress})</option>
                <option value="completed">{t('task.completed')} ({taskStats.completed})</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(isManager || isSupervisor) && (
                <button
                  className="btn-primary"
                  onClick={() => setShowModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#1e3a5f',
                    color: 'white',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {t('task.assign_task')} {!isOnline && '📴'}
                </button>
              )}
              {isOnline && pendingCount > 0 && (
                <button
                  onClick={() => window.dispatchEvent(new Event('force-sync'))}
                  style={{
                    background: '#0b7e4b',
                    color: 'white',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                >
                  {t('task.sync_now')}
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('task.table_task')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('task.assigned_to')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('common.region')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('task.deadline')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('task.priority_label')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('common.status')}</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('task.action')}</th>
                </tr>
              </thead>
              <tbody>
                {displayTasks.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-state" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                      <div style={{ fontSize: '48px', marginBottom: '8px' }}>📭</div>
                      <div>{t('task.no_tasks_found')}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        {isManager || isSupervisor ? t('task.no_tasks_hint') : t('task.no_tasks_for_you')}
                      </div>
                    </td>
                  </tr>
                )}
                {displayTasks.map(task => {
                  const assignedUser = users.find(u => u.employeeId === task.employeeId);
                  const isAssignedToMe = isOfficer && task.employeeId === user.employeeId;
                  const isAssignedToTeam = isSupervisor && teamMembers.some(m => m.employeeId === task.employeeId);
                  const canUpdate = isManager || isAssignedToMe || isAssignedToTeam;
                  const statusStyle = getStatusBadgeStyle(task.status);
                  const priorityStyle = getPriorityBadgeStyle(task.priority);

                  return (
                    <tr key={task.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <strong style={{ fontSize: '14px', color: '#1a1a2e' }}>{task.title}</strong>
                        {task.description && <div className="task-description" style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{task.description}</div>}
                        {task.assignedByName && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            {t('task.assigned_by')}: {task.assignedByName}
                          </div>
                        )}
                        {!task.synced && (
                          <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '4px' }}>📴 {t('header.offline')}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {assignedUser?.name || task.employeeId}
                        {isAssignedToMe && <span style={{ fontSize: '10px', color: '#1e3a5f', marginLeft: '4px' }}>({t('task.you')})</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{assignedUser?.region || t('task.na')}</td>
                      <td style={{ padding: '12px 16px', color: new Date(task.deadline) < new Date() && task.status !== 'completed' ? '#dc2626' : 'inherit' }}>
                        {task.deadline}
                        {new Date(task.deadline) < new Date() && task.status !== 'completed' && (
                          <span style={{ fontSize: '10px', color: '#dc2626', marginLeft: '4px' }}>{t('task.overdue')}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500',
                          ...priorityStyle
                        }}>
                          {t(`task.priority.${task.priority}`, { defaultValue: task.priority })}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500',
                          ...statusStyle
                        }}>
                          {t(`task.status.${task.status}`, { defaultValue: task.status.charAt(0).toUpperCase() + task.status.slice(1) })}
                        </span>
                        {!task.synced && task.status !== 'pending' && (
                          <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '4px' }}>📴</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {canUpdate ? (
                          <select
                            value={task.status}
                            onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                            disabled={isUpdating}
                            className="task-status-select"
                            style={{
                              padding: '4px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '12px',
                              background: 'white',
                              cursor: isUpdating ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <option value="pending">{t('task.pending')}</option>
                            <option value="in_progress">{t('task.in_progress')}</option>
                            <option value="completed">{t('task.completed')}</option>
                          </select>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>—</span>
                        )}
                        {!isOnline && canUpdate && (
                          <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '4px' }}>📴 {t('header.offline')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pendingCount > 0 && (
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid #e5e7eb',
              background: '#fef3c7',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              color: '#92400e',
              marginTop: '16px',
              borderRadius: '0 0 8px 8px'
            }}>
              <span>{t('task.tasks_pending_sync', { count: pendingCount })}</span>
              {isOnline && (
                <button
                  onClick={() => window.dispatchEvent(new Event('force-sync'))}
                  style={{
                    background: '#0b7e4b',
                    color: 'white',
                    border: 'none',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {t('task.sync_now')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
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
                {t('task.assign_new_task')}
                {!isOnline && <span style={{ fontSize: '12px', color: '#f59e0b', marginLeft: '8px' }}>📴 {t('header.offline')}</span>}
              </h3>
              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >×</button>
            </div>

            {!isOnline && (
              <div style={{
                padding: '12px 16px',
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <strong>📴 {t('auth.offline_mode')}:</strong> {t('task.offline_save_notice')}
                {pendingCount > 0 && (
                  <span style={{ marginLeft: '8px' }}>
                    ({t('task.pending_sync', { count: pendingCount })})
                  </span>
                )}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{t('task.assign_to')} *</label>
                <select
                  value={newTask.employeeId}
                  onChange={e => setNewTask({ ...newTask, employeeId: e.target.value })}
                  required
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    width: '100%',
                    background: 'white'
                  }}
                >
                  <option value="">{t('task.select_officer')}</option>
                  {(isManager ? users.filter(u => u.role === 'field_officer' || u.role === 'supervisor') : teamMembers).map(u => (
                    <option key={u.id} value={u.employeeId}>{u.name} ({u.region})</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{t('task.task_title')} *</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder={t('task.enter_task_title')}
                  required
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    width: '100%'
                  }}
                />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{t('task.description')}</label>
                <textarea
                  value={newTask.description}
                  onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder={t('task.enter_task_description')}
                  rows="3"
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    width: '100%',
                    resize: 'vertical',
                    minHeight: '60px'
                  }}
                />
              </div>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{t('task.deadline')} *</label>
                  <input
                    type="date"
                    value={newTask.deadline}
                    onChange={e => setNewTask({ ...newTask, deadline: e.target.value })}
                    required
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      width: '100%'
                    }}
                  />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{t('task.priority_label')}</label>
                  <select
                    value={newTask.priority}
                    onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      width: '100%',
                      background: 'white'
                    }}
                  >
                    <option value="low">{t('task.priority.low')}</option>
                    <option value="medium">{t('task.priority.medium')}</option>
                    <option value="high">{t('task.priority.high')}</option>
                  </select>
                </div>
              </div>
              <div style={{
                padding: '12px',
                background: !isOnline ? '#fef3c7' : '#dbeafe',
                borderRadius: '8px',
                fontSize: '13px',
                color: !isOnline ? '#92400e' : '#1e40af'
              }}>
                <strong>{isOnline ? '🟢' : '📴'} {isOnline ? t('header.online') : t('header.offline')}:</strong>
                {isOnline
                  ? ' ' + t('task.assign_immediately')
                  : ' ' + t('task.save_offline_notice')}
              </div>
              <div className="modal-actions" style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="submit"
                  className="btn-submit"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isOnline ? '#0b7e4b' : '#f59e0b',
                    color: 'white',
                    padding: '10px 24px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {isOnline ? t('task.assign_task') : '📴 ' + t('report.save_offline')}
                </button>
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowModal(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#e5e7eb',
                    color: '#374151',
                    padding: '10px 24px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskManagement;

