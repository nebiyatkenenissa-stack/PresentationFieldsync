// App.jsx – FULL COMPLETE VERSION with Profile (password change + file-upload photo path)
// + FORCE PASSWORD CHANGE ON FIRST LOGIN
// + HIERARCHICAL LOCATION (Country → Region → Zone → Woreda → Kebele → Community)
// + SERVER LOGIN (hybrid online/offline)
// + FIXED: deleteUser, toggleUserStatus, profile update with password change, offline queue for user_delete & user_status_update
// + FIXED: removed automatic session restore (always show login)
// + FIXED: network status effect dependency loop (no more "Aw, Snap!")
// + FIXED: added ErrorBoundary for each tab to isolate crashes

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  db, 
  initializeAllData, 
  syncPendingData, 
  syncQueue, 
  processSyncQueue, 
  isDevToolsOffline,
  checkRealInternet,
  getApiBase,
  clearStuckSyncItems,
  isOnline,
  getNetworkStatus,
  pullScreenTimeFromServer,
  pullAuditLogsFromServer,
  pullAlertsFromServer,
  pullVerificationFromServer,
  pullSupervisorReportsFromServer,
  pullReportsFromServer,
  pullCitizensFromServer,
  cleanupLegacyReports
} from './services/database';
import { useScreenTime } from './hooks/useScreenTime';
import { getToday, formatTime, exportCSV, exportJSON, fakeSyncApi, convertTo12Hour, getServerBase } from './utils/helpers';
import { uid, generateNationalId } from './utils/helpers';
const API_BASE = getServerBase() + '/api';
import './App.css';

// Import components
import Login from './components/auth/Login';
import Home from './components/home/Home';
import Dashboard from './components/dashboard/Dashboard';
import Sidebar from './components/common/Sidebar';
import Header from './components/common/Header';
import LoadingScreen from './components/common/LoadingScreen';
import OfflineIndicator from './components/common/OfflineIndicator';
import SyncStatus from './components/common/SyncStatus';
import CitizenRegistration from './components/register/CitizenRegistration';
import ReportForm from './components/reports/ReportForm';
import ReportList from './components/reports/ReportList';
import TaskManagement from './components/tasks/TaskManagement';
import LeaveManagement from './components/leaves/LeaveManagement';
import PermissionManagement from './components/permissions/PermissionManagement';
import ScreenTimeManagement from './components/screentime/ScreenTimeManagement';
import SupervisorReports from './components/supervisor/SupervisorReports';
import UserManagement from './components/users/UserManagement';
import Analytics from './components/analytics/Analytics';
import CitizensDatabase from './components/citizens/CitizensDatabase';
import AuditLog from './components/audit/AuditLog';
import AllReports from './components/reports/AllReports';
import AlertManagement from './components/alerts/AlertManagement';
import TeamManagement from './components/team/TeamManagement';
import ProfilePage from './components/profile/ProfilePage';
import NetworkStatus from './components/common/NetworkStatus';

// ===== LANGUAGE IMPORTS =====
import { UserLanguageProvider } from './components/context/UserLanguageContext';

// ===== VERIFICATION IMPORTS =====
import VerificationPopup from './components/verification/VerificationPopup';
import VerificationPage from './components/verification/VerificationPage';
import NextVerificationCountdown from './components/verification/NextVerificationCountdown';
import { useVerification } from './hooks/useVerification';

// ===== ERROR BOUNDARY =====
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('❌ Tab component crashed:', error, errorInfo);
  }
  reset = () => {
    this.setState({ hasError: false, error: null });
  };
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#dc2626', background: '#fef2f2', borderRadius: '8px' }}>
          <h3>⚠️ Something went wrong in this section</h3>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
            <summary>Error details</summary>
            {this.state.error && this.state.error.toString()}
          </details>
          <p style={{ marginTop: '10px' }}>Please check the console for more information.</p>
          <button
            onClick={this.reset}
            style={{
              marginTop: '12px',
              padding: '8px 18px',
              background: '#0b7e4b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ===== EMPLOYEE ID HELPER =====
// Employee IDs are system-assigned by role prefix (MGR/SUP/FO + 3 digits).
// This assigns a unique ID to any user that is missing one (e.g. manager
// records created before auto-assignment existed) and never leaves it empty.
const ROLE_ID_PREFIX = { manager: 'MGR', supervisor: 'SUP', field_officer: 'FO' };

const ensureEmployeeIds = (userList) => {
  const used = new Set();
  (userList || []).forEach(u => {
    const id = String(u?.employeeId || '').trim().toUpperCase();
    if (id) used.add(id);
  });
  let changed = false;
  const users = (userList || []).map(u => {
    if (u && !String(u.employeeId || '').trim()) {
      const prefix = ROLE_ID_PREFIX[u.role] || 'FO';
      let n = 1;
      let id = `${prefix}${String(n).padStart(3, '0')}`;
      while (used.has(id)) {
        n += 1;
        id = `${prefix}${String(n).padStart(3, '0')}`;
      }
      used.add(id);
      changed = true;
      return { ...u, employeeId: id };
    }
    return u;
  });
  return { users, changed };
};

// ===== OFFLINE QUEUE PROCESSOR (extended for user updates, deletes, status) =====
const processOfflineQueue = async (queueItems) => {
  const results = { synced: 0, failed: 0 };
  
  for (const item of queueItems) {
    try {
      switch (item.type) {
        case 'report':
          const reportResult = await fakeSyncApi(item.data);
          await db.reports.update(item.id, { ...reportResult, synced: true });
          results.synced++;
          break;
        case 'citizen':
          await db.citizens.update(item.id, { synced: true });
          results.synced++;
          break;
        case 'attendance':
          await db.attendance.update(item.id, { synced: true });
          results.synced++;
          break;
        case 'task':
          await db.tasks.update(item.id, { synced: true });
          results.synced++;
          break;
        case 'task_update':
          const task = await db.tasks.get(item.data.taskId);
          if (task) {
            await db.tasks.update(item.data.taskId, { status: item.data.status, synced: true });
          }
          results.synced++;
          break;
        case 'leave':
          await db.leaves.update(item.id, { synced: true });
          results.synced++;
          break;
        case 'leave_update':
          await db.leaves.update(item.data.leaveId, { status: item.data.status, synced: true });
          results.synced++;
          break;
        case 'permission':
          await db.permissions.update(item.id, { synced: true });
          results.synced++;
          break;
        case 'permission_update':
          await db.permissions.update(item.data.permissionId, { status: item.data.status, synced: true });
          results.synced++;
          break;
        case 'supervisor_report':
          await db.supervisor_reports.update(item.id, { synced: true });
          results.synced++;
          break;
        case 'user_update':
          const userData = item.data;
          const response = await fetch(`${getApiBase()}/users/${userData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
          });
          if (response.ok) {
            await db.users.update(userData.id, { synced: true });
            results.synced++;
          } else {
            throw new Error('Server rejected user update');
          }
          break;
        case 'user_delete':
          const delRes = await fetch(`${getApiBase()}/users/${item.data.userId}`, {
            method: 'DELETE'
          });
          if (delRes.ok) {
            await db.users.delete(item.data.userId);
            results.synced++;
          } else {
            throw new Error('Server rejected delete');
          }
          break;
        case 'user_status_update':
          const statusRes = await fetch(`${getApiBase()}/users/${item.data.userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: item.data.status })
          });
          if (statusRes.ok) {
            await db.users.update(item.data.userId, { status: item.data.status, synced: true });
            results.synced++;
          } else {
            throw new Error('Server rejected status update');
          }
          break;
        default:
          results.failed++;
      }
    } catch (error) {
      console.error(`❌ Failed to sync ${item.type}:`, error);
      results.failed++;
      if (!item.retries) item.retries = 0;
      item.retries++;
      if (item.retries < 5) {
        syncQueue.add(item);
      }
    }
  }
  
  return results;
};

// ===== HELPER: fetch with a timeout (avoids hanging indefinitely) =====
const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

