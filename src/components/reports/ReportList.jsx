// components/reports/ReportList.js – Enhanced with NEW badge and time display

import React, { useState, useEffect } from 'react';
import { syncQueue, checkRealInternet } from '../../services/database';

function ReportList({ reports, user, isOfficer, isSupervisor, addNotification }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  // Check online status and pending sync count
  useEffect(() => {
    const checkStatus = async () => {
      const online = await checkRealInternet();
      setIsOnline(online);
      const count = syncQueue.count();
      setPendingCount(count);
    };
    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    const handleQueueUpdate = () => {
      setPendingCount(syncQueue.count());
    };
    window.addEventListener('sync-queue-updated', handleQueueUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('sync-queue-updated', handleQueueUpdate);
    };
  }, []);

  // Filter reports and sort by submittedAt (newest first)
  const filteredReports = reports
    .filter(r => {
      if (isOfficer && user) {
        return r.employeeId === user.employeeId;
      }
      if (isSupervisor && user) {
        return true;
      }
      return true;
    })
    .filter(r => {
      if (searchTerm) {
        return r.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
               r.employeeName?.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    })
    .filter(r => {
      if (selectedRegion !== 'All') {
        return r.region === selectedRegion;
      }
      return true;
    })
    .sort((a, b) => {
      // Use submittedAt, fallback to createdAt, then reportDate
      const dateA = a.submittedAt || a.createdAt || a.reportDate;
      const dateB = b.submittedAt || b.createdAt || b.reportDate;
      return new Date(dateB) - new Date(dateA);
    });

  // Helper to check if report is new (within last 24 hours)
  const isNewReport = (report) => {
    const dateStr = report.submittedAt || report.createdAt || report.reportDate;
    if (!dateStr) return false;
    const reportDate = new Date(dateStr);
    const now = new Date();
    const diffHours = (now - reportDate) / (1000 * 60 * 60);
    return diffHours < 24;
  };

  // Helper to format date/time
  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {/* Header with sync status */}
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">📋 Reports</h2>
            <p className="text-gray-500 text-sm mt-1">
              {filteredReports.length} reports found
              {pendingCount > 0 && (
                <span style={{
                  marginLeft: '8px',
                  padding: '2px 10px',
                  background: '#fef3c7',
                  color: '#92400e',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  📡 {pendingCount} pending sync
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '500',
              background: isOnline ? '#d1fae5' : '#fee2e2',
              color: isOnline ? '#065f37' : '#991b1b'
            }}>
              {isOnline ? '✅ Online' : '📡 Offline'}
            </span>
            {pendingCount > 0 && isOnline && (
              <button
                onClick={() => window.dispatchEvent(new Event('force-sync'))}
                style={{
                  background: '#0b7e4b',
                  color: 'white',
                  border: 'none',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                🔄 Sync Now
              </button>
            )}
          </div>
        </div>

        {/* Offline Banner */}
        {!isOnline && pendingCount > 0 && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            padding: '8px 12px',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '13px',
            color: '#92400e'
          }}>
            📡 {pendingCount} report(s) saved offline. Will sync automatically when online.
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-4">
          <input 
            type="text" 
            placeholder="🔍 Search reports..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select 
            value={selectedRegion} 
            onChange={e => setSelectedRegion(e.target.value)} 
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Regions</option>
            <option value="North">North</option>
            <option value="South">South</option>
            <option value="East">East</option>
            <option value="West">West</option>
            <option value="Central">Central</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Submitted</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Officer</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Site</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Region</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Citizens</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Attendance</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Sync</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">New</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-8 text-gray-400">
                    {pendingCount > 0 ? (
                      <div>
                        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📡</div>
                        {pendingCount} report(s) saved offline. Will appear when synced.
                      </div>
                    ) : (
                      <div>No reports found</div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredReports.map(r => {
                  const isNew = isNewReport(r);
                  const submittedAt = r.submittedAt || r.createdAt || r.reportDate;
                  const displayDate = formatDateTime(submittedAt);
                  
                  return (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3 text-sm" style={{ whiteSpace: 'nowrap' }}>
                        {displayDate}
                      </td>
                      <td className="py-3 px-3 text-sm font-medium">{r.employeeName}</td>
                      <td className="py-3 px-3 text-sm font-medium">{r.siteName}</td>
                      <td className="py-3 px-3 text-sm">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">{r.region}</span>
                      </td>
                      <td className="py-3 px-3 text-sm">{r.registrations}</td>
                      <td className="py-3 px-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          r.attendance === 'present' ? 'bg-green-100 text-green-700' :
                          r.attendance === 'late' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {r.attendance || 'Present'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-sm">
                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs">{r.operationalStatus}</span>
                      </td>
                      <td className="py-3 px-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          r.synced ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {r.synced ? '✅ Synced' : '⏳ Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-sm">
                        {isNew && (
                          <span style={{
                            background: '#dc2626',
                            color: 'white',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '10px',
                            fontWeight: '700',
                            textTransform: 'uppercase'
                          }}>
                            NEW
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ReportList;