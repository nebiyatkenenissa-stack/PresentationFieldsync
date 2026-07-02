import React, { useState } from 'react';
import { uid } from '../../utils/helpers';
import { db } from '../../services/database';

function TaskManagement({ tasks, users, user, isManager, isSupervisor, isOfficer, teamMembers }) {
  const [showModal, setShowModal] = useState(false);
  const [taskFilter, setTaskFilter] = useState('all');
  const [newTask, setNewTask] = useState({
    employeeId: '',
    title: '',
    description: '',
    deadline: '',
    priority: 'medium'
  });

  const filteredTasks = tasks.filter(t => {
    if (isOfficer && user) return t.employeeId === user.employeeId;
    if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      return teamIds.includes(t.employeeId);
    }
    return true;
  }).filter(t => taskFilter === 'all' || t.status === taskFilter);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    const task = {
      id: uid(),
      employeeId: newTask.employeeId,
      assignedBy: user.employeeId,
      assignedByName: user.name,
      title: newTask.title,
      description: newTask.description,
      deadline: newTask.deadline,
      priority: newTask.priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    await db.tasks.add(task);
    setShowModal(false);
    setNewTask({ employeeId: '', title: '', description: '', deadline: '', priority: 'medium' });
    alert('✅ Task assigned successfully!');
  };

  const updateTaskStatus = async (taskId, status) => {
    await db.tasks.update(taskId, { 
      status, 
      completedAt: status === 'completed' ? new Date().toISOString() : null 
    });
  };

  return (
    <div className="tasks-view">
      <div className="form-card">
        <div className="form-header">
          <div>
            <h3>📋 Task Management</h3>
            <p>{isManager ? 'Manage all tasks' : isSupervisor ? 'Manage team tasks' : 'Your tasks'}</p>
          </div>
          <span className="form-badge">{filteredTasks.filter(t => t.status === 'completed').length} Completed</span>
        </div>

        <div className="tasks-management">
          <div className="tasks-header">
            <div className="tasks-filters">
              <select value={taskFilter} onChange={e => setTaskFilter(e.target.value)} className="filter-select">
                <option value="all">All Tasks</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
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
                  {(isManager || isSupervisor) && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={(isManager || isSupervisor) ? "7" : "6"} className="empty-state">
                      <div className="empty-icon">📋</div>
                      <div>No tasks found</div>
                    </td>
                  </tr>
                )}
                {filteredTasks.map(t => {
                  const assignedUser = users.find(u => u.employeeId === t.employeeId);
                  return (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.title}</strong>
                        <div className="task-description">{t.description}</div>
                      </td>
                      <td>{assignedUser?.name || t.employeeId}</td>
                      <td>{assignedUser?.region || 'N/A'}</td>
                      <td>{t.deadline}</td>
                      <td>
                        <span className={`priority-tag ${t.priority}`}>{t.priority}</span>
                      </td>
                      <td>
                        <span className={`task-status ${t.status}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      {(isManager || isSupervisor) && (
                        <td>
                          <select 
                            value={t.status} 
                            onChange={(e) => updateTaskStatus(t.id, e.target.value)}
                            className="task-status-select"
                            style={{
                              opacity: 1,
                              visibility: 'visible',
                              display: 'inline-block',
                              padding: '4px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '12px',
                              background: 'white'
                            }}
                          >
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                      )}
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
                  {(isManager ? users.filter(u => u.role === 'field_officer') : teamMembers).map(u => (
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
                  Assign Task
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