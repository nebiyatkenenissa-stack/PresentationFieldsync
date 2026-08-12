// components/reports/ReportForm.js – FULLY FIXED (with date validation: today only)

import React, { useState, useEffect } from 'react';
import { db, syncQueue, checkRealInternet, getApiBase } from '../../services/database';
import { uid } from '../../utils/helpers';
import LocationCascade from '../common/LocationCascade';
import GpsCapture from '../common/GpsCapture';
import { getCurrentGps } from '../../utils/gps';

const API_BASE = getApiBase();

function ReportForm({ form, setForm, handleSubmit, user, isOfficer, isSupervisor, addNotification, users }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [location, setLocation] = useState(() => {
    const map = {
      country: user?.country_id,
      region: user?.region_id,
      zone: user?.zone_id,
      woreda: user?.woreda_id,
      kebele: user?.kebele_id,
      community: user?.community_id
    };
    const out = {};
    Object.keys(map).forEach((level) => {
      if (map[level]) out[level] = { id: Number(map[level]), name: null };
    });
    return out;
  });
  const [gps, setGps] = useState(null);

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
      case 'registrations':
        const num = Number(value);
        if (isNaN(num) || num < 0) return 'Registrations must be a non-negative number';
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
      'reportDate', 'registrations', 'workHours',
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
    const error = validateField(name, form[name]);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  // ============================================================
  // GENERIC HANDLE CHANGE (for all other fields including reportDate)
  // ============================================================
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    setForm(prev => ({ ...prev, [name]: newValue }));
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, newValue);
    setErrors(prev => ({ ...prev, [name]: error }));
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
            registrations: 'Citizens Registered',
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

    // Officers can only work within their assigned area (community too when assigned)
    if (isOfficer && user) {
      const assigned = {
        country: user.country_id,
        region: user.region_id,
        zone: user.zone_id,
        woreda: user.woreda_id,
        kebele: user.kebele_id,
        community: user.community_id
      };
      const mismatchLevels = [];
      Object.keys(assigned).forEach((level) => {
        const expected = assigned[level] != null ? Number(assigned[level]) : null;
        const selected = location[level]?.id;
        if (expected !== null && selected !== undefined && selected !== null && Number(selected) !== expected) {
          mismatchLevels.push(level.charAt(0).toUpperCase() + level.slice(1));
        }
      });
      if (mismatchLevels.length > 0) {
        alert(`❌ You can only work in your assigned area. ${mismatchLevels.join(', ')} cannot be changed.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const online = await checkRealInternet();
      setIsOnline(online);

      let gpsData = gps;
      if (!gpsData) {
        gpsData = await getCurrentGps(6000);
      }

      const newReport = {
        id: uid(),
        reportId: `RPT-${Date.now()}`,
        reportDate: form.reportDate,
        region: location.region?.name || form.region || user.region || '',
        country_id: location.country?.id === 'OTHER' ? null : (location.country?.id || null),
        region_id: location.region?.id === 'OTHER' ? null : (location.region?.id || null),
        zone_id: location.zone?.id === 'OTHER' ? null : (location.zone?.id || null),
        woreda_id: location.woreda?.id === 'OTHER' ? null : (location.woreda?.id || null),
        kebele_id: location.kebele?.id === 'OTHER' ? null : (location.kebele?.id || null),
        community_id: location.community?.id === 'OTHER' ? null : (location.community?.id || null),
        location_path: ['country', 'region', 'zone', 'woreda', 'kebele', 'community']
          .filter((level) => location[level])
          .map((level) => ({ level, id: location[level].id, name: location[level].name || null })),
        employeeId: user.employeeId,
        employeeName: user.name,
        supervisorId: user.supervisorId || '',
        registrations: Number(form.registrations) || 0,
        registrationEfficiency: Math.round((Number(form.registrations) / 100) * 100),
        operationalStatus: form.operationalStatus,
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
        latitude: gpsData?.success ? gpsData.latitude : null,
        longitude: gpsData?.success ? gpsData.longitude : null,
        gpsAccuracy: gpsData?.success ? gpsData.accuracy : null,
        gpsCapturedAt: gpsData?.success ? gpsData.timestamp : null,
        synced: false,
        syncAttempts: 0,
        syncError: null,
        reviewed: false,
        reviewedBy: null,
        offlineSaved: false
      };

      await db.reports.add(newReport);
      window.dispatchEvent(new CustomEvent('report-update', { detail: { id: newReport.id } }));

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
              `Report saved locally. Server sync failed and will be retried automatically.`,
              'warning'
            );
          }
          alert('⚠️ Report saved locally, but the server could not be reached. It will be retried automatically.');
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
            `Report saved offline. Will sync automatically when online.`,
            'warning'
          );
        }
        alert('📋 Report saved OFFLINE! Will sync automatically when internet is back.');
      }

      // Notify the supervisor/manager only after the report actually reaches
      // the server. Offline reports fire this later via the 'report-synced'
      // event, so the message appears at the same time the report becomes
      // visible on the supervisor/manager pages.
      const notifySupervisorManager = async () => {
        if (isOfficer && user) {
          const supervisor = users?.find(u => u.id === user.supervisorId);
          if (supervisor && addNotification) {
            await addNotification(
              supervisor.id,
              '📋 Report Submitted',
              `${user.name} submitted a report`,
              'success'
            );
          }
          const manager = users?.find(u => u.role === 'manager');
          if (manager && addNotification) {
            await addNotification(
              manager.id,
              '📋 Report Submitted',
              `${user.name} submitted a report`,
              'info'
            );
          }
        } else if (isSupervisor && user) {
          const manager = users?.find(u => u.role === 'manager');
          if (manager && addNotification) {
            await addNotification(
              manager.id,
              '📋 Report Submitted',
              `${user.name} submitted a report`,
              'info'
            );
          }
        }
      };

      if (syncSuccess && addNotification) {
        await addNotification(
          user.id,
          '✅ Report Synced',
          `Report submitted and synced to the server.`,
          'success'
        );
      }

      if (syncSuccess) {
        window.dispatchEvent(new CustomEvent('report-update', { detail: { id: newReport.id, synced: true } }));
        await notifySupervisorManager();
        alert('📋 Report submitted and synced successfully!');
      }

      // Reset form (keep reportDate as today)
      setForm({
        reportDate: form.reportDate, // keep today's date
        region: form.region || user.region,
        registrations: 0,
        operationalStatus: 'Active',
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
      {/* ===== HERO HEADER (dashboard style) ===== */}
      <div style={{
        background: 'linear-gradient(135deg, #0f2a4a 0%, #1e3a5f 55%, #2563eb 120%)',
        borderRadius: '16px',
        padding: '28px 28px 26px',
        margin: '0 0 24px',
        color: 'white',
        boxShadow: '0 8px 24px rgba(15,42,74,0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>
            {isSupervisor ? '👤 Submit Supervisor Report' : '📋 Submit Daily Report'}
          </h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            {isSupervisor ? 'Submit your supervisor report' : 'Record registration data'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{
            background: isOnline ? 'rgba(16,185,129,0.2)' : 'rgba(248,113,113,0.25)',
            border: isOnline ? '1px solid rgba(52,211,153,0.5)' : '1px solid rgba(252,165,165,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {isOnline ? '✅ Online' : '📡 Offline'}
          </span>
          <span style={{
            background: 'rgba(96,165,250,0.2)',
            border: '1px solid rgba(147,197,253,0.5)',
            padding: '6px 14px',
            borderRadius: '24px',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {isOnline ? 'Auto-Sync Enabled' : 'Offline Save'}
          </span>
        </div>
      </div>

      <div className="form-card" style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        border: '1px solid #e5e7eb',
        padding: '24px'
      }}>
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
                  registrations: 'Citizens Registered',
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
          {/* Row 1: Date, Region */}
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
          </div>

          {/* Location Hierarchy: Country -> Region -> Zone -> Woreda -> Kebele -> Community */}
          <div style={{ marginBottom: '16px' }}>
            {isOfficer && (
              <div style={{
                padding: '10px 14px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#1e40af',
                marginBottom: '10px'
              }}>
                {user?.community_id
                  ? '🔒 Your working area is locked to your assigned community. You cannot change any location field.'
                  : '🔒 Your working area is locked to your assigned region. You can only change the community.'}
              </div>
            )}
            <LocationCascade
              initial={location}
              onChange={setLocation}
              requiredLevels={['region']}
              disabled={isSubmitting}
              lockLevels={isOfficer
                ? (user?.community_id
                    ? ['country', 'region', 'zone', 'woreda', 'kebele', 'community']
                    : ['country', 'region', 'zone', 'woreda', 'kebele'])
                : []}
            />
          </div>

          {/* GPS Location */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: '500', marginBottom: '4px', fontSize: '14px', color: '#374151' }}>
              📍 GPS Location
            </label>
            <GpsCapture onCoords={setGps} />
          </div>

          {/* Row 2: Registrations, Work Hours */}
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