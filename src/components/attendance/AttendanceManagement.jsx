import React, { useState, useMemo } from 'react';
import { db } from '../../services/database';
import { getToday, uid } from '../../utils/helpers';
import { syncQueue } from '../../services/database';

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

  const supervisorOfficers = useMemo(() => {
    if (isSupervisor && user) {
      return users.filter(u => u.supervisorId === user.id && u.role === 'field_officer');
    }
    return [];
  }, [users, user, isSupervisor]);

  const supervisorAttendance = useMemo(() => {
    if (isSupervisor && user) {
      const officerIds = supervisorOfficers.map(o => o.employeeId);
      return attendance.filter(a => officerIds.includes(a.employeeId));
    }
    return [];
  }, [attendance, supervisorOfficers, isSupervisor, user]);

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
    const online = navigator.onLine;

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
        approved: false,
        approvedBy: null,
        approvedAt: null,
        updatedBy: user.employeeId,
        updatedByName: user.name,
        supervisorId: user.id,
        supervisorName: user.name,
        submittedToManager: true,
        submittedAt: new Date().toISOString(),
        region: selectedOfficer.region || user.region,
        seenByManager: false,
        seenAt: null,
        seenBy: null,
        editedBySupervisor: true,
        lastEditedAt: new Date().toISOString(),
        synced: online ? true : false
      };

      let recordId;

      if (existingRecord) {
        await db.attendance.update(existingRecord.id, attendanceData);
        const updated = attendance.map(a =>
          a.id === existingRecord.id ? { ...a, ...attendanceData } : a
        );
        if (setAttendance) setAttendance(updated);
        recordId = existingRecord.id;
      } else {
        const newRecord = {
          id: uid(),
          employeeId: selectedOfficer.employeeId,
          employeeName: selectedOfficer.name,
          date: today,
          region: selectedOfficer.region || user.region,
          supervisorId: user.id,
          supervisorName: user.name,
          ...attendanceData,
          createdAt: new Date().toISOString()
        };
        await db.attendance.add(newRecord);
        if (setAttendance) setAttendance([newRecord, ...attendance]);
        recordId = newRecord.id;
      }

      if (!online) {
        syncQueue.add({
          type: 'attendance',
          id: recordId,
          data: attendanceData
        });
        alert('📋 Attendance saved offline! Will sync when online.');
        setShowModal(false);
        setSelectedOfficer(null);
        return;
      }

      const manager = users.find(u => u.role === 'manager');
      if (manager && addNotification) {
        await addNotification(
          manager.id,
          '📋 Attendance Updated',
          `${user.name} updated attendance for ${selectedOfficer.name}`,
          'info'
        );
      }

      if (addNotification) {
        await addNotification(
          selectedOfficer.id,
          '📋 Attendance Updated',
          `Your attendance has been updated by ${user.name}`,
          'info'
        );
      }

      setShowModal(false);
      setSelectedOfficer(null);
      alert('✅ Attendance updated and submitted to manager successfully!');
    } catch (error) {
      console.error('Error submitting attendance:', error);
      alert('❌ Error submitting attendance: ' + error.message);
    }
  };

  const today = getToday();
  
  const pendingApproval = supervisorAttendance.filter(a => 
    a.approved === false && a.submittedToManager === true
  ).length;
  
  const notSeenByManager = supervisorAttendance.filter(a => 
    a.seenByManager !== true && a.submittedToManager === true
  ).length;
  
  const seenByManager = supervisorAttendance.filter(a => 
    a.seenByManager === true && a.submittedToManager === true
  ).length;

  const getOfficerTodayAttendance = (officerId) => {
    return attendance.find(a => a.employeeId === officerId && a.date === today);
  };

  return (
    <div style={{padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif'}}>
      
      {/* Offline Status Banner */}
      {!navigator.onLine && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>📡 You are offline. Attendance will be saved and synced when online.</span>
        </div>
      )}

      {/* Header Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        padding: '20px 24px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
          <div>
            <h2 style={{margin: 0, fontSize: '20px', fontWeight: '600', color: '#1a1a2e'}}>📋 Attendance Management</h2>
            <p style={{margin: '4px 0 0 0', fontSize: '14px', color: '#6b7280'}}>
              {isSupervisor ? `Manage your team (${supervisorOfficers.length} officers)` : 'Your attendance records'}
            </p>
          </div>
          <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
            {isSupervisor && notSeenByManager > 0 && (
              <span style={{background: '#fee2e2', color: '#991b1b', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'}}>
                👁️‍🗨️ {notSeenByManager} Not Seen
              </span>
            )}
            {isSupervisor && seenByManager > 0 && (
              <span style={{background: '#dbeafe', color: '#1e40af', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'}}>
                👁️ {seenByManager} Seen
              </span>
            )}
            {isSupervisor && pendingApproval > 0 && (
              <span style={{background: '#fef3c7', color: '#92400e', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'}}>
                ⏳ {pendingApproval} Pending
              </span>
            )}
            <span style={{background: '#d1fae5', color: '#065f37', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '500'}}>
              ✅ {attendanceSummary.rate}% Present
            </span>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px'}}>
          <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '8px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                background: '#ffffff',
                transition: 'border-color 0.2s'
              }}
            />
            <select 
              value={attendanceFilter} 
              onChange={e => setAttendanceFilter(e.target.value)}
              style={{
                padding: '8px 14px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                background: '#ffffff',
                transition: 'border-color 0.2s'
              }}
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="half_day">Half Day</option>
              <option value="absent">Absent</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <span style={{color: '#6b7280', fontSize: '14px'}}>{filteredAttendance.length} records</span>
        </div>
      </div>

      {/* Quick Edit Cards */}
      {isSupervisor && supervisorOfficers.length > 0 && (
        <div style={{marginBottom: '20px'}}>
          <h4 style={{fontSize: '15px', fontWeight: '600', color: '#1a1a2e', marginBottom: '14px'}}>
            👤 Officers - Quick Edit Today's Attendance
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '14px'
          }}>
            {supervisorOfficers.map(officer => {
              const todayAtt = getOfficerTodayAttendance(officer.employeeId);
              const hasSubmitted = todayAtt?.submittedToManager;
              const isApproved = todayAtt?.approved;
              const isSeen = todayAtt?.seenByManager;
              const isSynced = todayAtt?.synced;
              
              let borderColor = '#e5e7eb';
              let statusText = 'Not Submitted';
              let statusColor = '#6b7280';

              if (isApproved) {
                borderColor = '#22c55e';
                statusText = '✅ Approved';
                statusColor = '#16a34a';
              } else if (isSeen) {
                borderColor = '#eab308';
                statusText = '👁️ Seen by Manager';
                statusColor = '#ca8a04';
              } else if (hasSubmitted) {
                borderColor = '#f97316';
                statusText = '⏳ Pending Review';
                statusColor = '#dc2626';
              }
              
              return (
                <div 
                  key={officer.id} 
                  style={{
                    background: '#ffffff',
                    borderRadius: '8px',
                    padding: '16px 18px',
                    border: `2px solid ${borderColor}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    transition: 'all 0.25s ease'
                  }}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                      <div style={{fontSize: '15px', fontWeight: '600', color: '#1a1a2e'}}>{officer.name}</div>
                      <div style={{fontSize: '12px', color: '#6b7280'}}>{officer.region}</div>
                      <div style={{fontSize: '12px', marginTop: '4px', color: statusColor, fontWeight: '500'}}>
                        {statusText}
                        {!isSynced && hasSubmitted && (
                          <span style={{fontSize: '10px', color: '#f59e0b', marginLeft: '4px'}}>📡 Offline</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenModal(officer)}
                      style={{
                        background: '#1a1a2e',
                        color: '#ffffff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {hasSubmitted ? '✏️ Edit' : '📝 Add'}
                    </button>
                  </div>
                  {todayAtt && (
                    <div style={{
                      marginTop: '10px',
                      paddingTop: '10px',
                      borderTop: '1px solid #f3f4f6',
                      display: 'flex',
                      gap: '14px',
                      flexWrap: 'wrap',
                      fontSize: '12px',
                      color: '#6b7280'
                    }}>
                      <span>Status: <strong style={{color: '#1a1a2e'}}>{todayAtt.status}</strong></span>
                      <span>In: <strong style={{color: '#1a1a2e'}}>{todayAtt.checkIn}</strong></span>
                      <span>Out: <strong style={{color: '#1a1a2e'}}>{todayAtt.checkOut}</strong></span>
                      <span>Hours: <strong style={{color: '#1a1a2e'}}>{todayAtt.workHours}h</strong></span>
                    </div>
                  )}
                  {!todayAtt && (
                    <div style={{
                      marginTop: '10px',
                      paddingTop: '10px',
                      borderTop: '1px solid #f3f4f6',
                      fontSize: '12px',
                      color: '#9ca3af'
                    }}>
                      No attendance recorded today
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table Card */}
      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}>
        <div style={{padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa'}}>
          <h4 style={{margin: 0, fontSize: '15px', fontWeight: '600', color: '#1a1a2e'}}>📊 Attendance Records</h4>
        </div>
        <div style={{overflowX: 'auto'}}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            background: '#ffffff'
          }}>
            <thead>
              <tr style={{background: '#f8f9fa', borderBottom: '2px solid #e5e7eb'}}>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Employee</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Region</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Date</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Status</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Check In</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Check Out</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Hours</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Overtime</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Break</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Manager Seen</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Status</th>
                <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Notes</th>
                {isSupervisor && <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#4a5568', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px'}}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAttendance.length === 0 && (
                <tr>
                  <td colSpan={isSupervisor ? "13" : "12"} style={{textAlign: 'center', padding: '48px', color: '#9ca3af'}}>
                    <div style={{fontSize: '36px', marginBottom: '8px'}}>📋</div>
                    <div>No attendance records found for this date</div>
                  </td>
                </tr>
              )}
              {filteredAttendance.map((a, index) => {
                const officer = users?.find(u => u.employeeId === a.employeeId);
                const isEven = index % 2 === 0;
                
                return (
                  <tr 
                    key={a.id} 
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: isEven ? '#ffffff' : '#fafbfc',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    <td style={{padding: '10px 16px', fontWeight: '600', color: '#1a1a2e'}}>
                      {a.employeeName}
                      {!a.synced && a.submittedToManager && (
                        <span style={{fontSize: '10px', color: '#f59e0b', marginLeft: '4px'}}>📡</span>
                      )}
                    </td>
                    <td style={{padding: '10px 16px', color: '#4a5568'}}>{a.region || 'N/A'}</td>
                    <td style={{padding: '10px 16px', color: '#4a5568'}}>{a.date}</td>
                    <td style={{padding: '10px 16px'}}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: a.status === 'present' ? '#dcfce7' : 
                                   a.status === 'late' ? '#fef3c7' : 
                                   a.status === 'absent' ? '#fee2e2' : 
                                   a.status === 'half_day' ? '#fde68a' : '#f3f4f6',
                        color: a.status === 'present' ? '#16a34a' : 
                               a.status === 'late' ? '#ca8a04' : 
                               a.status === 'absent' ? '#dc2626' : 
                               a.status === 'half_day' ? '#92400e' : '#6b7280'
                      }}>
                        {a.status || 'Not Marked'}
                      </span>
                    </td>
                    <td style={{padding: '10px 16px', color: '#4a5568'}}>{a.checkIn || '--'}</td>
                    <td style={{padding: '10px 16px', color: '#4a5568'}}>{a.checkOut || '--'}</td>
                    <td style={{padding: '10px 16px', fontWeight: '600', color: '#1a1a2e'}}>{a.workHours || 0}h</td>
                    <td style={{padding: '10px 16px', color: '#4a5568'}}>{a.overtime || 0}h</td>
                    <td style={{padding: '10px 16px', color: '#4a5568'}}>{a.breakTime || 0}h</td>
                    <td style={{padding: '10px 16px'}}>
                      {a.seenByManager ? (
                        <span style={{color: '#ca8a04', fontWeight: '600'}}>👁️ Seen</span>
                      ) : a.submittedToManager ? (
                        <span style={{color: '#dc2626', fontWeight: '600'}}>🔴 Not Seen</span>
                      ) : (
                        <span style={{color: '#9ca3af'}}>—</span>
                      )}
                    </td>
                    <td style={{padding: '10px 16px'}}>
                      {a.approved ? (
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: '#dcfce7',
                          color: '#16a34a'
                        }}>✅ Approved</span>
                      ) : a.submittedToManager ? (
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: '#fef3c7',
                          color: '#ca8a04'
                        }}>⏳ Pending</span>
                      ) : (
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '500',
                          background: '#f3f4f6',
                          color: '#6b7280'
                        }}>Not Submitted</span>
                      )}
                    </td>
                    <td style={{padding: '10px 16px', color: '#6b7280', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{a.notes || '--'}</td>
                    {isSupervisor && officer && (
                      <td style={{padding: '10px 16px'}}>
                        <button
                          onClick={() => handleOpenModal(officer)}
                          style={{
                            background: '#1a1a2e',
                            color: '#ffffff',
                            border: 'none',
                            padding: '6px 14px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            transition: 'all 0.2s ease',
                            width: '100%'
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

      {/* Modal */}
      {showModal && selectedOfficer && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '600px',
            width: '95%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            animation: 'fadeIn 0.3s ease'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '2px solid #f3f4f6'
            }}>
              <h3 style={{fontSize: '20px', fontWeight: '600', color: '#1a1a2e', margin: 0}}>
                ✏️ Edit Attendance - {selectedOfficer.name}
                {!navigator.onLine && <span style={{fontSize: '12px', color: '#f59e0b', marginLeft: '8px'}}>📡 Offline</span>}
              </h3>
              <button 
                onClick={() => setShowModal(false)} 
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  transition: 'color 0.2s',
                  padding: '4px 8px'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{display: 'flex', flexDirection: 'column', gap: '18px'}}>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Employee</label>
                  <input 
                    type="text" 
                    value={selectedOfficer.name} 
                    disabled 
                    style={{
                      padding: '10px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: '#f3f4f6',
                      color: '#6b7280'
                    }}
                  />
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Date</label>
                  <input 
                    type="text" 
                    value={getToday()} 
                    disabled 
                    style={{
                      padding: '10px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      background: '#f3f4f6',
                      color: '#6b7280'
                    }}
                  />
                </div>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Status *</label>
                <select 
                  value={form.status} 
                  onChange={e => setForm({...form, status: e.target.value})}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    background: '#ffffff',
                    transition: 'border-color 0.2s'
                  }}
                >
                  <option value="present">✅ Present</option>
                  <option value="late">⏰ Late</option>
                  <option value="half_day">🌗 Half Day</option>
                  <option value="absent">❌ Absent</option>
                  <option value="pending">⏳ Pending</option>
                </select>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Check In Time</label>
                  <input 
                    type="time" 
                    value={form.checkIn} 
                    onChange={e => setForm({...form, checkIn: e.target.value})}
                    style={{
                      padding: '10px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      transition: 'border-color 0.2s'
                    }}
                  />
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Check Out Time</label>
                  <input 
                    type="time" 
                    value={form.checkOut} 
                    onChange={e => setForm({...form, checkOut: e.target.value})}
                    style={{
                      padding: '10px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      transition: 'border-color 0.2s'
                    }}
                  />
                </div>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Work Hours</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="24" 
                    step="0.5"
                    value={form.workHours} 
                    onChange={e => setForm({...form, workHours: parseFloat(e.target.value) || 0})}
                    style={{
                      padding: '10px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      transition: 'border-color 0.2s'
                    }}
                  />
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Overtime (hrs)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="12" 
                    step="0.5"
                    value={form.overtime} 
                    onChange={e => setForm({...form, overtime: parseFloat(e.target.value) || 0})}
                    style={{
                      padding: '10px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      transition: 'border-color 0.2s'
                    }}
                  />
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Break Time (hrs)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="4" 
                    step="0.5"
                    value={form.breakTime} 
                    onChange={e => setForm({...form, breakTime: parseFloat(e.target.value) || 0})}
                    style={{
                      padding: '10px 14px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px',
                      transition: 'border-color 0.2s'
                    }}
                  />
                </div>
              </div>

              <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Notes</label>
                <textarea 
                  value={form.notes} 
                  onChange={e => setForm({...form, notes: e.target.value})}
                  placeholder="Additional notes about this attendance..."
                  rows="3"
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    resize: 'vertical',
                    minHeight: '60px',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>

              <div style={{
                padding: '14px',
                background: !navigator.onLine ? '#fef3c7' : '#dbeafe',
                borderRadius: '8px',
                fontSize: '13px',
                color: !navigator.onLine ? '#92400e' : '#1e40af',
                border: !navigator.onLine ? '1px solid #f59e0b' : '1px solid #93c5fd'
              }}>
                <strong>ℹ️ {navigator.onLine ? 'Online' : 'Offline'}:</strong> 
                {navigator.onLine 
                  ? ' This attendance will be sent to the manager for review.' 
                  : ' This attendance will be saved offline and synced when back online.'}
              </div>

              <div style={{display: 'flex', gap: '12px', marginTop: '8px'}}>
                <button 
                  onClick={handleSubmitAttendance}
                  style={{
                    background: navigator.onLine ? '#16a34a' : '#f59e0b',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                    flex: 1
                  }}
                >
                  {navigator.onLine ? '📤 Submit to Manager' : '💾 Save Offline'}
                </button>
                <button 
                  onClick={() => setShowModal(false)}
                  style={{
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background 0.2s ease'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95) translateY(-10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default AttendanceManagement;