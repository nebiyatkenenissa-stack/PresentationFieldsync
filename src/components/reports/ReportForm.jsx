// components/reports/ReportForm.js – FULLY FIXED (with date validation: today only)

import React, { useState, useEffect } from 'react';
import { db, syncQueue, checkRealInternet } from '../../services/database';
import { uid } from '../../utils/helpers';

const API_BASE = 'http://localhost:5000/api';

function ReportForm({ form, setForm, handleSubmit, user, isOfficer, isSupervisor, addNotification, users }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [customSite, setCustomSite] = useState('');

  // Predefined sites
  const predefinedSites = ['Site A', 'Site B', 'Site C', 'Site D', 'Site E'];

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

  // ============================================================
  // VALIDATION FUNCTIONS (including reportDate)
  // ============================================================
  const validateField = (name, value, allFormValues = null) => {
    const formData = allFormValues || form;
    switch (name) {
      case 'reportDate':
        if (!value) return 'Report date is required';
        const selectedDate = new Date(value);
        const today = new Date();
        // Reset time to compare dates only
        const todayStr = today.toISOString().slice(0, 10);
        if (value > todayStr) return 'Report date cannot be in the future';
        if (value < todayStr) return 'Report date cannot be in the past (only today allowed)';
        return '';
      case 'siteName':
        const selectedValue = formData.siteName;
        if (!selectedValue || !selectedValue.trim()) {
          if (formData._siteSelection === 'Other' && (!customSite || !customSite.trim())) {
            return 'Please enter a custom site name';
          }
          return 'Site name is required';
        }
        return '';
      case 'registrations':
        const num = Number(value);
        if (isNaN(num) || num < 0) return 'Registrations must be a non-negative number';
        return '';
      case 'attendance':
        if (!value) return 'Attendance status is required';
        return '';
      case 'workHours':
        const hours = Number(value);
        if (isNaN(hours) || hours < 0 || hours > 24) return 'Work hours must be between 0 and 24';
        return '';
      case 'operationalStatus':
        if (!value) return 'Operational status is required';
        return '';
      case 'activities':
        if (!value || !value.trim()) return 'Activities performed is required';
        return '';
      case 'equipmentStatus':
        if (!value) return 'Equipment status is required';
        return '';
      case 'materialsUsed':
        if (!value || !value.trim()) return 'Materials used is required';
        return '';
      case 'teamMembers':
        if (!value || !value.trim()) return 'Team members is required';
        return '';
      case 'weatherConditions':
        if (!value || !value.trim()) return 'Weather conditions is required';
        return '';
      case 'communityFeedback':
        if (!value || !value.trim()) return 'Community feedback is required';
        return '';
      case 'challenges':
        if (!value || !value.trim()) return 'Challenges is required';
        return '';
      case 'issues':
        if (!value || !value.trim()) return 'Issues encountered is required';
        return '';
      case 'comments':
        if (!value || !value.trim()) return 'Comments is required';
        return '';
      default:
        return '';
    }
  };

  const validateAll = () => {
    const newErrors = {};
    const fields = [
      'reportDate', 'siteName', 'registrations', 'attendance', 'workHours',
      'operationalStatus', 'activities', 'equipmentStatus',
      'materialsUsed', 'teamMembers', 'weatherConditions',
      'communityFeedback', 'challenges', 'issues', 'comments'
    ];
    fields.forEach(f => {
      const error = validateField(f, form[f]);
      if (error) newErrors[f] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    if (name === 'siteName' && form._siteSelection === 'Other') {
      const error = customSite && customSite.trim() ? '' : 'Please enter a custom site name';
      setErrors(prev => ({ ...prev, siteName: error }));
      return;
    }
    const error = validateField(name, form[name]);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  // ============================================================
  // HANDLE SITE SELECTION (with "Other")
  // ============================================================
  const handleSiteChange = (e) => {
    const value = e.target.value;
    if (value === 'Other') {
      setForm(prev => ({ ...prev, siteName: '', _siteSelection: 'Other' }));
      setCustomSite('');
      setErrors(prev => ({ ...prev, siteName: '' }));
    } else {
      setForm(prev => ({ ...prev, siteName: value, _siteSelection: value }));
      setCustomSite('');
      setTouched(prev => ({ ...prev, siteName: true }));
      const error = validateField('siteName', value);
      setErrors(prev => ({ ...prev, siteName: error }));
    }
  };

  const handleCustomSiteChange = (e) => {
    const value = e.target.value;
    setCustomSite(value);
    setForm(prev => ({ ...prev, siteName: value, _siteSelection: 'Other' }));
    setTouched(prev => ({ ...prev, siteName: true }));
    const error = value && value.trim() ? '' : 'Please enter a custom site name';
    setErrors(prev => ({ ...prev, siteName: error }));
  };

  // ============================================================
  // GENERIC HANDLE CHANGE (for all other fields including reportDate)
  // ============================================================
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setForm(prev => ({ ...prev, [name]: newValue }));
    setTouched(prev => ({ ...prev, [name]: true }));
    if (name !== 'siteName') {
      const error = validateField(name, newValue);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  // ============================================================
  // SUBMIT HANDLER
  // ============================================================
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Please login first');
      return;
    }

    // Final validation check for siteName with "Other"
    if (form._siteSelection === 'Other' && (!customSite || !customSite.trim())) {
      setErrors(prev => ({ ...prev, siteName: 'Please enter a custom site name' }));
      setTouched(prev => ({ ...prev, siteName: true }));
      alert('Please enter a custom site name.');
      return;
    }

    // Validate all fields
    const isValid = validateAll();
    if (!isValid) {
      const firstError = document.querySelector('.field-error');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      const errorMessages = Object.entries(errors)
        .filter(([_, msg]) => msg)
        .map(([field, msg]) => {
          const fieldNames = {
            reportDate: 'Report Date',
            siteName: 'Site Name',
            registrations: 'Citizens Registered',
            attendance: 'Attendance Status',
            workHours: 'Work Hours',
            operationalStatus: 'Operational Status',
            activities: 'Activities',
            equipmentStatus: 'Equipment Status',
            materialsUsed: 'Materials Used',
            teamMembers: 'Team Members',
            weatherConditions: 'Weather Conditions',
            communityFeedback: 'Community Feedback',
            challenges: 'Challenges',
            issues: 'Issues',
            comments: 'Comments'
          };
          return `• ${fieldNames[field] || field}: ${msg}`;
        })
        .join('\n');
      
      alert(`Please fix the following errors:\n\n${errorMessages}`);
      return;
    }

    setIsSubmitting(true);

    try {
      const online = await checkRealInternet();
      setIsOnline(online);

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
        synced: false,
        syncAttempts: 0,
        syncError: null,
        reviewed: false,
        reviewedBy: null,
        offlineSaved: false
      };

      await db.reports.add(newReport);

      let syncSuccess = false;
      if (online) {
        try {
          const response = await fetch(`${API_BASE}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'report',
              data: newReport
            })
          });

          if (response.ok) {
            await db.reports.update(newReport.id, { 
              synced: true,
              syncedAt: new Date().toISOString()
            });
            syncSuccess = true;
          } else {
            throw new Error(`Server responded with ${response.status}`);
          }
        } catch (syncError) {
          console.warn('❌ Failed to sync report, queueing:', syncError.message);
          await db.reports.update(newReport.id, {
            synced: false,
            syncError: syncError.message,
            lastSyncAttempt: Date.now()
          });
          syncQueue.add({
            type: 'report',
            id: newReport.id,
            data: newReport
          });
          if (addNotification) {
            await addNotification(
              user.id,
              '📋 Report Queued for Sync',
              `Report for ${form.siteName} saved locally. Will sync automatically when online.`,
              'warning'
            );
          }
          alert('📋 Report saved locally. Will sync when online.');
        }
      } else {
        await db.reports.update(newReport.id, {
          synced: false,
          offlineSaved: true
        });
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
      }

      if (syncSuccess) {
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

      // Reset form (keep reportDate as today)
      setForm({
        reportDate: form.reportDate, // keep today's date
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
      setCustomSite('');
      setErrors({});
      setTouched({});

    } catch (error) {
      console.error('Error submitting report:', error);
      alert('❌ Error submitting report: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="reports-view" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="form-card" style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb',
        padding: '24px'
      }}>
        <div className="form-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1a202c' }}>Submit Daily Report</h3>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
              {isSupervisor ? 'Submit your supervisor report' : 'Record registration data and attendance'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              background: isOnline ? '#d1fae5' : '#fee2e2',
              color: isOnline ? '#065f37' : '#991b1b',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500'
            }}>
              {isOnline ? '✅ Online' : '📡 Offline'}
            </span>
            <span style={{
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

        {/* Offline Warning */}
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

        {/* Error Summary */}
        {Object.values(errors).some(e => e) && (
          <div style={{
            padding: '12px 16px',
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            marginBottom: '16px',
            color: '#991b1b'
          }}>
            <strong>⚠️ Please fix the following errors:</strong>
            <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
              {Object.entries(errors).map(([field, msg]) => {
                if (!msg) return null;
                const fieldNames = {
                  reportDate: 'Report Date',
                  siteName: 'Site Name',
                  registrations: 'Citizens Registered',
                  attendance: 'Attendance Status',
                  workHours: 'Work Hours',
                  operationalStatus: 'Operational Status',
                  activities: 'Activities',
                  equipmentStatus: 'Equipment Status',
                  materialsUsed: 'Materials Used',
                  teamMembers: 'Team Members',
                  weatherConditions: 'Weather Conditions',
                  communityFeedback: 'Community Feedback',
                  challenges: 'Challenges',
                  issues: 'Issues',
                  comments: 'Comments'
                };
                return <li key={field}>{fieldNames[field] || field}: {msg}</li>;
              })}
            </ul>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="report-form" noValidate>
          {/* Row 1: Date, Region, Site */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Report Date *
              </label>
              <input 
                type="date" 
                name="reportDate"
                value={form.reportDate} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                required 
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.reportDate && errors.reportDate ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                max={new Date().toISOString().slice(0, 10)}
              />
              {touched.reportDate && errors.reportDate && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.reportDate}
                </span>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Region
              </label>
              <input 
                value={form.region || user?.region} 
                disabled 
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: '#f3f4f6',
                  color: '#6b7280'
                }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Site Name *
              </label>
              <select 
                name="siteName"
                value={form._siteSelection === 'Other' ? 'Other' : (predefinedSites.includes(form.siteName) ? form.siteName : '')}
                onChange={handleSiteChange}
                onBlur={handleBlur}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.siteName && errors.siteName ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                  outline: 'none'
                }}
              >
                <option value="">Select Site</option>
                {predefinedSites.map(site => (
                  <option key={site} value={site}>{site}</option>
                ))}
                <option value="Other">Other</option>
              </select>
              {form._siteSelection === 'Other' && (
                <input
                  type="text"
                  value={customSite}
                  onChange={handleCustomSiteChange}
                  placeholder="Enter custom site name"
                  required
                  style={{
                    width: '100%',
                    marginTop: '6px',
                    padding: '8px 12px',
                    border: `1px solid ${errors.siteName ? '#dc2626' : '#d1d5db'}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              )}
              {touched.siteName && errors.siteName && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.siteName}
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Registrations, Attendance, Work Hours */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Citizens Registered Today *
              </label>
              <input 
                type="number" 
                min="0" 
                name="registrations"
                value={form.registrations} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                required 
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.registrations && errors.registrations ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              {touched.registrations && errors.registrations && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.registrations}
                </span>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Attendance Status *
              </label>
              <select 
                name="attendance"
                value={form.attendance} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.attendance && errors.attendance ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                  outline: 'none'
                }}
              >
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="half_day">Half Day</option>
                <option value="absent">Absent</option>
              </select>
              {touched.attendance && errors.attendance && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.attendance}
                </span>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Work Hours *
              </label>
              <input 
                type="number" 
                min="0" 
                max="24" 
                name="workHours"
                value={form.workHours} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.workHours && errors.workHours ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              {touched.workHours && errors.workHours && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.workHours}
                </span>
              )}
            </div>
          </div>

          {/* Row 3: Operational Status, Activities */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Operational Status *
              </label>
              <select 
                name="operationalStatus"
                value={form.operationalStatus} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.operationalStatus && errors.operationalStatus ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                  outline: 'none'
                }}
              >
                <option value="Active">Active</option>
                <option value="Delayed">Delayed</option>
                <option value="Interrupted">Interrupted</option>
                <option value="Closed">Closed</option>
              </select>
              {touched.operationalStatus && errors.operationalStatus && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.operationalStatus}
                </span>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Activities Performed *
              </label>
              <textarea 
                name="activities"
                value={form.activities} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Describe activities performed today" 
                rows="2"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.activities && errors.activities ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical',
                  minHeight: '60px',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
              />
              {touched.activities && errors.activities && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.activities}
                </span>
              )}
            </div>
          </div>

          {/* Row 4: Equipment Status, Materials Used */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Equipment Status *
              </label>
              <select 
                name="equipmentStatus"
                value={form.equipmentStatus} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.equipmentStatus && errors.equipmentStatus ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: 'white',
                  outline: 'none'
                }}
              >
                <option value="operational">Operational</option>
                <option value="partial">Partially Operational</option>
                <option value="non_operational">Non-Operational</option>
              </select>
              {touched.equipmentStatus && errors.equipmentStatus && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.equipmentStatus}
                </span>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Materials Used *
              </label>
              <input 
                type="text" 
                name="materialsUsed"
                value={form.materialsUsed} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Materials consumed"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.materialsUsed && errors.materialsUsed ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              {touched.materialsUsed && errors.materialsUsed && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.materialsUsed}
                </span>
              )}
            </div>
          </div>

          {/* Row 5: Team Members, Weather */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Team Members Present *
              </label>
              <input 
                type="text" 
                name="teamMembers"
                value={form.teamMembers} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Names of team members"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.teamMembers && errors.teamMembers ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              {touched.teamMembers && errors.teamMembers && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.teamMembers}
                </span>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Weather Conditions *
              </label>
              <input 
                type="text" 
                name="weatherConditions"
                value={form.weatherConditions} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Weather conditions"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.weatherConditions && errors.weatherConditions ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              {touched.weatherConditions && errors.weatherConditions && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.weatherConditions}
                </span>
              )}
            </div>
          </div>

          {/* Row 6: Community Feedback, Challenges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Community Feedback *
              </label>
              <input 
                type="text" 
                name="communityFeedback"
                value={form.communityFeedback} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Community feedback received"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.communityFeedback && errors.communityFeedback ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              {touched.communityFeedback && errors.communityFeedback && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.communityFeedback}
                </span>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Challenges Faced *
              </label>
              <input 
                type="text" 
                name="challenges"
                value={form.challenges} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Describe any challenges"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.challenges && errors.challenges ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              {touched.challenges && errors.challenges && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.challenges}
                </span>
              )}
            </div>
          </div>

          {/* Row 7: Issues, Comments */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Issues Encountered *
              </label>
              <input 
                type="text" 
                name="issues"
                value={form.issues} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Any issues?"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.issues && errors.issues ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              {touched.issues && errors.issues && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.issues}
                </span>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
                Additional Comments *
              </label>
              <input 
                type="text" 
                name="comments"
                value={form.comments} 
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder="Additional notes"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${touched.comments && errors.comments ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              {touched.comments && errors.comments && (
                <span className="field-error" style={{ color: '#dc2626', fontSize: '13px', display: 'block', marginTop: '4px' }}>
                  {errors.comments}
                </span>
              )}
            </div>
          </div>

          {/* Submit Area */}
          <div className="form-actions" style={{ 
            marginTop: '20px', 
            display: 'flex', 
            gap: '12px',
            justifyContent: 'flex-end',
            alignItems: 'center',
            borderTop: '1px solid #e5e7eb',
            paddingTop: '20px'
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