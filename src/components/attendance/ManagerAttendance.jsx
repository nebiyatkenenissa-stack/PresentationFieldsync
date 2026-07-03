import React, { useState, useMemo } from 'react';
import { getToday } from '../../utils/helpers';
import { db } from '../../services/database';

function ManagerAttendance({ 
  attendance, 
  users, 
  setAttendance, 
  addNotification 
}) {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedSupervisor, setSelectedSupervisor] = useState('all');

  // Get all supervisors
  const supervisors = useMemo(() => {
    return users.filter(u => u.role === 'supervisor');
  }, [users]);

  // Filter attendance - only show records submitted by supervisors (submittedToManager = true)
  const filteredAttendance = useMemo(() => {
    let filtered = attendance.filter(a => a.date === selectedDate && a.submittedToManager === true);
    
    if (selectedRegion !== 'all') {
      filtered = filtered.filter(a => a.region === selectedRegion);
    }
    
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(a => a.status === selectedStatus);
    }

    if (selectedSupervisor !== 'all') {
      filtered = filtered.filter(a => a.supervisorId === selectedSupervisor);
    }
    
    return filtered;
  }, [attendance, selectedDate, selectedRegion, selectedStatus, selectedSupervisor]);

  const attendanceStats = useMemo(() => {
    const total = filteredAttendance.length;
    const present = filteredAttendance.filter(a => a.status === 'present').length;
    const late = filteredAttendance.filter(a => a.status === 'late').length;
    const absent = filteredAttendance.filter(a => a.status === 'absent').length;
    const halfDay = filteredAttendance.filter(a => a.status === 'half_day').length;
    const pendingApproval = filteredAttendance.filter(a => a.approved === false || a.approved === undefined).length;
    const seen = filteredAttendance.filter(a => a.seenByManager === true).length;
    const notSeen = filteredAttendance.filter(a => a.seenByManager !== true).length;
    
    return {
      total,
      present,
      late,
      absent,
      halfDay,
      pendingApproval,
      seen,
      notSeen,
      rate: total > 0 ? Math.round((present / total) * 100) : 0
    };
  }, [filteredAttendance]);

  const regions = useMemo(() => {
    const unique = new Set(attendance.filter(a => a.submittedToManager).map(a => a.region).filter(Boolean));
    return ['all', ...unique];
  }, [attendance]);

  // Mark attendance as seen by manager
  const markAsSeen = async (id) => {
    try {
      const record = attendance.find(a => a.id === id);
      if (!record || record.seenByManager) return;

      const updatedRecord = {
        ...record,
        seenByManager: true,
        seenAt: new Date().toISOString(),
        seenBy: 'manager'
      };

      await db.attendance.update(id, updatedRecord);
      setAttendance(prev => prev.map(a => a.id === id ? updatedRecord : a));

      // Notify supervisor that manager has seen their submission
      if (record.supervisorId && addNotification) {
        const supervisor = users.find(u => u.id === record.supervisorId);
        if (supervisor) {
          await addNotification(
            supervisor.id,
            '👁️ Attendance Seen by Manager',
            `Manager has reviewed attendance for ${record.employeeName} on ${record.date}`,
            'info'
          );
        }
      }

      // Notify the officer
      const officer = users.find(u => u.employeeId === record.employeeId);
      if (officer && addNotification) {
        await addNotification(
          officer.id,
          '👁️ Attendance Seen by Manager',
          `Manager has reviewed your attendance for ${record.date}`,
          'info'
        );
      }

    } catch (error) {
      console.error('Error marking as seen:', error);
    }
  };

  const approveAttendance = async (id, approve) => {
    try {
      const record = attendance.find(a => a.id === id);
      if (!record) return;

      const updatedRecord = {
        ...record,
        approved: approve,
        approvedBy: 'manager',
        approvedAt: new Date().toISOString(),
        managerNotes: approve ? 'Approved by Manager' : 'Rejected by Manager',
        seenByManager: true,
        seenAt: new Date().toISOString()
      };

      await db.attendance.update(id, updatedRecord);
      setAttendance(prev => prev.map(a => a.id === id ? updatedRecord : a));
      
      // Notify the supervisor
      if (record.supervisorId && addNotification) {
        const supervisor = users.find(u => u.id === record.supervisorId);
        if (supervisor) {
          await addNotification(
            supervisor.id,
            approve ? '✅ Attendance Approved' : '❌ Attendance Rejected',
            `Manager has ${approve ? 'approved' : 'rejected'} attendance for ${record.employeeName} on ${record.date}`,
            approve ? 'success' : 'error'
          );
        }
      }

      // Notify the officer
      const officer = users.find(u => u.employeeId === record.employeeId);
      if (officer && addNotification) {
        await addNotification(
          officer.id,
          approve ? '✅ Attendance Approved' : '❌ Attendance Rejected',
          `Your attendance on ${record.date} has been ${approve ? 'approved ✅' : 'rejected ❌'} by Manager`,
          approve ? 'success' : 'error'
        );
      }
      
      alert(`Attendance ${approve ? 'approved' : 'rejected'} successfully!`);
    } catch (error) {
      console.error('Error updating attendance:', error);
      alert('Error updating attendance: ' + error.message);
    }
  };

  const getSupervisorName = (supervisorId) => {
    const supervisor = users.find(u => u.id === supervisorId);
    return supervisor ? supervisor.name : 'N/A';
  };

  const getStatusBadge = (status) => {
    const styles = {
      present: { background: '#d1fae5', color: '#065f37' },
      late: { background: '#fef3c7', color: '#92400e' },
      absent: { background: '#fee2e2', color: '#991b1b' },
      half_day: { background: '#fde68a', color: '#78350f' },
      pending: { background: '#e5e7eb', color: '#374151' }
    };
    const style = styles[status] || styles.pending;
    return { ...style, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500' };
  };

  return (
    <div className="attendance-management">
      <div className="form-card">
        <div className="form-header">
          <div>
            <h3>📋 Manager Attendance Review</h3>
            <p>Review attendance submitted by supervisors</p>
          </div>
          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
            <span className="form-badge" style={{background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'}}>
              ⏳ {attendanceStats.pendingApproval} Pending Approval
            </span>
            <span className="form-badge" style={{background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'}}>
              👁️ {attendanceStats.seen} Seen
            </span>
            <span className="form-badge" style={{background: '#fee2e2', color: '#991b1b', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'}}>
              👁️‍🗨️ {attendanceStats.notSeen} Not Seen
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="attendance-stats" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px'}}>
          <div className="stat-card" style={{borderLeft: '4px solid #0b7e4b', padding: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
            <div className="stat-value" style={{fontSize: '24px', fontWeight: 'bold', color: '#0b7e4b'}}>{attendanceStats.present}</div>
            <div className="stat-label" style={{fontSize: '12px', color: '#64748b'}}>✅ Present</div>
          </div>
          <div className="stat-card" style={{borderLeft: '4px solid #d97706', padding: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
            <div className="stat-value" style={{fontSize: '24px', fontWeight: 'bold', color: '#d97706'}}>{attendanceStats.late}</div>
            <div className="stat-label" style={{fontSize: '12px', color: '#64748b'}}>⏰ Late</div>
          </div>
          <div className="stat-card" style={{borderLeft: '4px solid #dc2626', padding: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
            <div className="stat-value" style={{fontSize: '24px', fontWeight: 'bold', color: '#dc2626'}}>{attendanceStats.absent}</div>
            <div className="stat-label" style={{fontSize: '12px', color: '#64748b'}}>❌ Absent</div>
          </div>
          <div className="stat-card" style={{borderLeft: '4px solid #6b7280', padding: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
            <div className="stat-value" style={{fontSize: '24px', fontWeight: 'bold', color: '#6b7280'}}>{attendanceStats.halfDay}</div>
            <div className="stat-label" style={{fontSize: '12px', color: '#64748b'}}>📊 Half Day</div>
          </div>
          <div className="stat-card" style={{borderLeft: '4px solid #f59e0b', padding: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
            <div className="stat-value" style={{fontSize: '24px', fontWeight: 'bold', color: '#f59e0b'}}>{attendanceStats.pendingApproval}</div>
            <div className="stat-label" style={{fontSize: '12px', color: '#64748b'}}>⏳ Pending</div>
          </div>
        </div>

        {/* Filters */}
        <div className="attendance-filters" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px'}}>
          <div className="filter-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Date</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
            />
          </div>
          <div className="filter-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Region</label>
            <select 
              value={selectedRegion} 
              onChange={e => setSelectedRegion(e.target.value)}
              style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
            >
              {regions.map(r => (
                <option key={r} value={r}>{r === 'all' ? 'All Regions' : r}</option>
              ))}
            </select>
          </div>
          <div className="filter-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Status</label>
            <select 
              value={selectedStatus} 
              onChange={e => setSelectedStatus(e.target.value)}
              style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="half_day">Half Day</option>
            </select>
          </div>
          <div className="filter-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
            <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Supervisor</label>
            <select 
              value={selectedSupervisor} 
              onChange={e => setSelectedSupervisor(e.target.value)}
              style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
            >
              <option value="all">All Supervisors</option>
              {supervisors.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="table-wrapper" style={{overflowX: 'auto'}}>
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '13px'}}>
            <thead>
              <tr style={{background: '#f8fafc', borderBottom: '2px solid #e2e8f0'}}>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Employee</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Region</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Supervisor</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Date</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Status</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Check In</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Check Out</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Hours</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Submitted By</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Seen Status</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Approval Status</th>
                <th style={{padding: '10px', textAlign: 'left', fontWeight: '600', color: '#475569'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendance.length === 0 && (
                <tr>
                  <td colSpan="12" className="empty-state" style={{textAlign: 'center', padding: '40px', color: '#94a3b8'}}>
                    <div className="empty-icon" style={{fontSize: '40px', marginBottom: '8px'}}>📋</div>
                    <div>No attendance records submitted by supervisors</div>
                  </td>
                </tr>
              )}
              {filteredAttendance.map(a => (
                <tr key={a.id} style={{
                  borderBottom: '1px solid #e2e8f0',
                  background: a.seenByManager ? 'white' : '#fef9e7'
                }}>
                  <td style={{padding: '10px'}}><strong>{a.employeeName}</strong></td>
                  <td style={{padding: '10px'}}>{a.region || 'N/A'}</td>
                  <td style={{padding: '10px'}}>{getSupervisorName(a.supervisorId)}</td>
                  <td style={{padding: '10px'}}>{a.date}</td>
                  <td style={{padding: '10px'}}>
                    <span style={getStatusBadge(a.status)}>
                      {a.status || 'Not Marked'}
                    </span>
                  </td>
                  <td style={{padding: '10px'}}>{a.checkIn || '--'}</td>
                  <td style={{padding: '10px'}}>{a.checkOut || '--'}</td>
                  <td style={{padding: '10px'}}><strong>{a.workHours || 0}h</strong></td>
                  <td style={{padding: '10px'}}>{a.updatedByName || a.supervisorName || 'N/A'}</td>
                  <td style={{padding: '10px'}}>
                    {a.seenByManager ? (
                      <span style={{color: '#0b7e4b', fontSize: '14px', fontWeight: '600'}}>✅ Seen</span>
                    ) : (
                      <span style={{color: '#dc2626', fontSize: '14px', fontWeight: '600'}}>🔴 Not Seen</span>
                    )}
                  </td>
                  <td style={{padding: '10px'}}>
                    {a.approved ? (
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: '#d1fae5',
                        color: '#065f37'
                      }}>✅ Approved</span>
                    ) : (
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: '#fef3c7',
                        color: '#92400e'
                      }}>⏳ Pending</span>
                    )}
                  </td>
                  <td style={{padding: '10px'}}>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px'}}>
                      {/* Mark as Seen button - only show if not seen */}
                      {!a.seenByManager && (
                        <button 
                          className="btn-sm btn-seen"
                          onClick={() => markAsSeen(a.id)}
                          style={{
                            background: '#1e3a5f',
                            color: 'white',
                            border: 'none',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          👁️ Mark as Seen
                        </button>
                      )}
                      {/* Approve/Reject buttons - only show if not approved */}
                      {!a.approved && (
                        <>
                          <button 
                            className="btn-sm btn-approve"
                            onClick={() => approveAttendance(a.id, true)}
                            style={{
                              background: '#0b7e4b',
                              color: 'white',
                              border: 'none',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            ✅ Approve
                          </button>
                          <button 
                            className="btn-sm btn-reject"
                            onClick={() => approveAttendance(a.id, false)}
                            style={{
                              background: '#dc2626',
                              color: 'white',
                              border: 'none',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            ❌ Reject
                          </button>
                        </>
                      )}
                      {a.approved && (
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          background: '#d1fae5',
                          color: '#065f37',
                          fontWeight: '500'
                        }}>
                          ✅ Done
                        </span>
                      )}
                    </div>
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

export default ManagerAttendance;