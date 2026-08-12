// components/reports/ReportList.js – Enhanced with NEW badge and time display

import React, { useState, useEffect, useMemo } from 'react';
import { syncQueue, checkRealInternet } from '../../services/database';
import { getRegionOptions, getEmployeeRegionMap } from '../../utils/helpers';
import UserAvatar from '../common/UserAvatar';

function ReportList({ reports, user, users, isOfficer, isSupervisor, addNotification }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const regionOptions = useMemo(() => getRegionOptions(users), [users]);
  const employeeRegionMap = useMemo(() => getEmployeeRegionMap(users), [users]);
  const userByEmpId = useMemo(() => {
    const map = {};
    (users || []).forEach(u => { if (u && u.employeeId) map[u.employeeId] = u; });
    return map;
  }, [users]);

  const resolveRegion = (r) => {
    if (r && r.employeeId && employeeRegionMap[r.employeeId]) return employeeRegionMap[r.employeeId];
    return r?.region || '';
  };

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
        return resolveRegion(r) === selectedRegion;
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
          <h2 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0' }}>📋 Reports</h2>
          <p style={{ fontSize: '14px', opacity: 0.85, margin: 0, maxWidth: '540px' }}>
            {filteredReports.length} reports found
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
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
          {pendingCount > 0 && (
            <span style={{
              background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(252,211,77,0.4)',
              padding: '6px 14px',
              borderRadius: '24px',
              fontSize: '13px',
              fontWeight: '600'
            }}>
              📡 {pendingCount} Pending Sync
            </span>
          )}
          {pendingCount > 0 && isOnline && (
            <button
              onClick={() => window.dispatchEvent(new Event('force-sync'))}
              style={{
                background: '#0b7e4b',
                color: 'white',
                border: 'none',
                padding: '7px 14px',
                borderRadius: '24px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              🔄 Sync Now
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
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
            {regionOptions.filter(r => r !== 'All').map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Submitted</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Officer</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Region</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Location</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Citizens</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Sync</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">New</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-400">
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
                      <td className="py-3 px-3 text-sm font-medium">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <UserAvatar user={userByEmpId[r.employeeId]} name={r.employeeName} size={26} />
                          {r.employeeName}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-sm">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs">{resolveRegion(r)}</span>
                      </td>
                      <td className="py-3 px-3 text-sm">
                        {r.latitude != null && r.longitude != null ? (
                          <a
                            href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#0b7e4b',
                              textDecoration: 'none',
                              fontWeight: '500',
                              fontSize: '12px'
                            }}
                            title={`${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}${r.gpsAccuracy ? ` (±${r.gpsAccuracy}m)` : ''}`}
                          >
                            📍 Open Map
                          </a>
                        ) : (
                          <span style={{ color: '#9ca3af' }}>—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-sm">{r.registrations}</td>
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