// ===== APP CONTENT COMPONENT =====
function AppContent() {
  // ===== STATE =====
  const [user, setUser] = useState(null);
  const [authView, setAuthView] = useState('home');
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [citizens, setCitizens] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [supervisorReports, setSupervisorReports] = useState([]);
  const [screenTime, setScreenTime] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [liveStatus, setLiveStatus] = useState([]);
  const [appNotifications, setAppNotifications] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState([]);
  const [showSyncLog, setShowSyncLog] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedOfficer, setSelectedOfficer] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [loginError, setLoginError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [trustFilter, setTrustFilter] = useState('all');
  const [taskFilter, setTaskFilter] = useState('all');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showSupervisorReportModal, setShowSupervisorReportModal] = useState(false);
  const [showSupervisorSelfReportModal, setShowSupervisorSelfReportModal] = useState(false);
  const [showPermissionRequestModal, setShowPermissionRequestModal] = useState(false);

  // ===== FORCE PASSWORD CHANGE STATE =====
  const [showForceChangePassword, setShowForceChangePassword] = useState(false);
  const [forcePasswordForm, setForcePasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [forcePasswordError, setForcePasswordError] = useState('');

  // ===== LOCATION STATE =====
  const [selectedLocations, setSelectedLocations] = useState({
    country: null,
    region: null,
    zone: null,
    woreda: null,
    kebele: null,
    community: null
  });
  const [woredaSupervisors, setWoredaSupervisors] = useState([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);

  // ===== VERIFICATION SYSTEM =====
  const isOfficer = user?.role === 'field_officer';
  const { 
    showPopup, 
    verificationScore, 
    verificationHistory,
    nextVerificationAt,
    handleAnswer, 
    handleClose,
    lastVerified
  } = useVerification(isOfficer ? user?.id : null, isOfficer ? user?.name : null);

  // ===== FORM STATES =====
  const [newTask, setNewTask] = useState({
    employeeId: '',
    title: '',
    description: '',
    deadline: '',
    priority: 'medium'
  });

  const [newLeave, setNewLeave] = useState({
    employeeId: '',
    startDate: '',
    endDate: '',
    reason: '',
    type: 'annual'
  });

  const [newAlert, setNewAlert] = useState({
    title: '',
    message: '',
    priority: 'medium',
    targetAll: true,
    targetEmployeeId: ''
  });

  const [supervisorReportForm, setSupervisorReportForm] = useState({
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
    overallRating: 3,
    status: 'pending'
  });

  const [supervisorSelfReportForm, setSupervisorSelfReportForm] = useState({
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

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: '',
    region: '',
    supervisorId: '',
    assignedSites: '',
    shift: 'Day',
    department: ''
  });

  const generateSimplePassword = () => {
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    let pwd = '';
    for (let i = 0; i < 4; i++) pwd += letters.charAt(Math.floor(Math.random() * letters.length));
    return pwd + String(Math.floor(Math.random() * 900) + 100);
  };

  const [citizenForm, setCitizenForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    email: '',
    address: '',
    region: '',
    district: '',
    village: '',
    occupation: '',
    maritalStatus: '',
    registrationDate: getToday(),
    idType: 'National ID',
    idNumber: '',
    biometrics: false
  });

  const [form, setForm] = useState({
    reportDate: getToday(),
    region: '',
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

  const [newPermission, setNewPermission] = useState({
    employeeId: '',
    permissionType: '',
    startDate: '',
    endDate: '',
    reason: '',
    status: 'pending'
  });

  const [permissionRequest, setPermissionRequest] = useState({
    permissionType: '',
    startDate: '',
    endDate: '',
    reason: ''
  });

  const { screenTimeDisplay, isScreenTimeRunning, isIdle, startScreenTime, stopScreenTime } = useScreenTime(user);

  // ===== ROLE CHECKS =====
  const isManager = user?.role === 'manager';
  const isSupervisor = user?.role === 'supervisor';

  // ============================================================
  // HELPER: Build location path
  // ============================================================
  const buildLocationPath = (locations) => {
    const levels = ['country', 'region', 'zone', 'woreda', 'kebele', 'community'];
    const names = levels
      .map((level) => locations[level]?.name)
      .filter(Boolean);
    return names.join(' > ') || 'Unknown';
  };

  // ============================================================
  // Session auto-restore DISABLED – always show home page first
  // ============================================================
  useEffect(() => {
    setIsLoading(false);
  }, []);

  // ============================================================
  // AUDIT LOG FUNCTIONS (with push & queue)
  // ============================================================
  const addAuditLog = async (action, details) => {
    const log = {
      id: uid(),
      userId: user?.employeeId || 'system',
      userName: user?.name || 'System',
      action,
      details: typeof details === 'object' ? JSON.stringify(details) : details,
      timestamp: new Date().toISOString(),
      ip: '127.0.0.1',
      synced: false
    };

    await db.audit.add(log);
    setAuditLog(prev => [log, ...prev]);

    const online = await checkRealInternet();
    if (online) {
      try {
        await fetch(`${API_BASE}/audit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log)
        });
        await db.audit.update(log.id, { synced: true });
        setAuditLog(prev => prev.map(l => l.id === log.id ? { ...l, synced: true } : l));
        console.log('✅ Audit log synced to server');
      } catch (error) {
        console.error('Failed to sync audit log:', error);
        syncQueue.add({ type: 'audit', id: log.id, data: log });
      }
    } else {
      syncQueue.add({ type: 'audit', id: log.id, data: log });
    }
  };

  // ============================================================
  // NOTIFICATION FUNCTIONS
  // ============================================================
  const addNotification = async (userId, title, message, type = 'info', link = '') => {
    if (!userId) return;
    const newNotification = {
      id: uid(),
      userId: userId,
      title,
      message,
      type,
      read: false,
      timestamp: new Date().toISOString(),
      link: link || '/dashboard'
    };
    setAppNotifications(prev => {
      const updated = [newNotification, ...prev];
      db.notifications.bulkPut(updated);
      return updated;
    });
  };

  const markNotificationRead = async (notificationId) => {
    setAppNotifications(prev => {
      const updated = prev.map(n => n.id === notificationId ? { ...n, read: true } : n);
      db.notifications.bulkPut(updated);
      return updated;
    });
  };

  const markAllNotificationsRead = async () => {
    setAppNotifications(prev => {
      const updated = prev.map(n => n.userId === user?.id ? { ...n, read: true } : n);
      db.notifications.bulkPut(updated);
      return updated;
    });
  };

  const getUserNotifications = useMemo(() => {
    if (!user) return [];
    return appNotifications.filter(n => n.userId === user.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [appNotifications, user]);

  const unreadNotifications = useMemo(() => {
    return getUserNotifications.filter(n => !n.read);
  }, [getUserNotifications]);

  // ============================================================
  // DATA LOADING
  // ============================================================
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setIsLoading(true);
        await initializeAllData();
        await cleanupLegacyReports();
        window.db = db;

        const [
          usersData, reportsData, citizensData, auditData,
          supervisorReportsData, screenTimeData, tasksData, leavesData,
          alertsData, liveStatusData, notificationsData, permissionsData
        ] = await Promise.all([
          db.users.toArray(),
          db.reports.toArray(),
          db.citizens.toArray(),
          db.audit.toArray(),
          db.supervisor_reports.toArray(),
          db.screen_time.toArray(),
          db.tasks.toArray(),
          db.leaves.toArray(),
          db.alerts.toArray(),
          db.status.toArray(),
          db.notifications.toArray(),
          db.permissions.toArray()
        ]);

        // ===== FETCH USERS FROM API AND MERGE =====
        let finalUsers = usersData;
        try {
          const response = await fetchWithTimeout(`${getApiBase()}/users`, {}, 8000);
          if (response.ok) {
            const serverUsers = await response.json();
            if (serverUsers && serverUsers.length > 0) {
              const mergedUsers = [...usersData];
              for (const serverUser of serverUsers) {
                const existingIndex = mergedUsers.findIndex(
                  u => u.id === serverUser.id || u.employeeId === serverUser.employee_id
                );
                if (existingIndex >= 0) {
                  mergedUsers[existingIndex] = {
                    ...mergedUsers[existingIndex],
                    name: serverUser.name,
                    email: serverUser.email,
                    role: serverUser.role,
                    region: serverUser.region,
                    supervisorId: serverUser.supervisor_id,
                    status: serverUser.status,
                    password: mergedUsers[existingIndex].password,
                    profilePhoto: serverUser.profile_photo || mergedUsers[existingIndex].profilePhoto || null,
                    shift: serverUser.shift || mergedUsers[existingIndex].shift || 'Day',
                    department: serverUser.department || mergedUsers[existingIndex].department || '',
                    phone: serverUser.phone || mergedUsers[existingIndex].phone || '',
                    must_change_password: serverUser.must_change_password !== undefined ? serverUser.must_change_password : false,
                    country_id: serverUser.country_id || mergedUsers[existingIndex].country_id || null,
                    region_id: serverUser.region_id || mergedUsers[existingIndex].region_id || null,
                    zone_id: serverUser.zone_id || mergedUsers[existingIndex].zone_id || null,
                    woreda_id: serverUser.woreda_id || mergedUsers[existingIndex].woreda_id || null,
                    kebele_id: serverUser.kebele_id || mergedUsers[existingIndex].kebele_id || null,
                    community_id: serverUser.community_id || mergedUsers[existingIndex].community_id || null,
                  };
                } else {
                  const defaultPassword = 
                    serverUser.role === 'manager' ? 'manager123' :
                    serverUser.role === 'supervisor' ? 'super123' : 'officer123';
                  mergedUsers.push({
                    id: serverUser.id,
                    employeeId: serverUser.employee_id,
                    name: serverUser.name,
                    email: serverUser.email,
                    password: serverUser.password_hash || defaultPassword,
                    role: serverUser.role,
                    region: serverUser.region,
                    supervisorId: serverUser.supervisor_id,
                    status: serverUser.status,
                    phone: serverUser.phone || '',
                    shift: serverUser.shift || 'Day',
                    department: serverUser.department || '',
                    assignedSites: [],
                    managerId: 'm1',
                    gpsEnabled: true,
                    pin: serverUser.role === 'field_officer' ? '1234' : null,
                    profilePhoto: serverUser.profile_photo || null,
                    must_change_password: serverUser.must_change_password || false,
                    country_id: serverUser.country_id || null,
                    region_id: serverUser.region_id || null,
                    zone_id: serverUser.zone_id || null,
                    woreda_id: serverUser.woreda_id || null,
                    kebele_id: serverUser.kebele_id || null,
                    community_id: serverUser.community_id || null,
                  });
                }
              }
              finalUsers = mergedUsers;
              await db.users.clear();
              await db.users.bulkAdd(finalUsers);
              console.log(`✅ Synced ${finalUsers.length} users from API (passwords preserved)`);
            }
          }
        } catch (err) {
          console.log('📡 Could not fetch users from server, using local data');
        }
        // ===== END API USER SYNC =====

        // ===== ENSURE EVERY USER HAS A SYSTEM-ASSIGNED EMPLOYEE ID =====
        const ensuredUsers = ensureEmployeeIds(finalUsers);
        if (ensuredUsers.changed) {
          finalUsers = ensuredUsers.users;
          await db.users.bulkPut(finalUsers);
          console.log(`🏷️ Assigned missing Employee IDs to ${finalUsers.length} users`);
        }

        setUsers(finalUsers);
        setReports(reportsData);
        setCitizens(citizensData);
        setAuditLog(auditData);
        setSupervisorReports(supervisorReportsData);
        setScreenTime(screenTimeData);
        setTasks(tasksData);
        setLeaves(leavesData);
        setAlerts(alertsData);
        setLiveStatus(liveStatusData);
        setAppNotifications(notificationsData);
        setPermissions(permissionsData);

        await clearStuckSyncItems();

        const queueItems = syncQueue.getAll();
        if (queueItems.length > 0) {
          console.log(`📋 Found ${queueItems.length} pending items in queue`);
          setTimeout(() => runSync(), 2000);
        }
        
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
  }, []);

  // ============================================================
  // HEARTBEAT - send online status to server every 30s
  // ============================================================
  useEffect(() => {
    if (!user || !user.employeeId) return;
    const sendHeartbeat = async () => {
      try {
        const base = getApiBase();
        await fetchWithTimeout(`${base}/status/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: user.employeeId })
        }, 5000);
      } catch (e) { /* silent */ }
    };
    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // ============================================================
  // FETCH REAL ONLINE STATUS from server every 15s
  // ============================================================
  useEffect(() => {
    if (!user) return;
    const fetchOnlineStatus = async () => {
      try {
        const base = getApiBase();
        const res = await fetchWithTimeout(`${base}/status/online`, {}, 5000);
        if (res.ok) {
          const serverStatuses = await res.json();
          const mapped = serverStatuses.map((s: any) => ({
            employeeId: s.employeeId,
            userId: s.employeeId,
            employeeName: s.name,
            status: s.status,
            lastActive: s.lastActive
          }));
          setLiveStatus(mapped);
        }
      } catch (e) { /* silent */ }
    };
    fetchOnlineStatus();
    const interval = setInterval(fetchOnlineStatus, 15000);
    return () => clearInterval(interval);
  }, [user]);

  // ============================================================
  // LOCATION HANDLERS
  // ============================================================
  const handleLocationSelect = (level, id, name) => {
    const value = id ? { id, name } : null;
    setSelectedLocations(prev => {
      const newLoc = { ...prev, [level]: value };
      const levels = ['country', 'region', 'zone', 'woreda', 'kebele', 'community'];
      const idx = levels.indexOf(level);
      for (let i = idx + 1; i < levels.length; i++) {
        newLoc[levels[i]] = null;
      }
      return newLoc;
    });
  };

  const locationId = (loc) => (loc && loc.id !== 'OTHER' ? loc.id : null);

  // Mark offline when browser/tab closes
  useEffect(() => {
    if (!user?.employeeId) return;
    const handleBeforeUnload = () => {
      try {
        const base = getApiBase();
        navigator.sendBeacon(`${base}/status/offline`, new Blob([JSON.stringify({ employeeId: user.employeeId })], { type: 'application/json' }));
      } catch (e) { /* silent */ }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user]);

  // Fetch supervisors when woreda changes
  useEffect(() => {
    if (!selectedLocations.woreda) {
      setWoredaSupervisors([]);
      return;
    }
    const fetchSupervisors = async () => {
      setLoadingSupervisors(true);
      try {
        const res = await fetch(`${getApiBase()}/users/supervisors-by-woreda/${selectedLocations.woreda.id}`);
        const data = await res.json();
        setWoredaSupervisors(data);
      } catch (error) {
        console.error('Error fetching supervisors:', error);
        setWoredaSupervisors([]);
      } finally {
        setLoadingSupervisors(false);
      }
    };
    fetchSupervisors();
  }, [selectedLocations.woreda]);

  // ============================================================
  // PULL SCREEN TIME FOR MANAGERS/SUPERVISORS
  // ============================================================
  useEffect(() => {
    if (!user) return;
    const isManagerOrSupervisor = user.role === 'manager' || user.role === 'supervisor';
    if (!isManagerOrSupervisor) return;

    const pullData = async () => {
      await pullScreenTimeFromServer();
      const updated = await db.screen_time.toArray();
      setScreenTime(updated);
    };

    if (isOnline) {
      pullData();
    }

    const handleOnline = () => {
      if (navigator.onLine) pullData();
    };
    window.addEventListener('online', handleOnline);

    const handleForceSync = () => {
      if (navigator.onLine) pullData();
    };
    window.addEventListener('force-sync', handleForceSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('force-sync', handleForceSync);
    };
  }, [user, isOnline]);

  // ============================================================
  // PULL AUDIT LOGS FOR MANAGER
  // ============================================================
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'manager') return;

    const pullAudit = async () => {
      await pullAuditLogsFromServer();
      const updated = await db.audit.toArray();
      setAuditLog(updated);
    };

    if (isOnline) pullAudit();

    const handleOnline = () => {
      if (navigator.onLine) pullAudit();
    };
    window.addEventListener('online', handleOnline);

    const handleForceSync = () => {
      if (navigator.onLine) pullAudit();
    };
    window.addEventListener('force-sync', handleForceSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('force-sync', handleForceSync);
    };
  }, [user, isOnline]);

  // ============================================================
  // PULL ALERTS / MESSAGES FOR ALL ROLES
  // Messages sent while the recipient was offline are synced to the
  // server by the sender and must appear in the recipient's inbox as
  // soon as internet is back. We pull on load, on the 'online' /
  // 'force-sync' / 'sync-complete' events and on a short poll so a
  // message shows up at the same time its sync reaches the server.
  // ============================================================
  useEffect(() => {
    if (!user) return;

    const pullAlerts = async () => {
      if (!navigator.onLine) return;
      try {
        await pullAlertsFromServer();
        const updated = await db.alerts.toArray();
        setAlerts(prev => {
          if (prev.length !== updated.length) return updated;
          const sig = a => `${a.id}|${a.read}|${a.synced}|${a.pending === true}`;
          const a = prev.map(sig).sort().join(',');
          const b = updated.map(sig).sort().join(',');
          return a === b ? prev : updated;
        });
      } catch (err) {
        console.warn('⚠️ Alert pull failed:', err.message);
      }
    };

    if (isOnline) pullAlerts();

    const handleOnline = () => { if (navigator.onLine) pullAlerts(); };
    window.addEventListener('online', handleOnline);

    const handleForceSync = () => { if (navigator.onLine) pullAlerts(); };
    window.addEventListener('force-sync', handleForceSync);

    const handleSyncComplete = () => pullAlerts();
    window.addEventListener('sync-complete', handleSyncComplete);

    const interval = setInterval(() => {
      if (navigator.onLine) pullAlerts();
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('force-sync', handleForceSync);
      window.removeEventListener('sync-complete', handleSyncComplete);
      clearInterval(interval);
    };
  }, [user, isOnline]);

  // ============================================================
  // PULL VERIFICATION FOR MANAGER
  // ============================================================
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'manager') return;

    const pullVerification = async () => {
      await pullVerificationFromServer();
      window.dispatchEvent(new Event('verification-update'));
    };

    if (isOnline) pullVerification();

    const handleOnline = () => {
      if (navigator.onLine) pullVerification();
    };
    window.addEventListener('online', handleOnline);

    const handleForceSync = () => {
      if (navigator.onLine) pullVerification();
    };
    window.addEventListener('force-sync', handleForceSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('force-sync', handleForceSync);
    };
  }, [user, isOnline]);

  // ============================================================
  // PULL SUPERVISOR + REGULAR REPORTS FOR MANAGER/SUPERVISOR
  // ============================================================
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'manager' && user.role !== 'supervisor') return;

    const pullReports = async () => {
      await pullSupervisorReportsFromServer();
      await pullReportsFromServer();
      await pullCitizensFromServer();
      await cleanupLegacyReports();
      const [updatedSupervisor, updatedReports, updatedCitizens] = await Promise.all([
        db.supervisor_reports.toArray(),
        db.reports.toArray(),
        db.citizens.toArray()
      ]);
      setSupervisorReports(updatedSupervisor);
      setReports(updatedReports);
      setCitizens(updatedCitizens);
    };

    if (isOnline) pullReports();

    const handleOnline = () => {
      if (navigator.onLine) pullReports();
    };
    window.addEventListener('online', handleOnline);

    const handleForceSync = () => {
      if (navigator.onLine) pullReports();
    };
    window.addEventListener('force-sync', handleForceSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('force-sync', handleForceSync);
    };
  }, [user, isOnline]);

  // ============================================================
  // LIVE REPORT REFRESH – react to report-update events so a
  // newly submitted/synced report appears immediately in lists
  // ============================================================
  useEffect(() => {
    const handleReportUpdate = async () => {
      const updated = await db.reports.toArray();
      setReports(updated);
    };
    window.addEventListener('report-update', handleReportUpdate);
    return () => window.removeEventListener('report-update', handleReportUpdate);
  }, []);

  // ============================================================
  // REPORT-SYNCED MESSAGES – when an offline report finally reaches
  // the server (internet back), notify its supervisor/manager so the
  // message appears at the same time the report becomes visible.
  // ============================================================
  useEffect(() => {
    const handleReportSynced = async (e) => {
      const report = e?.detail?.report;
      if (!report || !addNotification) return;
      try {
        if (report.supervisorId) {
          const supervisor = users?.find(u => u.id === report.supervisorId);
          if (supervisor) {
            await addNotification(
              supervisor.id,
              '📋 Report Submitted',
              `${report.employeeName || 'An officer'} submitted a report`,
              'success'
            );
          }
        }
        const manager = users?.find(u => u.role === 'manager');
        if (manager) {
          await addNotification(
            manager.id,
            '📋 Report Submitted',
            `${report.employeeName || 'An officer'} submitted a report`,
            'info'
          );
        }
      } catch (err) {
        console.warn('Failed to create report-synced notifications:', err);
      }
    };
    window.addEventListener('report-synced', handleReportSynced);
    return () => window.removeEventListener('report-synced', handleReportSynced);
  }, [users, addNotification]);

  // ============================================================
  // AUTO-SYNC
  // ============================================================
  const runSync = useCallback(async () => {
    if (isDevToolsOffline()) {
      console.log('🔌 App: DevTools says OFFLINE - No sync');
      return;
    }
    
    const online = await checkRealInternet();
    if (!online) {
      console.log('📡 App: Sync skipped - Device is offline');
      return;
    }
    
    if (syncing) {
      console.log('⏳ App: Sync already in progress');
      return;
    }
    
    setSyncing(true);
    try {
      const result = await processSyncQueue(true);
      console.log('🔄 Sync result:', result);
      
      const [
        updatedReports, updatedCitizens,
        updatedTasks, updatedLeaves, updatedPermissions, 
        updatedSupervisorReports
      ] = await Promise.all([
        db.reports.toArray(),
        db.citizens.toArray(),
        db.tasks.toArray(),
        db.leaves.toArray(),
        db.permissions.toArray(),
        db.supervisor_reports.toArray()
      ]);
      
      setReports(updatedReports);
      setCitizens(updatedCitizens);
      setTasks(updatedTasks);
      setLeaves(updatedLeaves);
      setPermissions(updatedPermissions);
      setSupervisorReports(updatedSupervisorReports);
      
    } catch (error) {
      console.error('❌ Sync error:', error);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  // ============================================================
  // NETWORK STATUS MONITORING – FIXED DEPENDENCIES
  // ============================================================
  useEffect(() => {
    const checkNetwork = async () => {
      if (isDevToolsOffline()) {
        if (isOnline !== false) {
          console.log('🔌 App: DevTools says OFFLINE');
          setIsOnline(false);
        }
        return;
      }
      
      const online = await checkRealInternet();
      if (online !== isOnline) {
        setIsOnline(online);
        if (online) {
          console.log('🔄 App: Back online! Checking for pending items...');
          // Only start sync if not already syncing
          if (!syncing) {
            setTimeout(() => runSync(), 1000);
          }
        }
      }
    };
    
    checkNetwork();
    const interval = setInterval(checkNetwork, 2000);
    
    const handleForceSync = () => {
      if (isDevToolsOffline()) {
        alert('🔌 DevTools says you are offline! Please disable offline mode in DevTools.');
        return;
      }
      
      if (navigator.onLine) {
        runSync();
      } else {
        alert('📡 You are offline. Please connect to the internet.');
      }
    };
    window.addEventListener('force-sync', handleForceSync);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('force-sync', handleForceSync);
    };
    // Only re-run when isOnline or syncing changes – NOT runSync!
  }, [isOnline, syncing]); // <-- FIXED: removed 'reports' and 'runSync'

  // ============================================================
  // COMPUTED VALUES
  // ============================================================
  const teamMembers = useMemo(() => {
    if (isSupervisor && user) {
      return users.filter(u => u.supervisorId === user.id);
    }
    return [];
  }, [users, user, isSupervisor]);

  const filteredReports = useMemo(() => {
    if (isOfficer && user) {
      return reports.filter(r => r.employeeId === user.employeeId);
    }
    if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      // Only show reports that actually reached the server – offline (pending)
      // reports appear only once they are synced when internet is back.
      return reports.filter(r => r.synced === true && (teamIds.includes(r.employeeId) || r.employeeId === user.employeeId));
    }
    return reports.filter(r => r.synced === true);
  }, [reports, isOfficer, isSupervisor, user, teamMembers]);

  const filteredScreenTime = useMemo(() => {
    if (isOfficer && user) {
      return screenTime.filter(s => s.employeeId === user.employeeId);
    }
    if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      return screenTime.filter(s => teamIds.includes(s.employeeId));
    }
    return screenTime;
  }, [screenTime, isOfficer, isSupervisor, user, teamMembers]);

  const filteredTasks = useMemo(() => {
    if (isOfficer && user) {
      return tasks.filter(t => t.employeeId === user.employeeId);
    }
    if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      return tasks.filter(t => teamIds.includes(t.employeeId));
    }
    return tasks;
  }, [tasks, isOfficer, isSupervisor, user, teamMembers]);

  const filteredLeaves = useMemo(() => {
    if (isOfficer && user) {
      return leaves.filter(l => l.employeeId === user.employeeId);
    }
    if (isSupervisor && user) {
      return leaves.filter(l => l.employeeId === user.employeeId);
    }
    return leaves;
  }, [leaves, isOfficer, isSupervisor, user]);

  const filteredPermissions = useMemo(() => {
    if (isOfficer && user) {
      return permissions.filter(p => p.employeeId === user.employeeId);
    }
    if (isSupervisor && user) {
      return permissions.filter(p => p.employeeId === user.employeeId);
    }
    return permissions;
  }, [permissions, isOfficer, isSupervisor, user]);

  const filteredAlerts = useMemo(() => {
    if (isOfficer && user) {
      return alerts.filter(a => a.targetAll || a.targetEmployeeId === user.employeeId);
    }
    if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      return alerts.filter(a => a.targetAll || a.targetEmployeeId === user.employeeId || teamIds.includes(a.targetEmployeeId));
    }
    return alerts;
  }, [alerts, isOfficer, isSupervisor, user, teamMembers]);

  const employeePerformance = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      if (!map[r.employeeId]) {
        map[r.employeeId] = {
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          region: r.region,
          totalReports: 0,
          totalRegistrations: citizens.filter(c => c.registeredBy === r.employeeId).length,
          avgEfficiency: 0,
          trustScore: 0,
          productivityScore: 0,
          tasksCompleted: 0,
          tasksInProgress: 0
        };
      }
      map[r.employeeId].totalReports += 1;
    });

    screenTime.forEach(s => {
      if (map[s.employeeId]) {
        map[s.employeeId].trustScore = (s.trustScore && !isNaN(s.trustScore)) ? s.trustScore : 0;
      }
    });

    liveStatus.forEach(l => {
      if (map[l.employeeId]) {
        map[l.employeeId].productivityScore = l.productivityScore || 0;
        map[l.employeeId].tasksCompleted = l.tasksCompleted || 0;
        map[l.employeeId].tasksInProgress = l.tasksInProgress || 0;
      }
    });

    Object.values(map).forEach(emp => {
      emp.avgEfficiency = emp.totalReports > 0 ? Math.round((emp.totalRegistrations / (emp.totalReports * 100)) * 100) : 0;
    });

    return Object.values(map);
  }, [reports, screenTime, liveStatus, citizens]);

  const totalReports = reports.length + supervisorReports.length;
  const totalRegistrations = citizens.length;
  const totalCitizens = citizens.length;
  const pendingSync = reports.filter(r => !r.synced).length + syncQueue.count();

  const regionStats = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      if (!map[r.region]) map[r.region] = { reports: 0, registrations: 0, employees: new Set() };
      map[r.region].reports += 1;
      map[r.region].registrations += citizens.filter(c => c.region === r.region).length;
      map[r.region].employees.add(r.employeeId);
    });
    return Object.entries(map).map(([region, data]) => ({
      region,
      ...data,
      employees: data.employees.size
    }));
  }, [reports, citizens]);

  const topPerformers = useMemo(() => {
    return [...employeePerformance].sort((a, b) => b.totalRegistrations - a.totalRegistrations).slice(0, 5);
  }, [employeePerformance]);

  const teamPerformance = useMemo(() => {
    if (!isSupervisor || !user) return [];
    const teamIds = teamMembers.map(m => m.employeeId);
    return employeePerformance.filter(p => teamIds.includes(p.employeeId));
  }, [employeePerformance, teamMembers, isSupervisor, user]);

  const pendingPermissions = useMemo(() => permissions.filter(p => p.status === 'pending').length, [permissions]);
  const pendingLeaves = useMemo(() => leaves.filter(l => l.status === 'pending').length, [leaves]);

  // ============================================================
  // SUPERVISOR FILTERS
  // ============================================================
  const getSupervisorReports = () => {
    if (!isSupervisor || !user) return reports.filter(r => r.synced === true);
    const teamIds = teamMembers.map(m => m.employeeId);
    return reports.filter(r => r.synced === true && (teamIds.includes(r.employeeId) || r.employeeId === user.employeeId));
  };

  const getSupervisorLeaves = () => {
    if (!isSupervisor || !user) return leaves;
    return leaves.filter(l => l.employeeId === user.employeeId);
  };

  const getSupervisorPermissions = () => {
    if (!isSupervisor || !user) return permissions;
    return permissions.filter(p => p.employeeId === user.employeeId);
  };

  const getSupervisorScreenTime = () => {
    if (!isSupervisor || !user) return screenTime;
    const teamIds = teamMembers.map(m => m.employeeId);
    return screenTime.filter(s => teamIds.includes(s.employeeId));
  };

  const getSupervisorTasks = () => {
    if (!isSupervisor || !user) return tasks;
    const teamIds = teamMembers.map(m => m.employeeId);
    return tasks.filter(t => teamIds.includes(t.employeeId));
  };

  // ============================================================
  // AUTHENTICATION (UPDATED with server login)
  // ============================================================

  // Map PostgreSQL snake_case user row -> app camelCase user object
  const mapServerUser = (serverUser, password) => {
    return {
      id: serverUser.id,
      employeeId: serverUser.employee_id,
      name: serverUser.name,
      email: serverUser.email,
      password: password || serverUser.temporaryPassword || '',
      role: serverUser.role,
      region: serverUser.region || serverUser.location_path || 'All',
      supervisorId: serverUser.supervisor_id || null,
      status: serverUser.status || 'active',
      phone: serverUser.phone || '',
      shift: serverUser.shift || 'Day',
      department: serverUser.department || '',
      profilePhoto: serverUser.profile_photo || null,
      must_change_password: !!serverUser.must_change_password,
      country_id: serverUser.country_id || null,
      region_id: serverUser.region_id || null,
      zone_id: serverUser.zone_id || null,
      woreda_id: serverUser.woreda_id || null,
      kebele_id: serverUser.kebele_id || null,
      community_id: serverUser.community_id || null,
      locationPath: serverUser.location_path || serverUser.region || '',
      assignedSites: serverUser.role === 'field_officer' ? [] : [],
      managerId: 'm1',
      gpsEnabled: true,
      pin: serverUser.role === 'field_officer' ? '1234' : null
    };
  };

  const handleLogin = async (email, password) => {
    const online = await checkRealInternet();
    
    if (online) {
      try {
        const response = await fetchWithTimeout(`${getApiBase()}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        }, 10000);
        const data = await response.json();
        if (response.ok && data.success) {
          const serverUser = data.user;
          const localUser = mapServerUser(serverUser, password);
          if (!localUser.employeeId) {
            const existingUser = users.find(u => u.id === localUser.id && String(u.employeeId || '').trim());
            if (existingUser) {
              localUser.employeeId = existingUser.employeeId;
            } else {
              const ensured = ensureEmployeeIds([...users, localUser]);
              localUser.employeeId = ensured.users.find(u => u.id === localUser.id)?.employeeId;
            }
          }
          const existing = await db.users.get(serverUser.id);
          if (existing) {
            await db.users.update(serverUser.id, localUser);
          } else {
            await db.users.add(localUser);
          }
          setUser(localUser);
          setActiveTab('dashboard');
          await db.auth.put({ id: 'session', userId: localUser.id });
          setLoginError('');
          addNotification(localUser.id, '👋 Welcome Back!', `Welcome back ${localUser.name}!`, 'success');
          addAuditLog('LOGIN', { email: localUser.email, name: localUser.name });

          if (localUser.must_change_password) {
            setShowForceChangePassword(true);
          }
          return true;
        } else {
          setLoginError(data.error || 'Invalid email or password');
          return false;
        }
      } catch (err) {
        console.warn('Server login failed, falling back to offline:', err);
      }
    }

    const foundUser = users.find(u => u.email === email && u.password === password && u.status === 'active');
    if (foundUser) {
      setUser(foundUser);
      setActiveTab('dashboard');
      await db.auth.put({ id: 'session', userId: foundUser.id });
      setLoginError('');
      addNotification(foundUser.id, '👋 Welcome Back!', `Welcome back ${foundUser.name}!`, 'success');
      addAuditLog('LOGIN', { email: foundUser.email, name: foundUser.name });

      if (foundUser.must_change_password) {
        setShowForceChangePassword(true);
      }
      return true;
    }
    setLoginError('Invalid email or password');
    return false;
  };

  // ============================================================
  // FIXED handleForceChangePassword
  // ============================================================
  const handleForceChangePassword = async (e) => {
    e.preventDefault();
    console.log('🔑 handleForceChangePassword called');
    setForcePasswordError('');

    if (forcePasswordForm.newPassword !== forcePasswordForm.confirmPassword) {
      console.log('❌ New passwords do not match');
      setForcePasswordError('New passwords do not match.');
      return;
    }
    if (forcePasswordForm.newPassword.length < 4) {
      console.log('❌ Password too short');
      setForcePasswordError('Password must be at least 4 characters.');
      return;
    }

    let email = user?.email?.trim();
    if (!email) {
      const foundUser = users.find(u => u.id === user?.id);
      if (foundUser) email = foundUser.email?.trim();
    }
    if (!email) {
      console.log('❌ No email found for user');
      setForcePasswordError('User email not found. Please log out and try again.');
      return;
    }
    email = email.toLowerCase();
    console.log(`📧 Changing password for email: ${email}`);

    const payload = {
      email: email,
      currentPassword: forcePasswordForm.currentPassword,
      newPassword: forcePasswordForm.newPassword
    };
    console.log('📤 Sending payload:', { ...payload, currentPassword: '[REDACTED]', newPassword: '[REDACTED]' });

    if (user?.password && forcePasswordForm.currentPassword !== user.password) {
      setForcePasswordError('Current password is incorrect.');
      return;
    }
    const localPwMatches = !user?.password || forcePasswordForm.currentPassword === user.password;

    try {
      console.log('🚀 Sending fetch to change-password');
      const response = await fetch(`${getApiBase()}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('📡 Response status:', response.status);
      const data = await response.json();
      console.log('📦 Response data:', data);

      if (response.ok) {
        const updatedUser = { ...user, must_change_password: false, password: forcePasswordForm.newPassword };
        setUser(updatedUser);
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        await db.users.update(user.id, updatedUser);
        setShowForceChangePassword(false);
        setForcePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        alert('✅ Password changed successfully!');
      } else if (localPwMatches && user?.password && (data.error === 'Current password is incorrect' || data.error === 'User not found')) {
        const updatedUser = { ...user, must_change_password: false, password: forcePasswordForm.newPassword };
        setUser(updatedUser);
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        await db.users.update(user.id, updatedUser);
        try {
          await fetch(`${getApiBase()}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'user',
              data: { ...updatedUser, password: forcePasswordForm.newPassword, mustChangePassword: false }
            })
          });
        } catch (syncErr) {
          console.error('Password sync error:', syncErr);
        }
        setShowForceChangePassword(false);
        setForcePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        alert("✅ Password changed! The server couldn't verify your old password, so it was updated locally and synced.");
      } else {
        setForcePasswordError(data.error || 'Failed to change password.');
      }
    } catch (err) {
      console.error('❌ Fetch error:', err);
      setForcePasswordError('Network error. Please try again.');
    }
  };

  const handleLogout = async () => {
    // Send offline signal to server before clearing user
    if (user?.employeeId) {
      try {
        const base = getApiBase();
        await fetchWithTimeout(`${base}/status/offline`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: user.employeeId })
        }, 5000);
      } catch (e) { /* silent */ }
    }
    if (isScreenTimeRunning) {
      stopScreenTime().catch((err) => console.error('Screen time stop on logout failed:', err));
    }
    setUser(null);
    await db.auth.clear();
    setShowForceChangePassword(false);
    setAuthView('home');
    if (user) {
      addAuditLog('LOGOUT', { email: user.email, name: user.name }).catch((err) => console.error('Audit log on logout failed:', err));
    }
  };

  // ============================================================
  // USER MANAGEMENT (UPDATED: location support, server sync)
  // ============================================================
  const handleCreateUser = async (e) => {
    e.preventDefault();
    const userExists = users.some(u => u.email === newUser.email);
    if (userExists) {
      alert('User with this email already exists!');
      return;
    }
    const nameExists = users.some(u => String(u.name || '').trim().toLowerCase() === String(newUser.name || '').trim().toLowerCase());
    if (nameExists) {
      alert('A user with this name already exists. Every employee must have a unique name.');
      return;
    }

    const ROLE_PREFIX = { manager: 'MGR', supervisor: 'SUP', field_officer: 'FO' };
    const prefix = ROLE_PREFIX[newUser.role] || 'FO';
    let max = 0;
    users.forEach(u => {
      const m = String(u.employeeId || '').match(new RegExp(`^${prefix}(\\d+)$`));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    const employeeId = `${prefix}${String(max + 1).padStart(3, '0')}`;
    const idTaken = users.some(u => String(u.employeeId || '').toUpperCase() === employeeId);
    if (idTaken) {
      alert(`Could not generate a unique Employee ID. Please try again.`);
      return;
    }

    const locationPath = buildLocationPath(selectedLocations);

    const newUserObj = {
      id: uid(),
      employeeId,
      name: newUser.name,
      email: newUser.email,
      password: newUser.password || generateSimplePassword(),
      phone: newUser.phone || '',
      role: newUser.role,
      region: locationPath,
      supervisorId: newUser.role === 'field_officer' ? newUser.supervisorId : null,
      assignedSites: newUser.role === 'field_officer' ? (newUser.assignedSites || '').split(',').map(s => s.trim()).filter(s => s) : [],
      status: 'active',
      managerId: 'm1',
      shift: newUser.shift || 'Day',
      department: newUser.department || '',
      gpsEnabled: true,
      pin: newUser.role === 'field_officer' ? '1234' : null,
      profilePhoto: null,
      must_change_password: newUser.role === 'field_officer' ? true : false,
      country_id: locationId(selectedLocations.country),
      region_id: locationId(selectedLocations.region),
      zone_id: locationId(selectedLocations.zone),
      woreda_id: locationId(selectedLocations.woreda),
      kebele_id: locationId(selectedLocations.kebele),
      community_id: locationId(selectedLocations.community),
      locationPath: locationPath,
    };

    await db.users.add(newUserObj);
    setUsers([...users, newUserObj]);

    const online = await checkRealInternet();
    let createdPassword = newUserObj.password || '';
    if (online) {
      try {
        const response = await fetch(`${getApiBase()}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newUserObj)
        });
        if (response.ok) {
          const serverUser = await response.json();
          if (serverUser.temporaryPassword) {
            createdPassword = serverUser.temporaryPassword;
            await db.users.update(newUserObj.id, { 
              password: serverUser.temporaryPassword,
              synced: true,
              must_change_password: true
            });
            setUsers(prev => prev.map(u => 
              u.id === newUserObj.id ? { ...u, password: serverUser.temporaryPassword, synced: true, must_change_password: true } : u
            ));
          } else {
            await db.users.update(newUserObj.id, { synced: true });
            setUsers(prev => prev.map(u => 
              u.id === newUserObj.id ? { ...u, synced: true } : u
            ));
          }
          console.log('✅ User synced to PostgreSQL');
        } else {
          throw new Error('Server responded with error');
        }
      } catch (err) {
        console.log('📡 User saved offline, will sync later', err);
        syncQueue.add({ type: 'user', id: newUserObj.id, data: newUserObj });
      }
    } else {
      syncQueue.add({ type: 'user', id: newUserObj.id, data: newUserObj });
      console.log('📡 User queued for sync');
    }

    if (addNotification) {
      addNotification(
        newUserObj.id,
        'Account Created',
        `Welcome ${newUserObj.name}! Your account has been created.`,
        'success'
      );
    }
    
    const manager = users.find(u => u.role === 'manager');
    if (manager) {
      addNotification(manager.id, 'New User Created', `${newUserObj.name} (${newUserObj.role}) has been created`, 'info');
    }

    alert(`✅ User ${newUserObj.name} created successfully!${createdPassword ? `\n\nLogin Email: ${newUserObj.email}\nPassword: ${createdPassword}` : ''}`);

    setNewUser({
      name: '',
      email: '',
      password: '',
      phone: '',
      role: '',
      region: '',
      supervisorId: '',
      assignedSites: '',
      shift: 'Day',
      department: ''
    });
    setSelectedLocations({
      country: null,
      region: null,
      zone: null,
      woreda: null,
      kebele: null,
      community: null
    });
  };

  // ===== FIXED toggleUserStatus =====
  const toggleUserStatus = async (userId) => {
    const userObj = users.find(u => u.id === userId);
    if (!userObj) return;
    const newStatus = userObj.status === 'active' ? 'inactive' : 'active';

    // 1. Optimistic update locally
    setUsers(prev => {
      const updated = prev.map(u =>
        u.id === userId ? { ...u, status: newStatus } : u
      );
      db.users.bulkPut(updated);
      return updated;
    });

    // 2. Try to update server if online
    const online = await checkRealInternet();
    let serverSuccess = false;
    if (online) {
      try {
        const resp = await fetch(`${getApiBase()}/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        if (resp.ok) {
          serverSuccess = true;
          const updatedUser = await resp.json();
          setUsers(prev => prev.map(u =>
            u.id === userId ? { ...u, ...updatedUser } : u
          ));
          await db.users.update(userId, updatedUser);
          console.log('✅ Status updated on server');
        } else {
          throw new Error('Server rejected status update');
        }
      } catch (error) {
        console.error('Status update error:', error);
        // fall through – we'll queue if needed
      }
    }

    // 3. If server update failed or offline, queue the change
    if (!serverSuccess) {
      const queueItems = syncQueue.getAll();
      const alreadyQueued = queueItems.some(item =>
        item.type === 'user_status_update' && item.data.userId === userId
      );
      if (!alreadyQueued) {
        syncQueue.add({
          type: 'user_status_update',
          id: userId,
          data: { userId, status: newStatus }
        });
        if (!online) {
          alert('📋 Status change saved offline. Will sync when online.');
        }
      }
    }

    // 4. Notify
    addNotification(userId, 'Account Status Updated', `Account ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'warning');
    addAuditLog('TOGGLE_USER_STATUS', { userId, newStatus });
  };

  // ===== FIXED deleteUser =====
  const deleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    const userObj = users.find(u => u.id === userId);
    if (!userObj) return;

    // 1. Remove from local state and IndexedDB (optimistic)
    setUsers(prev => prev.filter(u => u.id !== userId));
    await db.users.delete(userId);

    // 2. Try to delete on server if online
    const online = await checkRealInternet();
    let serverDeleted = false;
    if (online) {
      try {
        const resp = await fetch(`${getApiBase()}/users/${userId}`, {
          method: 'DELETE'
        });
        if (resp.ok) {
          serverDeleted = true;
          console.log('✅ User deleted from server');
        } else {
          throw new Error('Server rejected deletion');
        }
      } catch (error) {
        console.error('Delete error:', error);
        // fall through – queue
      }
    }

    // 3. If not deleted on server, queue the deletion
    if (!serverDeleted) {
      const queueItems = syncQueue.getAll();
      const alreadyQueued = queueItems.some(item =>
        item.type === 'user_delete' && item.data.userId === userId
      );
      if (!alreadyQueued) {
        syncQueue.add({
          type: 'user_delete',
          id: userId,
          data: { userId }
        });
        if (!online) {
          alert('📋 User deletion saved locally. It will be removed from the server when online.');
        }
      }
    } else {
      alert(`✅ User ${userObj.name} deleted successfully.`);
    }

    // 4. Notify
    addNotification(userId, 'Account Deleted', 'Your account has been deleted', 'error');
    addAuditLog('DELETE_USER', { userId, name: userObj?.name });
  };

  // ============================================================
  // TASK MANAGEMENT
  // ============================================================
  const handleCreateTask = async (e) => {
    e.preventDefault();
    const online = await checkRealInternet();

    const task = {
      id: uid(),
      employeeId: newTask.employeeId,
      assignedBy: user.employeeId,
      assignedByName: user.name,
      title: newTask.title,
      description: newTask.description,
      deadline: newTask.deadline,
      priority: newTask.priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
      synced: false
    };

    setTasks(prev => { const updated = [...prev, task]; db.tasks.bulkPut(updated); return updated; });
    
    if (online) {
      try {
        const response = await fetch(`${API_BASE}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task)
        });
        if (response.ok) {
          await db.tasks.update(task.id, { synced: true });
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, synced: true } : t));
        } else {
          throw new Error('API failed');
        }
      } catch (err) {
        syncQueue.add({ type: 'task', id: task.id, data: task });
        console.log('📡 Task queued for sync');
      }
    } else {
      syncQueue.add({ type: 'task', id: task.id, data: task });
      alert('📋 Task saved offline! Will sync when online.');
    }
    
    const assignedUser = users.find(u => u.employeeId === task.employeeId);
    if (assignedUser) {
      addNotification(assignedUser.id, 'New Task Assigned', `Task "${task.title}" has been assigned to you`, 'info');
    }
    const manager = users.find(u => u.role === 'manager');
    if (manager) {
      addNotification(manager.id, '📋 Task Assigned', `Task "${task.title}" assigned to ${assignedUser?.name}`, 'info');
    }
    addAuditLog('CREATE_TASK', { task: task.title, assignedTo: task.employeeId });
    setLiveStatus(prev => {
      const updated = prev.map(l => l.employeeId === task.employeeId ? { ...l, tasksInProgress: (l.tasksInProgress || 0) + 1 } : l);
      db.status.bulkPut(updated);
      return updated;
    });
    setShowTaskModal(false);
  };

  const updateTaskStatus = async (taskId, status) => {
    const online = await checkRealInternet();
    
    setTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, status, completedAt: status === 'completed' ? new Date().toISOString() : t.completedAt, synced: online ? true : false } : t);
      db.tasks.bulkPut(updated);
      return updated;
    });
    
    if (!online) {
      syncQueue.add({
        type: 'task_update',
        id: taskId,
        data: { taskId, status }
      });
      alert('📋 Task update saved offline! Will sync when online.');
    }
    
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const assignedUser = users.find(u => u.employeeId === task.employeeId);
      if (assignedUser) {
        addNotification(assignedUser.id, 'Task Updated', `Task "${task.title}" has been marked as ${status}`, 'info');
      }
      addAuditLog('UPDATE_TASK', { task: task.title, status });
    }
    if (status === 'completed' && task) {
      setLiveStatus(prev => {
        const updated = prev.map(l =>
          l.employeeId === task.employeeId
            ? { ...l, tasksCompleted: (l.tasksCompleted || 0) + 1, tasksInProgress: Math.max((l.tasksInProgress || 0) - 1, 0) }
            : l
        );
        db.status.bulkPut(updated);
        return updated;
      });
    }
  };

  // ============================================================
  // LEAVE MANAGEMENT
  // ============================================================
  const handleRequestLeave = async (e) => {
    e.preventDefault();
    if (!newLeave.startDate || !newLeave.endDate || !newLeave.reason) {
      alert('Please fill all required fields');
      return;
    }

    const online = await checkRealInternet();

    const leave = {
      id: uid(),
      employeeId: isOfficer ? user.employeeId : newLeave.employeeId,
      employeeName: isOfficer ? user.name : users.find(u => u.employeeId === newLeave.employeeId)?.name || user.name,
      startDate: newLeave.startDate,
      endDate: newLeave.endDate,
      reason: newLeave.reason,
      type: newLeave.type,
      status: 'pending',
      createdAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      synced: false
    };

    try {
      await db.leaves.add(leave);
      setLeaves(prev => [leave, ...prev]);
      
      if (online) {
        try {
          const response = await fetch(`${API_BASE}/leaves`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leave)
          });
          if (response.ok) {
            await db.leaves.update(leave.id, { synced: true });
            setLeaves(prev => prev.map(l => l.id === leave.id ? { ...l, synced: true } : l));
          } else {
            throw new Error('API failed');
          }
        } catch (err) {
          syncQueue.add({ type: 'leave', id: leave.id, data: leave });
          console.log('📡 Leave request queued for sync');
        }
      } else {
        syncQueue.add({ type: 'leave', id: leave.id, data: leave });
        alert('📅 Leave request saved offline! Will sync when online.');
      }
      
      if (isOfficer && user) {
        const supervisor = users.find(u => u.id === user.supervisorId);
        if (supervisor) {
          addNotification(supervisor.id, '📅 Leave Request', `${user.name} has requested leave`, 'info');
        }
        const manager = users.find(u => u.role === 'manager');
        if (manager) {
          addNotification(manager.id, '📅 Leave Request', `${user.name} requested leave`, 'info');
        }
      }
      addAuditLog('REQUEST_LEAVE', { employee: leave.employeeName, type: leave.type });
      setShowLeaveModal(false);
      setNewLeave({ employeeId: '', startDate: '', endDate: '', reason: '', type: 'annual' });
      alert('✅ Leave request submitted successfully!');
    } catch (error) {
      console.error('Error submitting leave:', error);
      alert('❌ Error submitting leave request');
    }
  };

  const approveLeave = async (leaveId, approve) => {
    try {
      const leave = leaves.find(l => l.id === leaveId);
      if (!leave) {
        alert('Leave request not found');
        return;
      }

      const online = await checkRealInternet();
      const status = approve ? 'approved' : 'rejected';

      const updatedLeave = {
        ...leave,
        status,
        approvedBy: user.employeeId,
        approvedAt: new Date().toISOString(),
        synced: online ? true : false
      };

      await db.leaves.update(leaveId, updatedLeave);
      setLeaves(prev => prev.map(l => l.id === leaveId ? updatedLeave : l));
      
      if (!online) {
        syncQueue.add({
          type: 'leave_update',
          id: leaveId,
          data: { leaveId, status }
        });
        alert(`📋 Leave ${approve ? 'approved' : 'rejected'} offline! Will sync when online.`);
      } else {
        const officer = users.find(u => u.employeeId === leave.employeeId);
        if (officer) {
          addNotification(officer.id, 'Leave Request Update', `Your leave request has been ${approve ? 'approved ✅' : 'rejected ❌'}`, approve ? 'success' : 'error');
        }
        alert(`✅ Leave ${approve ? 'approved' : 'rejected'} successfully!`);
      }
      
      addAuditLog('APPROVE_LEAVE', { leaveId, status });
    } catch (error) {
      console.error('Error updating leave:', error);
      alert('❌ Error updating leave');
    }
  };

  // ============================================================
  // PERMISSION MANAGEMENT
  // ============================================================
  const handleRequestPermission = async (e) => {
    e.preventDefault();
    if (!permissionRequest.permissionType || !permissionRequest.startDate || !permissionRequest.endDate || !permissionRequest.reason) {
      alert('Please fill all required fields');
      return;
    }

    const online = await checkRealInternet();

    const permission = {
      id: uid(),
      employeeId: isOfficer ? user.employeeId : newPermission.employeeId,
      employeeName: isOfficer ? user.name : users.find(u => u.employeeId === newPermission.employeeId)?.name || user.name,
      permissionType: permissionRequest.permissionType,
      startDate: permissionRequest.startDate,
      endDate: permissionRequest.endDate,
      reason: permissionRequest.reason,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
      synced: false
    };

    try {
      await db.permissions.add(permission);
      setPermissions(prev => [permission, ...prev]);
      
      if (online) {
        try {
          const response = await fetch(`${API_BASE}/permissions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(permission)
          });
          if (response.ok) {
            await db.permissions.update(permission.id, { synced: true });
            setPermissions(prev => prev.map(p => p.id === permission.id ? { ...p, synced: true } : p));
          } else {
            throw new Error('API failed');
          }
        } catch (err) {
          syncQueue.add({ type: 'permission', id: permission.id, data: permission });
          console.log('📡 Permission request queued for sync');
        }
      } else {
        syncQueue.add({ type: 'permission', id: permission.id, data: permission });
        alert('📋 Permission request saved offline! Will sync when online.');
      }
      
      if (isOfficer && user) {
        const supervisor = users.find(u => u.id === user.supervisorId);
        if (supervisor) {
          addNotification(supervisor.id, '📋 Permission Request', `${user.name} has requested permission for ${permission.permissionType}`, 'info');
        }
        const manager = users.find(u => u.role === 'manager');
        if (manager) {
          addNotification(manager.id, '📋 Permission Request', `${user.name} requested permission`, 'info');
        }
      }
      addAuditLog('REQUEST_PERMISSION', { employee: permission.employeeName, type: permission.permissionType });
      setShowPermissionRequestModal(false);
      setPermissionRequest({ permissionType: '', startDate: '', endDate: '', reason: '' });
      alert('✅ Permission request submitted successfully!');
    } catch (error) {
      console.error('Error submitting permission:', error);
      alert('❌ Error submitting permission request');
    }
  };

  const approvePermission = async (permissionId, approve) => {
    try {
      const permission = permissions.find(p => p.id === permissionId);
      if (!permission) {
        alert('Permission request not found');
        return;
      }

      const online = await checkRealInternet();
      const status = approve ? 'approved' : 'rejected';

      const updatedPermission = {
        ...permission,
        status,
        approvedBy: user.employeeId,
        approvedAt: new Date().toISOString(),
        synced: online ? true : false
      };

      await db.permissions.update(permissionId, updatedPermission);
      setPermissions(prev => prev.map(p => p.id === permissionId ? updatedPermission : p));
      
      if (!online) {
        syncQueue.add({
          type: 'permission_update',
          id: permissionId,
          data: { permissionId, status }
        });
        alert(`📋 Permission ${approve ? 'approved' : 'rejected'} offline! Will sync when online.`);
      } else {
        const officer = users.find(u => u.employeeId === permission.employeeId);
        if (officer) {
          addNotification(officer.id, 'Permission Request Update', `Your permission request has been ${approve ? 'approved ✅' : 'rejected ❌'}`, approve ? 'success' : 'error');
        }
        alert(`✅ Permission ${approve ? 'approved' : 'rejected'} successfully!`);
      }
      
      addAuditLog('APPROVE_PERMISSION', { permissionId, status });
    } catch (error) {
      console.error('Error updating permission:', error);
      alert('❌ Error updating permission');
    }
  };

  // ============================================================
  // CITIZEN REGISTRATION
  // ============================================================
  const handleCitizenRegister = async (e) => {
    e.preventDefault();

    if (!citizenForm.firstName.trim() || !citizenForm.lastName.trim()) {
      alert('First name and last name are required');
      return;
    }
    if (!citizenForm.dateOfBirth) {
      alert('Date of birth is required');
      return;
    }
    if (!citizenForm.phone.trim()) {
      alert('Phone number is required');
      return;
    }

    const online = await checkRealInternet();

    const newCitizen = {
      id: uid(),
      nationalId: generateNationalId(),
      firstName: citizenForm.firstName.trim(),
      lastName: citizenForm.lastName.trim(),
      dateOfBirth: citizenForm.dateOfBirth,
      gender: citizenForm.gender,
      phone: citizenForm.phone.trim(),
      email: citizenForm.email.trim(),
      address: citizenForm.address.trim(),
      region: citizenForm.region || user.region,
      district: citizenForm.district.trim(),
      village: citizenForm.village.trim(),
      occupation: citizenForm.occupation.trim(),
      maritalStatus: citizenForm.maritalStatus,
      registrationDate: new Date().toISOString(),
      registeredBy: user.employeeId,
      registeredByName: user.name,
      idType: citizenForm.idType,
      idNumber: citizenForm.idNumber.trim(),
      biometrics: citizenForm.biometrics,
      status: 'active',
      synced: false
    };

    setCitizens(prev => { const updated = [newCitizen, ...prev]; db.citizens.bulkPut(updated); return updated; });

    if (online) {
      try {
        const response = await fetch(`${API_BASE}/citizens`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newCitizen)
        });
        if (response.ok) {
          await db.citizens.update(newCitizen.id, { synced: true });
          setCitizens(prev => prev.map(c => c.id === newCitizen.id ? { ...c, synced: true } : c));
        } else {
          throw new Error('API failed');
        }
      } catch (err) {
        syncQueue.add({ type: 'citizen', id: newCitizen.id, data: newCitizen });
        console.log('📡 Citizen queued for sync');
      }
    } else {
      syncQueue.add({ type: 'citizen', id: newCitizen.id, data: newCitizen });
      alert('🆔 Citizen saved offline! Will sync when online.');
    }

    if (isOfficer && user) {
      const supervisor = users.find(u => u.id === user.supervisorId);
      if (supervisor) {
        addNotification(supervisor.id, '🆔 New Citizen Registered', `${user.name} registered ${newCitizen.firstName} ${newCitizen.lastName}`, 'success');
      }
      const manager = users.find(u => u.role === 'manager');
      if (manager) {
        addNotification(manager.id, '🆔 New Citizen Registered', `${user.name} registered ${newCitizen.firstName} ${newCitizen.lastName}`, 'success');
      }
    }
    addAuditLog('REGISTER_CITIZEN', { nationalId: newCitizen.nationalId, name: `${newCitizen.firstName} ${newCitizen.lastName}` });

    setCitizenForm({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: '',
      phone: '',
      email: '',
      address: '',
      region: '',
      district: '',
      village: '',
      occupation: '',
      maritalStatus: '',
      registrationDate: getToday(),
      idType: 'National ID',
      idNumber: '',
      biometrics: false
    });
    alert('✅ Citizen registered successfully!');
  };

  // ============================================================
  // REPORT SUBMISSION
  // ============================================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return alert('Please login first');

    if (form.registrations < 0) {
      alert('Registrations cannot be negative');
      return;
    }

    const online = await checkRealInternet();

    const newReport = {
      id: uid(),
      reportId: `RPT-${Date.now()}`,
      reportDate: form.reportDate,
      region: form.region || user.region,
      employeeId: user.employeeId,
      employeeName: user.name,
      supervisorId: user.supervisorId || '',
      registrations: Number(form.registrations) || 0,
      registrationEfficiency: Math.round((Number(form.registrations) / 100) * 100),
      operationalStatus: form.operationalStatus,
      workHours: Number(form.workHours),
      issues: form.issues.trim(),
      comments: form.comments.trim(),
      challenges: form.challenges.trim(),
      activities: form.activities.trim() || '',
      equipmentStatus: form.equipmentStatus || 'operational',
      materialsUsed: form.materialsUsed.trim() || '',
      teamMembers: form.teamMembers.trim() || '',
      weatherConditions: form.weatherConditions.trim() || '',
      communityFeedback: form.communityFeedback.trim() || '',
      submittedAt: new Date().toISOString(),
      synced: false,
      syncAttempts: 0,
      syncError: null,
      reviewed: false,
      reviewedBy: null
    };

    setReports(prev => { const updated = [newReport, ...prev]; db.reports.bulkPut(updated); return updated; });

    if (online) {
      try {
        const response = await fetch(`${getApiBase()}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'report', data: newReport })
        });
        if (response.ok) {
          await db.reports.update(newReport.id, { synced: true });
          setReports(prev => prev.map(r => r.id === newReport.id ? { ...r, synced: true } : r));
          if (addNotification) {
            await addNotification(user.id, '✅ Report Synced', `Report submitted and synced to the server.`, 'success');
          }
        } else {
          throw new Error(`Server responded with ${response.status}`);
        }
      } catch (err) {
        syncQueue.add({ type: 'report', id: newReport.id, data: newReport });
        console.log('📡 Report queued for sync:', err.message);
      }
    } else {
      syncQueue.add({ type: 'report', id: newReport.id, data: newReport });
      alert('📋 Report saved offline! It will sync when you\'re back online.');
    }

    if (isOfficer && user) {
      const supervisor = users.find(u => u.id === user.supervisorId);
      if (supervisor) {
        addNotification(supervisor.id, '📋 Report Submitted', `${user.name} submitted a report`, 'success');
      }
      const manager = users.find(u => u.role === 'manager');
      if (manager) {
        addNotification(manager.id, '📋 Report Submitted', `${user.name} submitted a report`, 'info');
      }
    } else if (isSupervisor && user) {
      const manager = users.find(u => u.role === 'manager');
      if (manager) {
        addNotification(manager.id, '📋 Report Submitted', `${user.name} submitted a report`, 'info');
      }
    }
    addAuditLog('SUBMIT_REPORT', { registrations: form.registrations });

    setForm({
      reportDate: getToday(),
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
    alert('📋 Report submitted and synced successfully!');
  };

  // ============================================================
  // SUPERVISOR REPORTS – FIXED URL (hyphen)
  // ============================================================
  const handleSupervisorReportSubmit = async (e) => {
    e.preventDefault();
    const officer = users.find(u => u.id === supervisorReportForm.officerId);
    if (!officer) {
      alert('Please select an officer');
      return;
    }

    const online = await checkRealInternet();

    const newReport = {
      id: uid(),
      supervisorId: user.id,
      supervisorName: user.name,
      officerId: officer.id,
      officerName: officer.name,
      officerRegion: officer.region,
      reportDate: supervisorReportForm.reportDate,
      performance: supervisorReportForm.performance,
      attendance: supervisorReportForm.attendance,
      quality: supervisorReportForm.quality,
      punctuality: supervisorReportForm.punctuality,
      teamwork: supervisorReportForm.teamwork,
      communication: supervisorReportForm.communication,
      comments: supervisorReportForm.comments,
      recommendations: supervisorReportForm.recommendations,
      overallRating: supervisorReportForm.overallRating,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      region: officer.region,
      type: 'officer_report',
      synced: false
    };

    setSupervisorReports(prev => { const updated = [newReport, ...prev]; db.supervisor_reports.bulkPut(updated); return updated; });

    setReports(prev => {
      const updated = prev.map(r => r.employeeId === officer.employeeId ? { ...r, reviewed: true, reviewedBy: user.name, reviewDate: new Date().toISOString() } : r);
      db.reports.bulkPut(updated);
      return updated;
    });

    if (online) {
      try {
        const response = await fetch(`${API_BASE}/supervisor-reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReport)
        });
        if (response.ok) {
          await db.supervisor_reports.update(newReport.id, { synced: true });
          setSupervisorReports(prev => prev.map(r => r.id === newReport.id ? { ...r, synced: true } : r));
          console.log('✅ Supervisor report synced to server');
        } else {
          throw new Error('API failed');
        }
      } catch (err) {
        console.error('Failed to sync supervisor report:', err);
        syncQueue.add({ type: 'supervisor_report', id: newReport.id, data: newReport });
      }
    } else {
      syncQueue.add({ type: 'supervisor_report', id: newReport.id, data: newReport });
      alert('📋 Supervisor report saved offline! Will sync when online.');
    }

    const manager = users.find(u => u.role === 'manager');
    if (manager) {
      addNotification(manager.id, '📋 Supervisor Report', `${user.name} submitted a report about ${officer.name}`, 'info');
    }
    addNotification(officer.id, '📋 Supervisor Report', `${user.name} submitted a report about you`, 'info');
    addAuditLog('SUPERVISOR_REPORT', { officer: officer.name, rating: supervisorReportForm.overallRating });
    setShowSupervisorReportModal(false);
    alert('✅ Supervisor report submitted successfully!');
  };

  // ============================================================
  // SUPERVISOR SELF REPORT – FIXED URL (hyphen)
  // ============================================================
  const handleSupervisorSelfReportSubmit = async (e) => {
    e.preventDefault();
    const online = await checkRealInternet();

    const newReport = {
      id: uid(),
      supervisorId: user.id,
      supervisorName: user.name,
      reportDate: supervisorSelfReportForm.reportDate,
      region: supervisorSelfReportForm.region || user.region,
      siteVisits: supervisorSelfReportForm.siteVisits,
      issuesResolved: supervisorSelfReportForm.issuesResolved,
      challenges: supervisorSelfReportForm.challenges,
      achievements: supervisorSelfReportForm.achievements,
      teamMorale: supervisorSelfReportForm.teamMorale,
      resourceStatus: supervisorSelfReportForm.resourceStatus,
      recommendations: supervisorSelfReportForm.recommendations,
      overallStatus: supervisorSelfReportForm.overallStatus,
      submittedAt: new Date().toISOString(),
      type: 'self_report',
      synced: false
    };

    setSupervisorReports(prev => { const updated = [newReport, ...prev]; db.supervisor_reports.bulkPut(updated); return updated; });

    if (online) {
      try {
        const response = await fetch(`${API_BASE}/supervisor-reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReport)
        });
        if (response.ok) {
          await db.supervisor_reports.update(newReport.id, { synced: true });
          setSupervisorReports(prev => prev.map(r => r.id === newReport.id ? { ...r, synced: true } : r));
          console.log('✅ Self report synced to server');
        } else {
          throw new Error('API failed');
        }
      } catch (err) {
        console.error('Failed to sync self report:', err);
        syncQueue.add({ type: 'supervisor_report', id: newReport.id, data: newReport });
      }
    } else {
      syncQueue.add({ type: 'supervisor_report', id: newReport.id, data: newReport });
      alert('📋 Self report saved offline! Will sync when online.');
    }

    const manager = users.find(u => u.role === 'manager');
    if (manager) {
      addNotification(manager.id, '📋 Supervisor Self Report', `${user.name} submitted their self report`, 'info');
    }
    addAuditLog('SUPERVISOR_SELF_REPORT', { supervisor: user.name });
    setShowSupervisorSelfReportModal(false);
    alert('✅ Self report submitted successfully!');
  };

  // ============================================================
  // EXPORT FUNCTIONS
  // ============================================================
  const exportCSVWithNotification = (data, filename) => {
    if (data.length === 0) {
      alert('No data to export');
      return;
    }
    exportCSV(data, filename);
    if (user) {
      addNotification(user.id, 'Export Complete', `${filename} exported successfully`, 'success');
    }
    addAuditLog('EXPORT_CSV', { filename });
  };

  const exportJSONWithNotification = (data, filename) => {
    exportJSON(data, filename);
    if (user) {
      addNotification(user.id, 'Export Complete', `${filename} exported successfully`, 'success');
    }
    addAuditLog('EXPORT_JSON', { filename });
  };

  // ============================================================
  // RENDER FUNCTIONS (placeholders)
  // ============================================================
  const renderTrendChart = () => { /* implemented in Dashboard */ };
  const renderBarChart = () => { /* implemented in Analytics */ };
  const renderTasks = () => { /* implemented in TaskManagement */ };
  const renderTaskModal = () => { /* implemented in TaskManagement */ };
  const renderLeaves = () => { /* implemented in LeaveManagement */ };
  const renderLeaveModal = () => { /* implemented in LeaveManagement */ };
  const renderPermissions = () => { /* implemented in PermissionManagement */ };
  const renderPermissionRequestModal = () => { /* implemented in PermissionManagement */ };
  const renderAlerts = () => { /* implemented in AlertManagement */ };
  const renderAlertModal = () => { /* implemented in AlertManagement */ };
  const renderScreenTimeTable = () => { /* implemented in ScreenTimeManagement */ };

  // ============================================================
  // LOGIN PAGE (Home first, then Login)
  // ============================================================
  if (!user) {
    if (isLoading) {
      return <LoadingScreen />;
    }
    if (authView === 'login') {
      return (
        <Login
          onLogin={handleLogin}
          loginError={loginError}
          isOnline={isOnline}
          onBack={() => setAuthView('home')}
        />
      );
    }
    return <Home onLogin={() => setAuthView('login')} isOnline={isOnline} />;
  }

  // ============================================================
  // MAIN APP RETURN
  // ============================================================
  return (
    <>
      {/* ===== FORCE PASSWORD CHANGE MODAL (OVERLAY) ===== */}
      {showForceChangePassword && (
        <div className="force-password-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h2 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>🔒 Change Password</h2>
            <p style={{ color: '#dc2626', marginBottom: '20px', fontSize: '14px' }}>
              You must change your temporary password before continuing.
            </p>
            <form onSubmit={handleForceChangePassword}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '14px' }}>
                  Current (Temporary) Password *
                </label>
                <input
                  type="password"
                  required
                  value={forcePasswordForm.currentPassword}
                  onChange={(e) => setForcePasswordForm({
                    ...forcePasswordForm,
                    currentPassword: e.target.value
                  })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '14px' }}>
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  value={forcePasswordForm.newPassword}
                  onChange={(e) => setForcePasswordForm({
                    ...forcePasswordForm,
                    newPassword: e.target.value
                  })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '14px'
                  }}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: '500', marginBottom: '5px', fontSize: '14px' }}>
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  value={forcePasswordForm.confirmPassword}
                  onChange={(e) => setForcePasswordForm({
                    ...forcePasswordForm,
                    confirmPassword: e.target.value
                  })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    border: '1px solid #ccc',
                    fontSize: '14px'
                  }}
                />
              </div>
              {forcePasswordError && (
                <div style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>
                  ❌ {forcePasswordError}
                </div>
              )}
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#0b7e4b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#065f37'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#0b7e4b'}
              >
                Update Password
              </button>
            </form>
          </div>
        </div>
      )}

      {isOfficer && showPopup && (
        <VerificationPopup
          officerId={user?.id}
          officerName={user?.name}
          onAnswer={handleAnswer}
          onClose={handleClose}
        />
      )}

      {isOfficer && !showPopup && nextVerificationAt && (
        <NextVerificationCountdown target={nextVerificationAt} />
      )}
      
      <div className="app">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          user={user} 
          pendingSync={pendingSync}
          liveStatus={liveStatus}
          users={users}
          verificationHistory={verificationHistory}
          reports={reports}
          citizens={citizens}
          verificationScore={verificationScore}
          onLogout={handleLogout}
          onProfileClick={() => setActiveTab('profile')}
        />
        <div className="main-content">
          <Header 
            user={user}
            isOnline={isOnline}
            syncing={syncing}
            pendingSync={pendingSync}
            screenTimeDisplay={screenTimeDisplay}
            isScreenTimeRunning={isScreenTimeRunning}
            isIdle={isIdle}
            activeTab={activeTab}
            notifications={appNotifications}
            setNotifications={setAppNotifications}
            markNotificationRead={markNotificationRead}
            markAllNotificationsRead={markAllNotificationsRead}
            onProfileClick={() => setActiveTab('profile')}
          />
          <div className="content">
            {/* Each tab wrapped with ErrorBoundary to isolate crashes */}
            <ErrorBoundary>
              {activeTab === 'dashboard' && (
                <Dashboard 
                  isManager={isManager}
                  isSupervisor={isSupervisor}
                  isOfficer={isOfficer}
                  user={user}
                  reports={reports}
                  supervisorReports={supervisorReports}
                  users={users}
                  screenTime={screenTime}
                  leaves={leaves}
                  permissions={permissions}
                  citizens={citizens}
                  totalReports={totalReports}
                  totalRegistrations={totalRegistrations}
                  teamMembers={teamMembers}
                  pendingLeaves={pendingLeaves}
                  pendingPermissions={pendingPermissions}
                  topPerformers={topPerformers}
                  teamPerformance={teamPerformance}
                  employeePerformance={employeePerformance}
                  renderTrendChart={renderTrendChart}
                  liveStatus={liveStatus}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'profile' && (
                <ProfilePage
                  user={user}
                  setUser={setUser}
                  setUsers={setUsers}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'register' && isOfficer && (
                <CitizenRegistration 
                  citizenForm={citizenForm}
                  setCitizenForm={setCitizenForm}
                  handleCitizenRegister={handleCitizenRegister}
                  user={user}
                  citizens={citizens}
                  addNotification={addNotification}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'reports' && (isOfficer || isSupervisor) && (
                <ReportList 
                  reports={isSupervisor ? getSupervisorReports() : filteredReports}
                  filteredReports={filteredReports}
                  isOfficer={isOfficer}
                  isSupervisor={isSupervisor}
                  user={user}
                  users={users}
                  selectedRegion={selectedRegion}
                  setSelectedRegion={setSelectedRegion}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  exportCSV={exportCSVWithNotification}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'report_new' && isOfficer && (
                <ReportForm 
                  form={form}
                  setForm={setForm}
                  handleSubmit={handleSubmit}
                  user={user}
                  isOfficer={isOfficer}
                  users={users}
                  addNotification={addNotification}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'tasks' && (isSupervisor || isOfficer) && (
                <TaskManagement 
                  filteredTasks={isSupervisor ? getSupervisorTasks() : filteredTasks}
                  tasks={tasks}
                  setTasks={setTasks}
                  users={users}
                  user={user}
                  isManager={isManager}
                  isSupervisor={isSupervisor}
                  isOfficer={isOfficer}
                  teamMembers={teamMembers}
                  taskFilter={taskFilter}
                  setTaskFilter={setTaskFilter}
                  renderTasks={renderTasks}
                  renderTaskModal={renderTaskModal}
                  addNotification={addNotification}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'permissions' && (isManager || isSupervisor || isOfficer) && (
                <PermissionManagement 
                  filteredPermissions={isSupervisor ? getSupervisorPermissions() : filteredPermissions}
                  permissions={permissions}
                  setPermissions={setPermissions}
                  users={users}
                  user={user}
                  isManager={isManager}
                  isSupervisor={isSupervisor}
                  isOfficer={isOfficer}
                  teamMembers={teamMembers}
                  addNotification={addNotification}
                  renderPermissions={renderPermissions}
                  renderPermissionRequestModal={renderPermissionRequestModal}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'screentime' && isSupervisor && (
                <ScreenTimeManagement 
                  screenTime={screenTime}
                  setScreenTime={setScreenTime}
                  users={users}
                  user={user}
                  isManager={isManager}
                  isSupervisor={isSupervisor}
                  isOfficer={isOfficer}
                  teamMembers={teamMembers}
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  trustFilter={trustFilter}
                  setTrustFilter={setTrustFilter}
                  addNotification={addNotification}
                  renderScreenTimeTable={renderScreenTimeTable}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'supervisor_reports' && isSupervisor && (
                <SupervisorReports 
                  supervisorReports={supervisorReports}
                  users={users}
                  user={user}
                  teamMembers={teamMembers}
                  supervisorReportForm={supervisorReportForm}
                  setSupervisorReportForm={setSupervisorReportForm}
                  supervisorSelfReportForm={supervisorSelfReportForm}
                  setSupervisorSelfReportForm={setSupervisorSelfReportForm}
                  showSupervisorReportModal={showSupervisorReportModal}
                  setShowSupervisorReportModal={setShowSupervisorReportModal}
                  showSupervisorSelfReportModal={showSupervisorSelfReportModal}
                  setShowSupervisorSelfReportModal={setShowSupervisorSelfReportModal}
                  handleSupervisorReportSubmit={handleSupervisorReportSubmit}
                  handleSupervisorSelfReportSubmit={handleSupervisorSelfReportSubmit}
                  addNotification={addNotification}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'team' && (isManager || isSupervisor) && (
                <TeamManagement 
                  users={users}
                  user={user}
                  isManager={isManager}
                  isSupervisor={isSupervisor}
                  teamMembers={teamMembers}
                  reports={reports}
                  screenTime={screenTime}
                  liveStatus={liveStatus}
                  employeePerformance={employeePerformance}
                  selectedOfficer={selectedOfficer}
                  setSelectedOfficer={setSelectedOfficer}
                  citizens={citizens}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'users' && isManager && (
                <UserManagement 
                  users={users}
                  setUsers={setUsers}
                  newUser={newUser}
                  setNewUser={setNewUser}
                  handleCreateUser={handleCreateUser}
                  toggleUserStatus={toggleUserStatus}
                  deleteUser={deleteUser}
                  addNotification={addNotification}
                  selectedLocations={selectedLocations}
                  onLocationSelect={handleLocationSelect}
                  woredaSupervisors={woredaSupervisors}
                  loadingSupervisors={loadingSupervisors}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'analytics' && isManager && (
                <Analytics 
                  reports={reports}
                  users={users}
                  screenTime={screenTime}
                  liveStatus={liveStatus}
                  citizens={citizens}
                  totalReports={totalReports}
                  totalRegistrations={totalRegistrations}
                  regionStats={regionStats}
                  employeePerformance={employeePerformance}
                  renderBarChart={renderBarChart}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'citizens' && isManager && (
                <CitizensDatabase 
                  citizens={citizens}
                  users={users}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'audit' && isManager && (
                <AuditLog 
                  auditLog={auditLog}
                  setAuditLog={setAuditLog}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'all_reports' && isManager && (
                <AllReports 
                  reports={reports}
                  filteredReports={filteredReports}
                  users={users}
                  supervisorReports={supervisorReports}
                  setReports={setReports}
                  setSupervisorReports={setSupervisorReports}
                  selectedRegion={selectedRegion}
                  setSelectedRegion={setSelectedRegion}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  dateRange={dateRange}
                  setDateRange={setDateRange}
                  exportCSV={exportCSVWithNotification}
                  exportJSON={exportJSONWithNotification}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'alerts' && (isManager || isSupervisor || isOfficer) && (
                <AlertManagement 
                  alerts={alerts}
                  setAlerts={setAlerts}
                  users={users}
                  user={user}
                  isManager={isManager}
                  isSupervisor={isSupervisor}
                  isOfficer={isOfficer}
                  teamMembers={teamMembers}
                  newAlert={newAlert}
                  setNewAlert={setNewAlert}
                  addNotification={addNotification}
                  showAlertModal={showAlertModal}
                  setShowAlertModal={setShowAlertModal}
                  renderAlerts={renderAlerts}
                  renderAlertModal={renderAlertModal}
                />
              )}
            </ErrorBoundary>

            <ErrorBoundary>
              {activeTab === 'verification' && isSupervisor && (
                <VerificationPage 
                  users={users}
                  liveStatus={liveStatus}
                  verificationHistory={verificationHistory}
                  reports={reports}
                  citizens={citizens}
                  verificationScore={verificationScore}
                  supervisorId={isSupervisor ? user?.id : null}
                />
              )}
            </ErrorBoundary>

            {/* Sync Log */}
            {showSyncLog && (
              <div className="sync-log-overlay" onClick={() => setShowSyncLog(false)}>
                <div className="sync-log-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header"><h3>🔄 Sync Activity Log</h3><button className="modal-close" onClick={() => setShowSyncLog(false)}>✕</button></div>
                  <div className="modal-body">
                    {syncLog.length === 0 ? <div className="empty-log">No sync activity yet</div> : syncLog.map((log, i) => <div key={i} className="log-entry">{log}</div>)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <OfflineIndicator />
      <SyncStatus />
    </>
  );
}

// ============================================================
// MAIN APP
// ============================================================
function App() {
  return (
    <UserLanguageProvider>
      <AppContent />
    </UserLanguageProvider>
  );
}

export default App;