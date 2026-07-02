import React from 'react';

function ReportForm({ form, setForm, handleSubmit, user, isOfficer, isSupervisor }) {
  return (
    <div className="reports-view">
      <div className="form-card">
        <div className="form-header">
          <div>
            <h3>Submit Daily Report</h3>
            <p>{isSupervisor ? 'Submit your supervisor report' : 'Record registration data and attendance'}</p>
          </div>
          <span className="form-badge">Offline Ready</span>
        </div>

        <form onSubmit={handleSubmit} className="report-form">
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
            justifyContent: 'flex-end'
          }}>
            <button 
              type="submit" 
              className="btn-submit"
              style={{
                opacity: 1,
                visibility: 'visible',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#0b7e4b',
                color: 'white',
                padding: '10px 24px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                minWidth: '140px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.background = '#0a6a3f'}
              onMouseLeave={(e) => e.target.style.background = '#0b7e4b'}
            >
              📋 Submit Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportForm;