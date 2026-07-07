// components/tasks/TaskManagement.js

import React, { useState, useEffect } from 'react';
import { uid } from '../../utils/helpers';
import { db } from '../../services/database';
import { syncQueue, checkRealInternet } from '../../services/database';

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
  useEffect(() => {
    const checkNetwork = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
      setPendingCount(syncQueue.count());
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 5000);

    const handleQueueUpdate = () => {
      setPendingCount(syncQueue.count());
    };

    window.addEventListener('sync-queue-updated', handleQueueUpdate);
    window.addEventListener('sync-complete', handleQueueUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sync-queue-updated', handleQueueUpdate);
      window.removeEventListener('sync-complete', handleQueueUpdate);
    };
  }, []);

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

  // ===== CREATE TASK (OFFLINE SUPPORT) =====
  const handleCreateTask = async (e) => {
    e.preventDefault();
    
    if (!newTask.employeeId || !newTask.title || !newTask.deadline) {
      alert('Please fill all required fields');
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
      await db.tasks.add(task);
      
      if (setTasks) {
        setTasks(prev => [task, ...prev]);
      }

      if (!online) {
        syncQueue.add({
          type: 'task',
          id: task.id,
          data: task
        });
        setPendingCount(syncQueue.count());
        alert('📋 Task saved OFFLINE! Will sync when online.');
        
        if (addNotification) {
          await addNotification(
            user.id,
            '💾 Offline Save',
            `Task "${task.title}" saved offline. Will sync when online.`,
            'warning'
          );
        }
      } else {
        const assignedUser = users.find(u => u.employeeId === task.employeeId);
        if (assignedUser && addNotification) {
          await addNotification(
            assignedUser.id,
            '📋 New Task Assigned',
            `Task "${task.title}" has been assigned to you by ${user.name}`,
            'info'
          );
        }
        alert('✅ Task assigned successfully!');
      }

      setShowModal(false);
      setNewTask({ employeeId: '', title: '', description: '', deadline: '', priority: 'medium' });
    } catch (error) {
      console.error('Error creating task:', error);
      alert('❌ Error creating task: ' + error.message);
    }
  };

  // ===== UPDATE TASK STATUS (OFFLINE SUPPORT) =====
  const updateTaskStatus = async (taskId, newStatus) => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        alert('Task not found');
        setIsUpdating(false);
        return;
      }

      // Permission checks
      if (isOfficer && task.employeeId !== user.employeeId) {
        alert('You can only update your own tasks');
        setIsUpdating(false);
        return;
      }

      if (isSupervisor) {
        const teamIds = teamMembers.map(m => m.employeeId);
        if (!teamIds.includes(task.employeeId) && task.employeeId !== user.employeeId) {
          alert('You can only update tasks for your team members');
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

      await db.tasks.update(taskId, updatedTask);
      
      if (setTasks) {
        setTasks(prev => prev.map(t => 
          t.id === taskId ? updatedTask : t
        ));
      }

      if (!online) {
        syncQueue.add({
          type: 'task_update',
          id: taskId,
          data: { taskId, status: newStatus }
        });
        setPendingCount(syncQueue.count());
        alert(`📋 Task status updated OFFLINE! Will sync when online.`);
        
        if (addNotification) {
          await addNotification(
            user.id,
            '💾 Offline Update',
            `Task "${task.title}" status changed to ${newStatus.replace('_', ' ')} offline.`,
            'warning'
          );
        }
        
        setIsUpdating(false);
        return;
      }

      // Online - send notifications
      const assignedUser = users.find(u => u.employeeId === task.employeeId);
      if (assignedUser && addNotification && assignedUser.id !== user.id) {
        await addNotification(
          assignedUser.id,
          '📋 Task Status Updated',
          `Task "${task.title}" status changed to ${newStatus.replace('_', ' ')} by ${user.name}`,
          'info'
        );
      }

      const manager = users.find(u => u.role === 'manager');
      if (manager && manager.id !== user.id && addNotification) {
        await addNotification(
          manager.id,
          '📋 Task Status Updated',
          `${user.name} updated task "${task.title}" to ${newStatus.replace('_', ' ')}`,
          'info'
        );
      }

      alert(`✅ Task status updated to ${newStatus.replace('_', ' ')} successfully!`);
    } catch (error) {
      console.error('Error updating task:', error);
      alert('❌ Error updating task: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

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

  return (
    <div className="tasks-view" style={{ padding: '20px' }}>
      {/* ===== STATUS BAR ===== */}
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
          {isOnline ? '✅ Online' : '❌ Offline'}
        </span>
        {pendingCount > 0 && (
          <span style={{
            background: '#f59e0b',
            color: 'white',
            padding: '2px 12px',
            borderRadius: '12px',
            fontSize: '12px'
          }}>
            ⏳ {pendingCount} pending sync
          </span>
        )}
      </div>

      {/* ===== OFFLINE BANNER ===== */}
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
          <span>📡 You are offline. Tasks will be saved and synced when online.</span>
          {pendingCount > 0 && (
            <span style={{
              background: '#f59e0b',
              color: 'white',
              padding: '2px 12px',
              borderRadius: '12px',
              fontSize: '12px'
            }}>
              {pendingCount} pending sync
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
        <div className="form-header" style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>📋 Task Management</h3>
            <p style={{ margin: '4px 0 0 0', color: '#6b7280', fontSize: '14px' }}>
              {isManager ? 'Manage all tasks' : isSupervisor ? 'Manage team tasks' : 'Your tasks'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className="form-badge" style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
              ⏳ {taskStats.pending} Pending
            </span>
            <span className="form-badge" style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
              🔄 {taskStats.inProgress} In Progress
            </span>
            <span className="form-badge" style={{ background: '#d1fae5', color: '#065f37', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
              ✅ {taskStats.completed} Completed
            </span>
            {pendingCount > 0 && (
              <span className="form-badge" style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' }}>
                📡 {pendingCount} pending
              </span>
            )}
          </div>
        </div>

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
                  background: 'white',
                  opacity: 1,
                  visibility: 'visible'
                }}
              >
                <option value="all">All Tasks ({taskStats.total})</option>
                <option value="pending">⏳ Pending ({taskStats.pending})</option>
                <option value="in_progress">🔄 In Progress ({taskStats.inProgress})</option>
                <option value="completed">✅ Completed ({taskStats.completed})</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(isManager || isSupervisor) && (
                <button 
                  className="btn-primary" 
                  onClick={() => setShowModal(true)}
                  style={{
                    opacity: 1,
                    visibility: 'visible',
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
                  ➕ Assign Task {!isOnline && '📡'}
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
                  🔄 Sync Now
                </button>
              )}
            </div>
          </div>

          <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Task</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned To</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Region</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deadline</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Priority</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayTasks.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-state" style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
                      <div style={{ fontSize: '48px', marginBottom: '8px' }}>📋</div>
                      <div>No tasks found</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                        {isManager || isSupervisor ? 'Click "Assign Task" to create a new task' : 'No tasks assigned to you yet'}
                      </div>
                    </td>
                  </tr>
                )}
                {displayTasks.map(t => {
                  const assignedUser = users.find(u => u.employeeId === t.employeeId);
                  const isAssignedToMe = isOfficer && t.employeeId === user.employeeId;
                  const isAssignedToTeam = isSupervisor && teamMembers.some(m => m.employeeId === t.employeeId);
                  const canUpdate = isManager || isAssignedToMe || isAssignedToTeam;
                  const statusStyle = getStatusBadgeStyle(t.status);
                  const priorityStyle = getPriorityBadgeStyle(t.priority);

                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <strong style={{ fontSize: '14px', color: '#1a1a2e' }}>{t.title}</strong>
                        {t.description && <div className="task-description" style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{t.description}</div>}
                        {t.assignedByName && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Assigned by: {t.assignedByName}
                          </div>
                        )}
                        {!t.synced && (
                          <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '4px' }}>📡 Offline</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {assignedUser?.name || t.employeeId}
                        {isAssignedToMe && <span style={{ fontSize: '10px', color: '#1e3a5f', marginLeft: '4px' }}>(You)</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{assignedUser?.region || 'N/A'}</td>
                      <td style={{ padding: '12px 16px', color: new Date(t.deadline) < new Date() && t.status !== 'completed' ? '#dc2626' : 'inherit' }}>
                        {t.deadline}
                        {new Date(t.deadline) < new Date() && t.status !== 'completed' && (
                          <span style={{ fontSize: '10px', color: '#dc2626', marginLeft: '4px' }}>⚠️ Overdue</span>
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
                          {t.priority}
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
                          {t.status === 'in_progress' ? 'In Progress' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                        </span>
                        {!t.synced && t.status !== 'pending' && (
                          <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '4px' }}>📡</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {canUpdate ? (
                          <select 
                            value={t.status} 
                            onChange={(e) => updateTaskStatus(t.id, e.target.value)}
                            disabled={isUpdating}
                            className="task-status-select"
                            style={{
                              opacity: 1,
                              visibility: 'visible',
                              display: 'inline-block',
                              padding: '4px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '12px',
                              background: 'white',
                              cursor: isUpdating ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <option value="pending">⏳ Pending</option>
                            <option value="in_progress">🔄 In Progress</option>
                            <option value="completed">✅ Completed</option>
                          </select>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>—</span>
                        )}
                        {!isOnline && canUpdate && (
                          <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '4px' }}>📡 Offline</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer with pending count */}
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
              <span>⏳ {pendingCount} task(s) pending sync</span>
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
                  🔄 Sync Now
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== MODAL ===== */}
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
            <div className="modal-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h3 style={{fontSize: '20px', fontWeight: '600'}}>
                Assign New Task
                {!isOnline && <span style={{fontSize: '12px', color: '#f59e0b', marginLeft: '8px'}}>📡 Offline</span>}
              </h3>
              <button 
                className="modal-close" 
                onClick={() => setShowModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#64748b',
                  opacity: 1,
                  visibility: 'visible'
                }}
              >✕</button>
            </div>

            {/* Offline Warning in Modal */}
            {!isOnline && (
              <div style={{
                padding: '12px 16px',
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <strong>📡 Offline Mode:</strong> Task will be saved locally and synced automatically when online.
                {pendingCount > 0 && (
                  <span style={{ marginLeft: '8px' }}>
                    ({pendingCount} pending sync)
                  </span>
                )}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="modal-form" style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Assign To *</label>
                <select 
                  value={newTask.employeeId} 
                  onChange={e => setNewTask({...newTask, employeeId: e.target.value})}
                  required
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%',
                    background: 'white'
                  }}
                >
                  <option value="">Select Officer</option>
                  {(isManager ? users.filter(u => u.role === 'field_officer' || u.role === 'supervisor') : teamMembers).map(u => (
                    <option key={u.id} value={u.employeeId}>{u.name} ({u.region})</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Task Title *</label>
                <input 
                  type="text" 
                  value={newTask.title} 
                  onChange={e => setNewTask({...newTask, title: e.target.value})}
                  placeholder="Enter task title" 
                  required 
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%'
                  }}
                />
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Description</label>
                <textarea 
                  value={newTask.description} 
                  onChange={e => setNewTask({...newTask, description: e.target.value})}
                  placeholder="Enter task description" 
                  rows="3"
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'block',
                    width: '100%',
                    resize: 'vertical',
                    minHeight: '60px'
                  }}
                />
              </div>
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Deadline *</label>
                  <input 
                    type="date" 
                    value={newTask.deadline} 
                    onChange={e => setNewTask({...newTask, deadline: e.target.value})}
                    required
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: 1,
                      visibility: 'visible',
                      display: 'block',
                      width: '100%'
                    }}
                  />
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Priority</label>
                  <select 
                    value={newTask.priority} 
                    onChange={e => setNewTask({...newTask, priority: e.target.value})}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      opacity: 1,
                      visibility: 'visible',
                      display: 'block',
                      width: '100%',
                      background: 'white'
                    }}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
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
                <strong>ℹ️ {isOnline ? 'Online' : 'Offline'}:</strong>
                {isOnline 
                  ? ' This task will be assigned immediately.' 
                  : ' This task will be saved offline and synced when online.'}
              </div>
              <div className="modal-actions" style={{display: 'flex', gap: '12px', marginTop: '8px'}}>
                <button 
                  type="submit" 
                  className="btn-submit"
                  style={{
                    opacity: 1,
                    visibility: 'visible',
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
                  {isOnline ? '➕ Assign Task' : '💾 Save Offline'}
                </button>
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setShowModal(false)}
                  style={{
                    opacity: 1,
                    visibility: 'visible',
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
                  Cancel
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