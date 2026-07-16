// components/reports/ReportForm.js

import React, { useState, useEffect } from 'react';
import { syncQueue, checkRealInternet } from '../../services/database';
import { uid } from '../../utils/helpers';

function ReportForm({ form, setForm, handleSubmit, user, isOfficer, isSupervisor, addNotification, users }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Check online status
  useEffect(() => {
    const checkStatus = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
    };
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Please login first');
      return;
    }

    if (!form.siteName?.trim()) {
      alert('Site name is required');
      return;
    }
    if (form.registrations < 0) {
      alert('Registrations cannot be negative');
      return;
    }

    setIsSubmitting(true);

    try {
      // Check if online
      const online = await checkRealInternet();
      setIsOnline(online);

      // Create report object
      const newReport = {
        id: uid(),
        reportId: `RPT-${Date.now()}`,
        reportDate: form.reportDate,
        region: form.region || user.region,
        siteName: form.siteName.trim(),
        employeeId: user.employeeId,
        employeeName: user.name,
        supervisorId: user.supervisorId || '',
        registrations: Number(form.registrations) || 0,
        registrationEfficiency: Math.round((Number(form.registrations) / 100) * 100),
        operationalStatus: form.operationalStatus,
        attendance: form.attendance,
        workHours: Number(form.workHours),
        issues: form.issues?.trim() || '',
        comments: form.comments?.trim() || '',
        challenges: form.challenges?.trim() || '',
        activities: form.activities?.trim() || '',
        equipmentStatus: form.equipmentStatus || 'operational',
        materialsUsed: form.materialsUsed?.trim() || '',
        teamMembers: form.teamMembers?.trim() || '',
        weatherConditions: form.weatherConditions?.trim() || '',
        communityFeedback: form.communityFeedback?.trim() || '',
        submittedAt: new Date().toISOString(),
        // CRITICAL: Set synced based on online status
        synced: online ? true : false,
        syncAttempts: 0,
        syncError: null,
        reviewed: false,
        reviewedBy: null,
        offlineSaved: !online
      };

      // Save to IndexedDB
      const { db } = await import('../../services/database');
      await db.reports.add(newReport);

      // If offline, add to sync queue
      if (!online) {
        syncQueue.add({
          type: 'report',
          id: newReport.id,
          data: newReport
        });

        if (addNotification) {
          await addNotification(
            user.id,
            '💾 Report Saved Offline',
            `Report for ${form.siteName} saved offline. Will sync automatically when online.`,
            'warning'
          );
        }

        alert('📋 Report saved OFFLINE! Will sync automatically when internet is back.');
      } else {
        // If online, notify supervisor and manager
        if (isOfficer && user) {
          const supervisor = users?.find(u => u.id === user.supervisorId);
          if (supervisor && addNotification) {
            await addNotification(
              supervisor.id,
              '📋 Report Submitted',
              `${user.name} submitted report for ${form.siteName}`,
              'success'
            );
          }
          const manager = users?.find(u => u.role === 'manager');
          if (manager && addNotification) {
            await addNotification(
              manager.id,
              '📋 Report Submitted',
              `${user.name} submitted report for ${form.siteName}`,
              'info'
            );
          }
        } else if (isSupervisor && user) {
          const manager = users?.find(u => u.role === 'manager');
          if (manager && addNotification) {
            await addNotification(
              manager.id,
              '📋 Report Submitted',
              `${user.name} submitted report for ${form.siteName}`,
              'info'
            );
          }
        }

        alert('📋 Report submitted and synced successfully!');
      }

      // Reset form
      setForm({
        reportDate: form.reportDate,
        region: form.region || user.region,
        siteName: '',
        registrations: 0,
        operationalStatus: 'Active',
        attendance: 'present',
        workHours: 8,
        issues: '',
        comments: '',
        challenges: '',
        activities: '',
        equipmentStatus: 'operational',
        materialsUsed: '',
        teamMembers: '',
        weatherConditions: '',
        communityFeedback: ''
      });

    } catch (error) {
      console.error('Error submitting report:', error);
      alert('❌ Error submitting report: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="reports-view">
      <div className="form-card">
        <div className="form-header">
          <div>
            <h3>Submit Daily Report</h3>
            <p>{isSupervisor ? 'Submit your supervisor report' : 'Record registration data and attendance'}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="form-badge" style={{
              background: isOnline ? '#d1fae5' : '#fee2e2',
              color: isOnline ? '#065f37' : '#991b1b',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              {isOnline ? '✅ Online' : '📡 Offline'}
            </span>
            <span className="form-badge" style={{
              background: '#dbeafe',
              color: '#1e40af',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              {isOnline ? 'Auto-Sync Enabled' : 'Offline Save'}
            </span>
          </div>
        </div>

        {/* Offline Warning Banner */}
        {!isOnline && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>📡</span>
            <span>
              <strong>You are offline.</strong> Your report will be saved locally and 
              <strong> automatically synced</strong> when internet is back.
            </span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="report-form">
          <div className="form-row">
            <div className="form-group">
              <label>Report Date</label>
              <input 
                type="date" 
                value={form.reportDate} 
                onChange={e => setForm({...form, reportDate: e.target.value})} 
                required 
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
            <div className="form-group">
              <label>Region</label>
              <input 
                value={form.region || user?.region} 
                disabled 
                style={{ opacity: 0.7, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
            <div className="form-group">
              <label>Site Name</label>
              {isOfficer ? (
                <select 
                  value={form.siteName} 
                  onChange={e => setForm({...form, siteName: e.target.value})} 
                  required
                  style={{ opacity: 1, visibility: 'visible', display: 'block', width: '100%', padding: '8px 12px' }}
                >
                  <option value="">Select Site</option>
                  {user?.assignedSites?.map(site => <option key={site} value={site}>{site}</option>)}
                  <option value="Other">Other</option>
                </select>
              ) : (
                <input 
                  type="text" 
                  value={form.siteName} 
                  onChange={e => setForm({...form, siteName: e.target.value})} 
                  placeholder="Enter site name" 
                  required 
                  style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
                />
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Citizens Registered Today</label>
              <input 
                type="number" 
                min="0" 
                value={form.registrations} 
                onChange={e => setForm({...form, registrations: e.target.value})} 
                required 
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
            <div className="form-group">
              <label>Attendance Status</label>
              <select 
                value={form.attendance} 
                onChange={e => setForm({...form, attendance: e.target.value})}
                style={{ opacity: 1, visibility: 'visible', display: 'block', width: '100%', padding: '8px 12px' }}
              >
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="half_day">Half Day</option>
                <option value="absent">Absent</option>
              </select>
            </div>
            <div className="form-group">
              <label>Work Hours</label>
              <input 
                type="number" 
                min="0" 
                max="12" 
                value={form.workHours} 
                onChange={e => setForm({...form, workHours: e.target.value})}
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Operational Status</label>
              <select 
                value={form.operationalStatus} 
                onChange={e => setForm({...form, operationalStatus: e.target.value})}
                style={{ opacity: 1, visibility: 'visible', display: 'block', width: '100%', padding: '8px 12px' }}
              >
                <option>Active</option>
                <option>Delayed</option>
                <option>Interrupted</option>
                <option>Closed</option>
              </select>
            </div>
            <div className="form-group">
              <label>Activities Performed</label>
              <textarea 
                value={form.activities} 
                onChange={e => setForm({...form, activities: e.target.value})} 
                placeholder="Describe activities performed today" 
                rows="2"
                style={{ opacity: 1, visibility: 'visible', resize: 'vertical', minHeight: '60px', width: '100%', padding: '8px 12px' }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Equipment Status</label>
              <select 
                value={form.equipmentStatus} 
                onChange={e => setForm({...form, equipmentStatus: e.target.value})}
                style={{ opacity: 1, visibility: 'visible', display: 'block', width: '100%', padding: '8px 12px' }}
              >
                <option value="operational">Operational</option>
                <option value="partial">Partially Operational</option>
                <option value="non_operational">Non-Operational</option>
              </select>
            </div>
            <div className="form-group">
              <label>Materials Used</label>
              <input 
                type="text" 
                value={form.materialsUsed} 
                onChange={e => setForm({...form, materialsUsed: e.target.value})} 
                placeholder="Materials consumed"
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Team Members Present</label>
              <input 
                type="text" 
                value={form.teamMembers} 
                onChange={e => setForm({...form, teamMembers: e.target.value})} 
                placeholder="Names of team members"
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
            <div className="form-group">
              <label>Weather Conditions</label>
              <input 
                type="text" 
                value={form.weatherConditions} 
                onChange={e => setForm({...form, weatherConditions: e.target.value})} 
                placeholder="Weather conditions"
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Community Feedback</label>
              <input 
                type="text" 
                value={form.communityFeedback} 
                onChange={e => setForm({...form, communityFeedback: e.target.value})} 
                placeholder="Community feedback received"
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
            <div className="form-group">
              <label>Challenges</label>
              <input 
                placeholder="Describe any challenges" 
                value={form.challenges} 
                onChange={e => setForm({...form, challenges: e.target.value})}
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Issues Encountered</label>
              <input 
                placeholder="Any issues?" 
                value={form.issues} 
                onChange={e => setForm({...form, issues: e.target.value})}
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
            <div className="form-group">
              <label>Comments</label>
              <input 
                placeholder="Additional notes" 
                value={form.comments} 
                onChange={e => setForm({...form, comments: e.target.value})}
                style={{ opacity: 1, visibility: 'visible', width: '100%', padding: '8px 12px' }}
              />
            </div>
          </div>

          <div className="form-actions" style={{ 
            marginTop: '20px', 
            display: 'flex', 
            gap: '12px',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}>
            {!isOnline && (
              <span style={{ fontSize: '13px', color: '#92400e' }}>
                📡 Will sync automatically when online
              </span>
            )}
            <button 
              type="submit" 
              className="btn-submit"
              disabled={isSubmitting}
              style={{
                opacity: 1,
                visibility: 'visible',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: isSubmitting ? '#94a3b8' : (!isOnline ? '#f59e0b' : '#0b7e4b'),
                color: 'white',
                padding: '10px 24px',
                border: 'none',
                borderRadius: '6px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                minWidth: '140px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.target.style.background = !isOnline ? '#d97706' : '#0a6a3f';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) {
                  e.target.style.background = !isOnline ? '#f59e0b' : '#0b7e4b';
                }
              }}
            >
              {isSubmitting ? '⏳ Submitting...' : (!isOnline ? '💾 Save Offline' : '📋 Submit Report')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportForm;