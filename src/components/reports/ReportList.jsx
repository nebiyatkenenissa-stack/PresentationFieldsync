import React, { useState } from 'react';

function ReportList({ reports, user, isOfficer, isSupervisor }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('All');

  const filteredReports = reports.filter(r => {
    if (isOfficer && user) {
      return r.employeeId === user.employeeId;
    }
    if (isSupervisor && user) {
      // For supervisor, show team reports
      return true;
    }
    return true;
  }).filter(r => {
    if (searchTerm) {
      return r.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
             r.employeeName?.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  }).filter(r => {
    if (selectedRegion !== 'All') {
      return r.region === selectedRegion;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">📋 Reports</h2>
            <p className="text-gray-500 text-sm mt-1">{filteredReports.length} reports found</p>
          </div>
          <div className="flex gap-2 flex-wrap">
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
            {isOfficer && (
              <button 
                onClick={() => window.location.hash = 'report_new'}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                📋 New Report
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Officer</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Site</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Region</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Citizens</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Attendance</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-500">Sync</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-gray-400">No reports found</td>
                </tr>
              ) : (
                filteredReports.map(r => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3 text-sm">{r.reportDate}</td>
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ReportList;