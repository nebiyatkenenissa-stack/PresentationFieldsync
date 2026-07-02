import React, { useState } from 'react';
import { getToday, uid } from '../../utils/helpers';
import { db } from '../../services/database';

function SupervisorReports({ supervisorReports, users, user, teamMembers }) {
  const [showOfficerReport, setShowOfficerReport] = useState(false);
  const [showSelfReport, setShowSelfReport] = useState(false);
  const [form, setForm] = useState({
    officerId: '',
    reportDate: getToday(),
    performance: 'good',
    attendance: 'good',
    quality: 'good',
    punctuality: 'good',
    teamwork: 'good',
    communication: 'good',
    comments: '',
    recommendations: '',
    overallRating: 3
  });

  const [selfForm, setSelfForm] = useState({
    reportDate: getToday(),
    region: '',
    siteVisits: 0,
    issuesResolved: 0,
    challenges: '',
    achievements: '',
    teamMorale: 'good',
    resourceStatus: 'adequate',
    recommendations: '',
    overallStatus: 'good'
  });

  const handleOfficerReportSubmit = async (e) => {
    e.preventDefault();
    const officer = users.find(u => u.id === form.officerId);
    if (!officer) { alert('Please select an officer'); return; }

    const report = {
      id: uid(),
      supervisorId: user.id,
      supervisorName: user.name,
      officerId: officer.id,
      officerName: officer.name,
      officerRegion: officer.region,
      reportDate: form.reportDate,
      performance: form.performance,
      attendance: form.attendance,
      quality: form.quality,
      punctuality: form.punctuality,
      teamwork: form.teamwork,
      communication: form.communication,
      comments: form.comments,
      recommendations: form.recommendations,
      overallRating: form.overallRating,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      region: officer.region,
      type: 'officer_report'
    };
    await db.supervisor_reports.add(report);
    setShowOfficerReport(false);
    alert('✅ Supervisor report submitted successfully!');
  };

  const handleSelfReportSubmit = async (e) => {
    e.preventDefault();
    const report = {
      id: uid(),
      supervisorId: user.id,
      supervisorName: user.name,
      reportDate: selfForm.reportDate,
      region: selfForm.region || user.region,
      siteVisits: selfForm.siteVisits,
      issuesResolved: selfForm.issuesResolved,
      challenges: selfForm.challenges,
      achievements: selfForm.achievements,
      teamMorale: selfForm.teamMorale,
      resourceStatus: selfForm.resourceStatus,
      recommendations: selfForm.recommendations,
      overallStatus: selfForm.overallStatus,
      submittedAt: new Date().toISOString(),
      type: 'self_report'
    };
    await db.supervisor_reports.add(report);
    setShowSelfReport(false);
    alert('✅ Self report submitted successfully!');
  };

  const reports = supervisorReports.filter(r => r.supervisorId === user?.id);

  return (
    <div className="supervisor-reports-view">
      <div className="form-card">
        <div className="form-header">
          <div>
            <h3>📋 Supervisor Reports</h3>
            <p>Submit reports about your team members and your own work status</p>
          </div>
        </div>
        <div className="report-actions" style={{display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px'}}>
          <button 
            className="btn-primary" 
            onClick={() => setShowOfficerReport(true)}
            style={{
              opacity: 1,
              visibility: 'visible',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#1e3a5f',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            📝 Report About Officer
          </button>
          <button 
            className="btn-primary" 
            onClick={() => setShowSelfReport(true)}
            style={{
              opacity: 1,
              visibility: 'visible',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#2b4c7a',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            📝 Submit Self Report
          </button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>My Supervisor Reports</h3>
            <p>{reports.length} reports submitted</p>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Officer</th>
                <th>Performance</th>
                <th>Rating</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-state">
                    <div className="empty-icon">📋</div>
                    <div>No supervisor reports found</div>
                  </td>
                </tr>
              )}
              {reports.map(r => (
                <tr key={r.id}>
                  <td>{r.reportDate}</td>
                  <td>{r.type === 'self_report' ? '📋 Self Report' : '👤 Officer Report'}</td>
                  <td>{r.type === 'self_report' ? r.supervisorName : r.officerName}</td>
                  <td>
                    <span className={`status-tag ${r.overallStatus || r.performance}`}>
                      {r.overallStatus || r.performance}
                    </span>
                  </td>
                  <td>{r.type === 'self_report' ? 'N/A' : `${r.overallRating}/5 ⭐`}</td>
                  <td><span className="status-tag submitted">✅ Submitted</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Officer Report Modal */}
      {showOfficerReport && (
        <div className="modal-overlay" onClick={() => setShowOfficerReport(false)}>
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
              <h3 style={{fontSize: '20px', fontWeight: '600'}}>📝 Report About Officer</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowOfficerReport(false)}
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
            <form onSubmit={handleOfficerReportSubmit} className="modal-form" style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Select Officer *</label>
                <select 
                  value={form.officerId} 
                  onChange={e => setForm({...form, officerId: e.target.value})}
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
                  {teamMembers.map(o => (
                    <option key={o.id} value={o.id}>{o.name} ({o.region})</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Report Date *</label>
                <input 
                  type="date" 
                  value={form.reportDate} 
                  onChange={e => setForm({...form, reportDate: e.target.value})}
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
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Performance</label>
                  <select 
                    value={form.performance} 
                    onChange={e => setForm({...form, performance: e.target.value})}
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
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="poor">⚠️ Poor</option>
                  </select>
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Attendance</label>
                  <select 
                    value={form.attendance} 
                    onChange={e => setForm({...form, attendance: e.target.value})}
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
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="poor">⚠️ Poor</option>
                  </select>
                </div>
              </div>
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Quality of Work</label>
                  <select 
                    value={form.quality} 
                    onChange={e => setForm({...form, quality: e.target.value})}
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
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="poor">⚠️ Poor</option>
                  </select>
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Punctuality</label>
                  <select 
                    value={form.punctuality} 
                    onChange={e => setForm({...form, punctuality: e.target.value})}
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
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="poor">⚠️ Poor</option>
                  </select>
                </div>
              </div>
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Teamwork</label>
                  <select 
                    value={form.teamwork} 
                    onChange={e => setForm({...form, teamwork: e.target.value})}
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
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="poor">⚠️ Poor</option>
                  </select>
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Communication</label>
                  <select 
                    value={form.communication} 
                    onChange={e => setForm({...form, communication: e.target.value})}
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
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="poor">⚠️ Poor</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Overall Rating (1-5) *</label>
                <input 
                  type="number" 
                  min="1" 
                  max="5" 
                  value={form.overallRating} 
                  onChange={e => setForm({...form, overallRating: parseInt(e.target.value)})}
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
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Comments</label>
                <textarea 
                  value={form.comments} 
                  onChange={e => setForm({...form, comments: e.target.value})}
                  placeholder="Any additional comments about the officer..." 
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
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Recommendations</label>
                <textarea 
                  value={form.recommendations} 
                  onChange={e => setForm({...form, recommendations: e.target.value})}
                  placeholder="Recommendations for improvement..." 
                  rows="2"
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
                  Submit Report
                </button>
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setShowOfficerReport(false)}
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

      {/* Self Report Modal */}
      {showSelfReport && (
        <div className="modal-overlay" onClick={() => setShowSelfReport(false)}>
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
              <h3 style={{fontSize: '20px', fontWeight: '600'}}>📋 Supervisor Self Report</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowSelfReport(false)}
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
            <form onSubmit={handleSelfReportSubmit} className="modal-form" style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Report Date *</label>
                <input 
                  type="date" 
                  value={selfForm.reportDate} 
                  onChange={e => setSelfForm({...selfForm, reportDate: e.target.value})}
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
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Site Visits *</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={selfForm.siteVisits} 
                    onChange={e => setSelfForm({...selfForm, siteVisits: parseInt(e.target.value) || 0})}
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
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Issues Resolved</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={selfForm.issuesResolved} 
                    onChange={e => setSelfForm({...selfForm, issuesResolved: parseInt(e.target.value) || 0})}
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
              </div>
              <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Team Morale</label>
                  <select 
                    value={selfForm.teamMorale} 
                    onChange={e => setSelfForm({...selfForm, teamMorale: e.target.value})}
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
                    <option value="excellent">⭐ Excellent</option>
                    <option value="good">✅ Good</option>
                    <option value="average">📊 Average</option>
                    <option value="low">⚠️ Low</option>
                  </select>
                </div>
                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Resource Status</label>
                  <select 
                    value={selfForm.resourceStatus} 
                    onChange={e => setSelfForm({...selfForm, resourceStatus: e.target.value})}
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
                    <option value="adequate">✅ Adequate</option>
                    <option value="limited">⚠️ Limited</option>
                    <option value="insufficient">❌ Insufficient</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Overall Status</label>
                <select 
                  value={selfForm.overallStatus} 
                  onChange={e => setSelfForm({...selfForm, overallStatus: e.target.value})}
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
                  <option value="excellent">⭐ Excellent</option>
                  <option value="good">✅ Good</option>
                  <option value="average">📊 Average</option>
                  <option value="challenging">⚠️ Challenging</option>
                </select>
              </div>
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Challenges Faced</label>
                <textarea 
                  value={selfForm.challenges} 
                  onChange={e => setSelfForm({...selfForm, challenges: e.target.value})}
                  placeholder="Describe any challenges you faced..." 
                  rows="2"
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
              <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                <label style={{fontSize: '13px', fontWeight: '500', color: '#374151'}}>Achievements</label>
                <textarea 
                  value={selfForm.achievements} 
                  onChange={e => setSelfForm({...selfForm, achievements: e.target.value})}
                  placeholder="Describe your achievements..." 
                  rows="2"
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
                  Submit Self Report
                </button>
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setShowSelfReport(false)}
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

export default SupervisorReports;