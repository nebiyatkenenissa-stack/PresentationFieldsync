import React, { useState, useEffect } from 'react';
import { uid } from '../../utils/helpers';
import { db } from '../../services/database';

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
  setTasks // Add this prop to update parent state
}) {
  const [showModal, setShowModal] = useState(false);
  const [taskFilter, setTaskFilter] = useState('all');
  const [newTask, setNewTask] = useState({
    employeeId: '',
    title: '',
    description: '',
    deadline: '',
    priority: 'medium'
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Filter tasks based on role and filter
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

  const handleCreateTask = async (e) => {
    e.preventDefault();
    
    if (!newTask.employeeId || !newTask.title || !newTask.deadline) {
      alert('Please fill all required fields');
      return;
    }

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
      updatedAt: new Date().toISOString()
    };

    try {
      // Add to IndexedDB
      await db.tasks.add(task);
      
      // Update parent state - FIX: Use setTasks from parent
      if (setTasks) {
        setTasks(prev => [task, ...prev]);
      }
      
      // Notify assigned user
      const assignedUser = users.find(u => u.employeeId === task.employeeId);
      if (assignedUser && addNotification) {
        await addNotification(
          assignedUser.id,
          '📋 New Task Assigned',
          `Task "${task.title}" has been assigned to you by ${user.name}`,
          'info'
        );
      }
      
      // Notify manager
      const manager = users.find(u => u.role === 'manager');
      if (manager && manager.id !== user.id && addNotification) {
        await addNotification(
          manager.id,
          '📋 Task Assigned',
          `${user.name} assigned task "${task.title}" to ${assignedUser?.name || 'an officer'}`,
          'info'
        );
      }

      setShowModal(false);
      setNewTask({ employeeId: '', title: '', description: '', deadline: '', priority: 'medium' });
      alert('✅ Task assigned successfully!');
    } catch (error) {
      console.error('Error creating task:', error);
      alert('❌ Error creating task: ' + error.message);
    }
  };

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

      // Check permissions
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

      const updatedTask = {
        ...task,
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date().toISOString() : task.completedAt,
        updatedAt: new Date().toISOString(),
        updatedBy: user.employeeId,
        updatedByName: user.name
      };

      await db.tasks.update(taskId, updatedTask);
      
      // Update parent state - FIX: Use setTasks from parent
      if (setTasks) {
        setTasks(prev => prev.map(t => 
          t.id === taskId ? updatedTask : t
        ));
      }

      // Notify the assigned user
      const assignedUser = users.find(u => u.employeeId === task.employeeId);
      if (assignedUser && addNotification && assignedUser.id !== user.id) {
        await addNotification(
          assignedUser.id,
          '📋 Task Status Updated',
          `Task "${task.title}" status changed to ${newStatus.replace('_', ' ')} by ${user.name}`,
          'info'
        );
      }

      // Notify manager
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

  // Get status badge color
  const getStatusBadgeStyle = (status) => {
    const styles = {
      pending: { background: '#fef3c7', color: '#92400e' },
      in_progress: { background: '#dbeafe', color: '#1e40af' },
      completed: { background: '#d1fae5', color: '#065f37' }
    };
    return styles[status] || styles.pending;
  };

  // Get priority badge color
  const getPriorityBadgeStyle = (priority) => {
    const styles = {
      low: { background: '#d1fae5', color: '#065f37' },
      medium: { background: '#fef3c7', color: '#92400e' },
      high: { background: '#fee2e2', color: '#991b1b' }
    };
    return styles[priority] || styles.medium;
  };

  const displayTasks = getFilteredTasks();

  // Count tasks by status
  const taskStats = {
    total: displayTasks.length,
    pending: displayTasks.filter(t => t.status === 'pending').length,
    inProgress: displayTasks.filter(t => t.status === 'in_progress').length,
    completed: displayTasks.filter(t => t.status === 'completed').length
  };

  return (
    <div className="tasks-view">
      <div className="form-card">
        <div className="form-header">
          <div>
            <h3>📋 Task Management</h3>
            <p>{isManager ? 'Manage all tasks' : isSupervisor ? 'Manage team tasks' : 'Your tasks'}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className="form-badge" style={{ background: '#fef3c7', color: '#92400e' }}>
              ⏳ {taskStats.pending} Pending
            </span>
            <span className="form-badge" style={{ background: '#dbeafe', color: '#1e40af' }}>
              🔄 {taskStats.inProgress} In Progress
            </span>
            <span className="form-badge" style={{ background: '#d1fae5', color: '#065f37' }}>
              ✅ {taskStats.completed} Completed
            </span>
          </div>
        </div>

        <div className="tasks-management">
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
                ➕ Assign Task
              </button>
            )}
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Assigned To</th>
                  <th>Region</th>
                  <th>Deadline</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayTasks.length === 0 && (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      <div className="empty-icon">📋</div>
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
                    <tr key={t.id}>
                      <td>
                        <strong>{t.title}</strong>
                        {t.description && <div className="task-description" style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{t.description}</div>}
                        {t.assignedByName && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                            Assigned by: {t.assignedByName}
                          </div>
                        )}
                      </td>
                      <td>
                        {assignedUser?.name || t.employeeId}
                        {isAssignedToMe && <span style={{ fontSize: '10px', color: '#1e3a5f', marginLeft: '4px' }}>(You)</span>}
                      </td>
                      <td>{assignedUser?.region || 'N/A'}</td>
                      <td style={{ color: new Date(t.deadline) < new Date() && t.status !== 'completed' ? '#dc2626' : 'inherit' }}>
                        {t.deadline}
                        {new Date(t.deadline) < new Date() && t.status !== 'completed' && (
                          <span style={{ fontSize: '10px', color: '#dc2626', marginLeft: '4px' }}>⚠️ Overdue</span>
                        )}
                      </td>
                      <td>
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
                      <td>
                        <span style={{
                          padding: '2px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500',
                          ...statusStyle
                        }}>
                          {t.status === 'in_progress' ? 'In Progress' : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                        </span>
                      </td>
                      <td>
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
            <div className="modal-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
              <h3 style={{fontSize: '20px', fontWeight: '600'}}>Assign New Task</h3>
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
                    background: '#0b7e4b',
                    color: 'white',
                    padding: '10px 24px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  ➕ Assign Task
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