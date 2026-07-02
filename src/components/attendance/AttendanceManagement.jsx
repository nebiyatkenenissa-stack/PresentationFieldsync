import React, { useState } from 'react';
import { db } from '../../services/database';
import { getToday, uid } from '../../utils/helpers';

function AttendanceManagement({ 
  filteredAttendance,
  attendance,
  setAttendance,
  users,
  user,
  isSupervisor,
  isOfficer,
  teamMembers,
  selectedDate,
  setSelectedDate,
  attendanceFilter,
  setAttendanceFilter,
  attendanceSummary,
  handleOpenAttendanceModal,
  renderAttendanceModal,
  addNotification
}) {
  const [showModal, setShowModal] = useState(false);
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [form, setForm] = useState({
    status: 'present',
    checkIn: '08:00',
    checkOut: '17:00',
    notes: '',
    workHours: 8,
    overtime: 0,
    breakTime: 0
  });

  const handleOpenModal = (officer) => {
    setSelectedOfficer(officer);
    const today = getToday();
    const existing = attendance.find(a => a.employeeId === officer.employeeId && a.date === today);
    setForm({
      status: existing?.status || 'present',
      checkIn: existing?.checkIn || '08:00',
      checkOut: existing?.checkOut || '17:00',
      notes: existing?.notes || '',
      workHours: existing?.workHours || 8,
      overtime: existing?.overtime || 0,
      breakTime: existing?.breakTime || 0
    });
    setShowModal(true);
  };

  const handleSubmitAttendance = async () => {
    if (!selectedOfficer) return;
    const today = getToday();

    // Calculate work hours
    let workHours = 0;
    if (form.checkIn && form.checkOut) {
      const checkIn = form.checkIn.split(':');
      const checkOut = form.checkOut.split(':');
      const inHours = parseInt(checkIn[0]);
      const inMins = parseInt(checkIn[1]);
      const outHours = parseInt(checkOut[0]);
      const outMins = parseInt(checkOut[1]);
      workHours = (outHours - inHours) + (outMins - inMins) / 60;
      if (workHours < 0) workHours += 24;
      workHours = workHours - (form.breakTime || 0);
    }

    try {
      const existingRecord = attendance.find(
        a => a.employeeId === selectedOfficer.employeeId && a.date === today
      );

      const attendanceData = {
        status: form.status,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        workHours: Math.round(workHours * 10) / 10,
        notes: form.notes || '',
        overtime: Number(form.overtime) || 0,
        breakTime: Number(form.breakTime) || 0,
        approved: true,
        updatedBy: user.employeeId,
        updatedByName: user.name,
        submittedToManager: true,
        submittedAt: new Date().toISOString()
      };

      if (existingRecord) {
        await db.attendance.update(existingRecord.id, attendanceData);
        const updated = attendance.map(a =>
          a.id === existingRecord.id ? { ...a, ...attendanceData } : a
        );
        if (setAttendance) setAttendance(updated);
      } else {
        const newRecord = {
          id: uid(),
          employeeId: selectedOfficer.employeeId,
          employeeName: selectedOfficer.name,
          date: today,
          region: selectedOfficer.region,
          supervisorId: user.id,
          supervisorName: user.name,
          ...attendanceData,
          createdAt: new Date().toISOString()
        };
        await db.attendance.add(newRecord);
        if (setAttendance) setAttendance([newRecord, ...attendance]);
      }

      // Send notification to manager
      const manager = users.find(u => u.role === 'manager');
      if (manager && addNotification) {
        addNotification(
          manager.id,
          '📋 Attendance Submitted',
          `${user.name} submitted attendance for ${selectedOfficer.name}`,
          'info'
        );
      }

      // Notify the officer
      if (addNotification) {
        addNotification(
          selectedOfficer.id,
          '📋 Attendance Updated',
          `Your attendance has been marked by ${user.name}`,
          'info'
        );
      }

      setShowModal(false);
      setSelectedOfficer(null);
      alert('✅ Attendance submitted to manager successfully!');
    } catch (error) {
      console.error('Error submitting attendance:', error);
      alert('❌ Error submitting attendance');
    }
  };

  // Get today's attendance for display
  const today = getToday();
  const todayAttendance = attendance.filter(a => a.date === today);

  return (
    <div className="attendance-view">
      <div className="form-card">
        <div className="form-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px'}}>
          <div>
            <h3>📋 Attendance Management</h3>
            <p>{isSupervisor ? 'Manage your team attendance' : 'Your attendance records'}</p>
          </div>
          <div style={{display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap'}}>
            <span className="form-badge" style={{background: '#dbeafe', color: '#1e40af'}}>
              {todayAttendance.length} Today
            </span>
            <span className="form-badge" style={{background: '#d1fae5', color: '#065f37'}}>
              ✅ {attendanceSummary.rate}% Present
            </span>
          </div>
        </div>

        <div className="attendance-management">
          {/* Controls */}
          <div className="attendance-controls" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px'}}>
            <div className="attendance-filters" style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="filter-select"
                style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px'}}
              />
              <select 
                value={attendanceFilter} 
                onChange={e => setAttendanceFilter(e.target.value)}
                className="filter-select"
                style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px'}}
              >
                <option value="all">All Status</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="half_day">Half Day</option>
                <option value="absent">Absent</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <span className="attendance-count" style={{color: '#64748b', fontSize: '14px'}}>
              {filteredAttendance.length} records
            </span>
          </div>

          {/* Table */}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Region</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Hours</th>
                  <th>Overtime</th>
                  <th>Break</th>
                  <th>Notes</th>
                  {isSupervisor && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.length === 0 && (
                  <tr>
                    <td colSpan={isSupervisor ? "10" : "9"} className="empty-state">
                      <div className="empty-icon">📋</div>
                      <div>No attendance records found</div>
                    </td>
                  </tr>
                )}
                {filteredAttendance.map(a => {
                  const officer = users?.find(u => u.employeeId === a.employeeId);
                  return (
                    <tr key={a.id}>
                      <td><strong>{a.employeeName}</strong></td>
                      <td>{a.region}</td>
                      <td>
                        <span className={`attendance-tag ${a.status}`} style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: a.status === 'present' ? '#d1fae5' : 
                                     a.status === 'late' ? '#fef3c7' : 
                                     a.status === 'absent' ? '#fee2e2' : 
                                     a.status === 'half_day' ? '#fde68a' : '#e5e7eb',
                          color: a.status === 'present' ? '#065f37' : 
                                 a.status === 'late' ? '#92400e' : 
                                 a.status === 'absent' ? '#991b1b' : 
                                 a.status === 'half_day' ? '#78350f' : '#374151'
                        }}>
                          {a.status || 'Not Marked'}
                        </span>
                      </td>
                      <td>{a.checkIn || '--'}</td>
                      <td>{a.checkOut || '--'}</td>
                      <td><strong>{a.workHours || 0}h</strong></td>
                      <td>{a.overtime || 0}h</td>
                      <td>{a.breakTime || 0}h</td>
                      <td>{a.notes || '--'}</td>
                      {isSupervisor && officer && (
                        <td>
                          <button 
                            className="btn-sm btn-approve" 
                            onClick={() => handleOpenModal(officer)}
                            style={{
                              background: '#1e3a5f',
                              color: 'white',
                              border: 'none',
                              padding: '6px 12px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              opacity: 1,
                              visibility: 'visible',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            ✏️ Edit
                          </button>
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

      {/* Attendance Modal */}
      {showModal && selectedOfficer && (
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
                Edit Attendance - {selectedOfficer.name}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)} style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#64748b'
              }}>✕</button>
            </div>

            <div className="modal-form" style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Date</label>
                <input type="text" value={getToday()} disabled style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', background: '#f3f4f6'}} />
              </div>

              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Status *</label>
                <select 
                  value={form.status} 
                  onChange={e => setForm({...form, status: e.target.value})}
                  style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                >
                  <option value="present">✅ Present</option>
                  <option value="late">⏰ Late</option>
                  <option value="half_day">🌗 Half Day</option>
                  <option value="absent">❌ Absent</option>
                  <option value="pending">⏳ Pending</option>
                </select>
              </div>

              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Check In Time *</label>
                  <input 
                    type="time" 
                    value={form.checkIn} 
                    onChange={e => setForm({...form, checkIn: e.target.value})}
                    style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                  />
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Check Out Time *</label>
                  <input 
                    type="time" 
                    value={form.checkOut} 
                    onChange={e => setForm({...form, checkOut: e.target.value})}
                    style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                  />
                </div>
              </div>

              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px'}}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Work Hours</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="24" 
                    step="0.5"
                    value={form.workHours} 
                    onChange={e => setForm({...form, workHours: parseFloat(e.target.value) || 0})}
                    style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                  />
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Overtime (hrs)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="12" 
                    step="0.5"
                    value={form.overtime} 
                    onChange={e => setForm({...form, overtime: parseFloat(e.target.value) || 0})}
                    style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                  />
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Break Time (hrs)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="4" 
                    step="0.5"
                    value={form.breakTime} 
                    onChange={e => setForm({...form, breakTime: parseFloat(e.target.value) || 0})}
                    style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px'}}
                  />
                </div>
              </div>

              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Notes</label>
                <textarea 
                  value={form.notes} 
                  onChange={e => setForm({...form, notes: e.target.value})}
                  placeholder="Additional notes..."
                  rows="2"
                  style={{padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', resize: 'vertical', minHeight: '60px'}}
                />
              </div>

              <div className="modal-actions" style={{display: 'flex', gap: '12px', marginTop: '8px'}}>
                <button 
                  className="btn-submit" 
                  onClick={handleSubmitAttendance}
                  style={{
                    background: '#0b7e4b',
                    color: 'white',
                    border: 'none',
                    padding: '10px 24px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    opacity: 1,
                    visibility: 'visible',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  ✅ Submit to Manager
                </button>
                <button 
                  className="btn-cancel" 
                  onClick={() => setShowModal(false)}
                  style={{
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
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AttendanceManagement;