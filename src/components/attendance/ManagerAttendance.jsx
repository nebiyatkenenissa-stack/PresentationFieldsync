import React, { useState, useMemo } from 'react';
import { getToday } from '../../utils/helpers';

function ManagerAttendance({ 
  attendance, 
  users, 
  setAttendance, 
  addNotification 
}) {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const filteredAttendance = useMemo(() => {
    let filtered = attendance.filter(a => a.date === selectedDate);
    
    if (selectedRegion !== 'all') {
      filtered = filtered.filter(a => a.region === selectedRegion);
    }
    
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(a => a.status === selectedStatus);
    }
    
    return filtered;
  }, [attendance, selectedDate, selectedRegion, selectedStatus]);

  const attendanceStats = useMemo(() => {
    const total = filteredAttendance.length;
    const present = filteredAttendance.filter(a => a.status === 'present').length;
    const late = filteredAttendance.filter(a => a.status === 'late').length;
    const absent = filteredAttendance.filter(a => a.status === 'absent').length;
    const halfDay = filteredAttendance.filter(a => a.status === 'half_day').length;
    
    return {
      total,
      present,
      late,
      absent,
      halfDay,
      rate: total > 0 ? Math.round((present / total) * 100) : 0
    };
  }, [filteredAttendance]);

  const regions = useMemo(() => {
    const unique = new Set(attendance.map(a => a.region).filter(Boolean));
    return ['all', ...unique];
  }, [attendance]);

  const approveAttendance = async (id, approve) => {
    try {
      const record = attendance.find(a => a.id === id);
      if (!record) return;

      const updatedRecord = {
        ...record,
        approved: approve,
        approvedBy: 'manager',
        approvedAt: new Date().toISOString()
      };

      await db.attendance.update(id, updatedRecord);
      setAttendance(prev => prev.map(a => a.id === id ? updatedRecord : a));
      
      const officer = users.find(u => u.employeeId === record.employeeId);
      if (officer && addNotification) {
        addNotification(
          officer.id,
          'Attendance Approved',
          `Your attendance on ${record.date} has been ${approve ? 'approved ✅' : 'rejected ❌'}`,
          approve ? 'success' : 'error'
        );
      }
      
      alert(`Attendance ${approve ? 'approved' : 'rejected'} successfully!`);
    } catch (error) {
      console.error('Error updating attendance:', error);
      alert('Error updating attendance: ' + error.message);
    }
  };

  return (
    <div className="attendance-management">
      <div className="form-card">
        <div className="form-header">
          <div>
            <h3>📋 Attendance Management</h3>
            <p>Review and approve attendance records</p>
          </div>
          <span className="form-badge">
            {attendanceStats.rate}% Attendance Rate
          </span>
        </div>

        {/* Stats Cards */}
        <div className="attendance-stats">
          <div className="stat-card" style={{ borderLeftColor: '#0b7e4b' }}>
            <div className="stat-value">{attendanceStats.present}</div>
            <div className="stat-label">✅ Present</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#d97706' }}>
            <div className="stat-value">{attendanceStats.late}</div>
            <div className="stat-label">⏰ Late</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#dc2626' }}>
            <div className="stat-value">{attendanceStats.absent}</div>
            <div className="stat-label">❌ Absent</div>
          </div>
          <div className="stat-card" style={{ borderLeftColor: '#6b7280' }}>
            <div className="stat-value">{attendanceStats.halfDay}</div>
            <div className="stat-label">📊 Half Day</div>
          </div>
        </div>

        {/* Filters */}
        <div className="attendance-filters">
          <div className="filter-group">
            <label>Date</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Region</label>
            <select 
              value={selectedRegion} 
              onChange={e => setSelectedRegion(e.target.value)}
            >
              {regions.map(r => (
                <option key={r} value={r}>{r === 'all' ? 'All Regions' : r}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Status</label>
            <select 
              value={selectedStatus} 
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="half_day">Half Day</option>
            </select>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Region</th>
                <th>Date</th>
                <th>Status</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Hours</th>
                <th>Approved</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAttendance.length === 0 && (
                <tr>
                  <td colSpan="9" className="empty-state">
                    <div className="empty-icon">📋</div>
                    <div>No attendance records found</div>
                  </td>
                </tr>
              )}
              {filteredAttendance.map(a => (
                <tr key={a.id}>
                  <td><strong>{a.employeeName}</strong></td>
                  <td>{a.region || 'N/A'}</td>
                  <td>{a.date}</td>
                  <td>
                    <span className={`status-badge ${a.status}`}>
                      {a.status}
                    </span>
                  </td>
                  <td>{a.checkIn || '--'}</td>
                  <td>{a.checkOut || '--'}</td>
                  <td>{a.workHours || 0}h</td>
                  <td>
                    {a.approved ? (
                      <span className="status-badge approved">✅ Approved</span>
                    ) : (
                      <span className="status-badge pending">⏳ Pending</span>
                    )}
                  </td>
                  <td>
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
                            marginRight: '4px',
                            opacity: 1,
                            visibility: 'visible',
                            display: 'inline-flex'
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
                            opacity: 1,
                            visibility: 'visible',
                            display: 'inline-flex'
                          }}
                        >
                          ❌ Reject
                        </button>
                      </>
                    )}
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