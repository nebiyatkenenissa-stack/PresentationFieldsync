import React, { useState, useMemo } from 'react';
import { exportCSV, exportJSON } from '../../utils/helpers';

function AllReports({ reports, users, supervisorReports }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const filteredReports = useMemo(() => {
    let filtered = reports;

    if (selectedRegion !== 'All') {
      filtered = filtered.filter(r => r.region === selectedRegion);
    }

    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.region?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateRange.start) {
      filtered = filtered.filter(r => r.reportDate >= dateRange.start);
    }
    if (dateRange.end) {
      filtered = filtered.filter(r => r.reportDate <= dateRange.end);
    }

    return filtered;
  }, [reports, selectedRegion, searchTerm, dateRange]);

  const filteredSupervisorReports = useMemo(() => {
    let filtered = supervisorReports || [];
    if (selectedRegion !== 'All') {
      filtered = filtered.filter(r => r.region === selectedRegion);
    }
    return filtered;
  }, [supervisorReports, selectedRegion]);

  return (
    <div className="all-reports-view">
      <div className="form-card">
        <div className="form-header">
          <div>
            <h3>📋 All Reports</h3>
            <p>Complete overview of all reports from all officers and supervisors</p>
          </div>
          <span className="form-badge">{reports.length} Total Reports</span>
        </div>
      </div>

      <div className="table-card">
        <div className="table-header">
          <div>
            <h3>All Daily Reports</h3>
            <p>{filteredReports.length} reports found</p>
          </div>
          <div className="table-actions">
            <input 
              type="text" 
              placeholder="🔍 Search reports..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="search-input" 
            />
            <select 
              value={selectedRegion} 
              onChange={e => setSelectedRegion(e.target.value)} 
              className="filter-select"
            >
              <option value="All">All Regions</option>
              <option value="North">North</option>
              <option value="South">South</option>
              <option value="East">East</option>
              <option value="West">West</option>
              <option value="Central">Central</option>
            </select>
            <input 
              type="date" 
              value={dateRange.start} 
              onChange={e => setDateRange({...dateRange, start: e.target.value})} 
              className="date-input" 
              placeholder="Start" 
            />
            <input 
              type="date" 
              value={dateRange.end} 
              onChange={e => setDateRange({...dateRange, end: e.target.value})} 
              className="date-input" 
              placeholder="End" 
            />
            <button className="btn-export" onClick={() => exportCSV(filteredReports, 'all_reports')}>📥 CSV</button>
            <button className="btn-export" onClick={() => exportJSON(filteredReports, 'all_reports')}>📥 JSON</button>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Officer</th>
                <th>Supervisor</th>
                <th>Site</th>
                <th>Region</th>
                <th>Citizens</th>
                <th>Attendance</th>
                <th>Status</th>
                <th>Sync</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan="9" className="empty-state">
                    <div className="empty-icon">📋</div>
                    <div>No reports found</div>
                    <small>Try adjusting your filters</small>
                  </td>
                </tr>
              )}
              {filteredReports.map(r => {
                const supervisor = users?.find(u => u.id === r.supervisorId);
                return (
                  <tr key={r.id}>
                    <td>{r.reportDate}</td>
                    <td><strong>{r.employeeName}</strong></td>
                    <td>{supervisor?.name || 'N/A'}</td>
                    <td><strong>{r.siteName}</strong></td>
                    <td><span className="region-tag">{r.region}</span></td>
                    <td>{r.registrations}</td>
                    <td>
                      <span className={`attendance-tag ${r.attendance || 'present'}`}>
                        {r.attendance || 'Present'}
                      </span>
                    </td>
                    <td><span className="status-tag">{r.operationalStatus}</span></td>
                    <td>
                      {r.synced ? 
                        <span className="sync-tag synced">✅ Synced</span> : 
                        <span className="sync-tag pending">⏳ Pending</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supervisor Reports Section */}
      <div className="table-card" style={{marginTop: '24px'}}>
        <div className="table-header">
          <div>
            <h3>Supervisor Reports</h3>
            <p>{filteredSupervisorReports.length} supervisor reports found</p>
          </div>
          <button className="btn-export" onClick={() => exportCSV(filteredSupervisorReports, 'supervisor_reports_all')}>📥 CSV</button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Supervisor</th>
                <th>Officer</th>
                <th>Performance</th>
                <th>Rating</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredSupervisorReports.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-state">
                    <div className="empty-icon">📋</div>
                    <div>No supervisor reports found</div>
                  </td>
                </tr>
              )}
              {filteredSupervisorReports.map(r => (
                <tr key={r.id}>
                  <td>{r.reportDate}</td>
                  <td>{r.supervisorName}</td>
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
    </div>
  );
}

export default AllReports;