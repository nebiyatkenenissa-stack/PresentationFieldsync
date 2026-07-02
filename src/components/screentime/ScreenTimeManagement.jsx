import React, { useState, useMemo } from 'react';
import { formatTime } from '../../utils/helpers';
import { db } from '../../services/database';

function ScreenTimeManagement({ 
  screenTime, 
  user, 
  isManager, 
  isSupervisor, 
  isOfficer,
  teamMembers,
  addNotification,
  setScreenTime 
}) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Get filtered screen time based on role
  const filteredScreenTime = useMemo(() => {
    let filtered = [...screenTime];

    // Filter by date
    if (selectedDate) {
      filtered = filtered.filter(s => s.date === selectedDate);
    }

    // Filter by role
    if (isOfficer && user) {
      filtered = filtered.filter(s => s.employeeId === user.employeeId);
    } else if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      filtered = filtered.filter(s => teamIds.includes(s.employeeId) || s.employeeId === user.employeeId);
    } else if (isManager) {
      // Manager sees all
      if (selectedEmployee !== 'all') {
        filtered = filtered.filter(s => s.employeeId === selectedEmployee);
      }
    }

    // Filter by status (exceeded/normal)
    if (selectedStatus === 'exceeded') {
      filtered = filtered.filter(s => (s.totalScreenTime || 0) > (s.screenTimeLimit || 8 * 3600));
    } else if (selectedStatus === 'normal') {
      filtered = filtered.filter(s => (s.totalScreenTime || 0) <= (s.screenTimeLimit || 8 * 3600));
    }

    return filtered;
  }, [screenTime, user, isOfficer, isSupervisor, isManager, teamMembers, selectedDate, selectedEmployee, selectedStatus]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = filteredScreenTime.length;
    const exceeded = filteredScreenTime.filter(s => (s.totalScreenTime || 0) > (s.screenTimeLimit || 8 * 3600)).length;
    const normal = filteredScreenTime.filter(s => (s.totalScreenTime || 0) <= (s.screenTimeLimit || 8 * 3600)).length;
    const totalHours = filteredScreenTime.reduce((sum, s) => sum + (s.totalScreenTime || 0), 0);
    const avgTrust = total > 0 ? Math.round(filteredScreenTime.reduce((sum, s) => sum + (s.trustScore || 0), 0) / total) : 0;
    
    return { total, exceeded, normal, totalHours, avgTrust };
  }, [filteredScreenTime]);

  // Get employee list for manager filter
  const employeeOptions = useMemo(() => {
    if (!isManager) return [];
    const unique = new Set();
    const employees = [];
    screenTime.forEach(s => {
      if (!unique.has(s.employeeId)) {
        unique.add(s.employeeId);
        employees.push({ employeeId: s.employeeId, employeeName: s.employeeName });
      }
    });
    return employees;
  }, [screenTime, isManager]);

  // Handle setting screen time limit (Manager only)
  const handleSetLimit = async (screenTimeId, currentLimit) => {
    if (!isManager) return;
    
    const newLimit = window.prompt('Enter new screen time limit (hours):', currentLimit || 8);
    if (newLimit !== null) {
      const limit = parseInt(newLimit);
      if (limit >= 4 && limit <= 12) {
        try {
          await db.screen_time.update(screenTimeId, { 
            screenTimeLimit: limit * 3600,
            verified: true,
            verifiedBy: user.employeeId
          });
          
          // Update local state
          if (setScreenTime) {
            const updated = screenTime.map(s => 
              s.id === screenTimeId ? { ...s, screenTimeLimit: limit * 3600, verified: true, verifiedBy: user.employeeId } : s
            );
            setScreenTime(updated);
          }
          
          if (addNotification) {
            addNotification(user.id, '📱 Screen Time Limit Updated', `Screen time limit updated to ${limit}h`, 'success');
          }
          alert(`✅ Screen time limit updated to ${limit} hours!`);
        } catch (error) {
          console.error('Error updating screen time limit:', error);
          alert('❌ Error updating screen time limit');
        }
      } else {
        alert('Please enter a value between 4 and 12 hours');
      }
    }
  };

  // Format total hours
  const formatTotalHours = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="screentime-management">
      <div className="form-card">
        <div className="form-header">
          <div>
            <h3>📱 Screen Time Control</h3>
            <p>
              {isManager ? 'Monitor all officers work time' : 
               isSupervisor ? 'Monitor team members work time' : 
               'Your screen time'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className="form-badge" style={{ background: '#fef3c7', color: '#92400e' }}>
              ⏱️ {stats.exceeded} Exceeded
            </span>
            <span className="form-badge" style={{ background: '#d1fae5', color: '#065f37' }}>
              ✅ {stats.normal} Normal
            </span>
            <span className="form-badge" style={{ background: '#dbeafe', color: '#1e40af' }}>
              📊 {stats.total} Total
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid" style={{ marginBottom: '16px' }}>
          <div className="stat-card" style={{ borderLeftColor: '#1e3a5f' }}>
            <div className="stat-icon" style={{ background: '#e8edf5' }}>⏱️</div>
            <div className="stat-info">
              <div className="stat-value">{formatTotalHours(stats.totalHours)}</div>
              <div className="stat-label">Total Work Time</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#0b7e4b' }}>
            <div className="stat-icon" style={{ background: '#d1fae5' }}>✅</div>
            <div className="stat-info">
              <div className="stat-value">{stats.normal}</div>
              <div className="stat-label">Within Limit</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#dc2626' }}>
            <div className="stat-icon" style={{ background: '#fee2e2' }}>⚠️</div>
            <div className="stat-info">
              <div className="stat-value">{stats.exceeded}</div>
              <div className="stat-label">Exceeded Limit</div>
            </div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#7c3aed' }}>
            <div className="stat-icon" style={{ background: '#ede9fe' }}>🎯</div>
            <div className="stat-info">
              <div className="stat-value">{stats.avgTrust}%</div>
              <div className="stat-label">Avg Trust Score</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="attendance-filters" style={{ 
          display: 'flex', 
          gap: '16px', 
          flexWrap: 'wrap', 
          marginBottom: '16px',
          padding: '16px',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#64748b' }}>Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ 
                padding: '6px 12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px', 
                fontSize: '13px',
                opacity: 1,
                visibility: 'visible'
              }}
            />
          </div>

          {isManager && (
            <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#64748b' }}>Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                style={{ 
                  padding: '6px 12px', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '6px', 
                  fontSize: '13px',
                  opacity: 1,
                  visibility: 'visible',
                  background: 'white'
                }}
              >
                <option value="all">All Employees</option>
                {employeeOptions.map(emp => (
                  <option key={emp.employeeId} value={emp.employeeId}>{emp.employeeName}</option>
                ))}
              </select>
            </div>
          )}

          <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: '500', color: '#64748b' }}>Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{ 
                padding: '6px 12px', 
                border: '1px solid #d1d5db', 
                borderRadius: '6px', 
                fontSize: '13px',
                opacity: 1,
                visibility: 'visible',
                background: 'white'
              }}
            >
              <option value="all">All Status</option>
              <option value="normal">✅ Within Limit</option>
              <option value="exceeded">⚠️ Exceeded</option>
            </select>
          </div>

          <div className="filter-group" style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'flex-end' }}>
            <span className="attendance-count" style={{ fontSize: '13px', color: '#64748b' }}>
              {filteredScreenTime.length} records
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Login</th>
                <th>Logout</th>
                <th>Total Time</th>
                <th>Limit</th>
                <th>Status</th>
                <th>Trust Score</th>
                {(isManager || isSupervisor) && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredScreenTime.length === 0 ? (
                <tr>
                  <td colSpan={(isManager || isSupervisor) ? "9" : "8"} className="empty-state">
                    <div className="empty-icon">📱</div>
                    <div>No screen time records found</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      {selectedDate ? `No records for ${selectedDate}` : 'Select a date to view records'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredScreenTime.map(s => {
                  const totalSecs = s.totalScreenTime || 0;
                  const formattedTime = formatTime(totalSecs);
                  const limitHours = Math.floor((s.screenTimeLimit || 8 * 3600) / 3600);
                  const isExceeded = totalSecs > (s.screenTimeLimit || 8 * 3600);
                  
                  return (
                    <tr key={s.id} className={isExceeded ? 'exceeded-row' : ''}>
                      <td>
                        <strong>{s.employeeName}</strong>
                        {s.employeeId === user?.employeeId && (
                          <span style={{ fontSize: '11px', color: '#6b7f94', marginLeft: '6px' }}>(You)</span>
                        )}
                      </td>
                      <td>{s.date}</td>
                      <td>{s.loginTime || '--'}</td>
                      <td>{s.logoutTime || '--'}</td>
                      <td>
                        <span className={`screen-time ${isExceeded ? 'exceeded' : 'normal'}`}>
                          {formattedTime}
                        </span>
                      </td>
                      <td>{limitHours}h</td>
                      <td>
                        {s.isLoggedIn ? (
                          <span className="status-badge online">🟢 Active</span>
                        ) : s.logoutTime ? (
                          <span className={`status-badge ${isExceeded ? 'exceeded' : 'offline'}`}>
                            {isExceeded ? '⚠️ Exceeded' : '🔴 Completed'}
                          </span>
                        ) : (
                          <span className="status-badge away">⚪ Not Started</span>
                        )}
                      </td>
                      <td>
                        <span className={`trust-score ${s.trustScore >= 80 ? 'high' : s.trustScore >= 60 ? 'medium' : 'low'}`}>
                          {s.trustScore || 0}%
                        </span>
                      </td>
                      {(isManager || isSupervisor) && (
                        <td>
                          <button
                            className="btn-sm btn-approve"
                            onClick={() => handleSetLimit(s.id, limitHours)}
                            style={{
                              background: '#1e3a5f',
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
                            Set Limit
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ScreenTimeManagement;