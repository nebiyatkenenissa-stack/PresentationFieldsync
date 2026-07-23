// App.jsx – FULL COMPLETE VERSION (with alerts, audit, screen time, tasks, verification, supervisor reports pull & push)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  db, 
  initializeAllData, 
  syncPendingData, 
  syncQueue, 
  processSyncQueue, 
  isDevToolsOffline,
  checkRealInternet,
  clearStuckSyncItems,
  isOnline,
  getNetworkStatus,
  pullScreenTimeFromServer,
  pullAuditLogsFromServer,
  pullAlertsFromServer,
  pullVerificationFromServer,
  pullSupervisorReportsFromServer
} from './services/database';
import { useScreenTime } from './hooks/useScreenTime';
import { getToday, formatTime, exportCSV, exportJSON, fakeSyncApi, convertTo12Hour } from './utils/helpers';
import { uid } from './utils/helpers';
import './App.css';

// Import components
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import Sidebar from './components/common/Sidebar';
import Header from './components/common/Header';
import LoadingScreen from './components/common/LoadingScreen';
import OfflineIndicator from './components/common/OfflineIndicator';
import SyncStatus from './components/common/SyncStatus';
import CitizenRegistration from './components/register/CitizenRegistration';
import ReportForm from './components/reports/ReportForm';
import ReportList from './components/reports/ReportList';
import AttendanceManagement from './components/attendance/AttendanceManagement';
import ManagerAttendance from './components/attendance/ManagerAttendance';
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
import NetworkStatus from './components/common/NetworkStatus';

// ===== LANGUAGE IMPORTS =====
import { UserLanguageProvider } from './components/context/UserLanguageContext';

// ===== VERIFICATION IMPORTS =====
import VerificationPopup from './components/verification/VerificationPopup';
import VerificationPage from './components/verification/VerificationPage';
import { useVerification } from './hooks/useVerification';

// ===== OFFLINE QUEUE PROCESSOR (kept for reference) =====
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

// ===== APP CONTENT COMPONENT =====
function AppContent() {
  // ===== STATE =====
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [attendance, setAttendance] = useState([]);
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
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  const [trustFilter, setTrustFilter] = useState('all');
  const [taskFilter, setTaskFilter] = useState('all');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showSupervisorReportModal, setShowSupervisorReportModal] = useState(false);
  const [showSupervisorSelfReportModal, setShowSupervisorSelfReportModal] = useState(false);
  const [showPermissionRequestModal, setShowPermissionRequestModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedAttendanceOfficer, setSelectedAttendanceOfficer] = useState(null);
  const [attendanceForm, setAttendanceForm] = useState({
    status: 'present',
    checkIn: '',
    checkOut: '',
    notes: ''
  });

  // ===== VERIFICATION SYSTEM =====
  const isOfficer = user?.role === 'field_officer';
  const { 
    showPopup, 
    verificationScore, 
    verificationHistory,
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

  const { screenTimeDisplay, isScreenTimeRunning, startScreenTime, stopScreenTime } = useScreenTime(user);

  // ===== ROLE CHECKS =====
  const isManager = user?.role === 'manager';
  const isSupervisor = user?.role === 'supervisor';

  // ============================================================
  // RESTORE SESSION ON APP LOAD (persistent login)
  // ============================================================
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const session = await db.auth.get('session');
        if (session && session.userId) {
          const allUsers = await db.users.toArray();
          const foundUser = allUsers.find(u => u.id === session.userId);
          if (foundUser) {
            setUser(foundUser);
            console.log('🔐 Session restored for', foundUser.name);
          } else {
            await db.auth.clear();
          }
        }
      } catch (error) {
        console.error('Error restoring session:', error);
      }
    };
    restoreSession();
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
        await fetch('http://localhost:5000/api/audit', {
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
        window.db = db;

        const [
          usersData, reportsData, attendanceData, citizensData, auditData,
          supervisorReportsData, screenTimeData, tasksData, leavesData,
          alertsData, liveStatusData, notificationsData, permissionsData
        ] = await Promise.all([
          db.users.toArray(),
          db.reports.toArray(),
          db.attendance.toArray(),
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
          const response = await fetch('http://localhost:5000/api/users');
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
                    pin: serverUser.role === 'field_officer' ? '1234' : null
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

        setUsers(finalUsers);
        setReports(reportsData);
        setAttendance(attendanceData);
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

        await clearStuckSyncItems(); // Keep – not clearing auth
        // db.auth.clear() removed – session persists

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
  // PULL SCREEN TIME FOR MANAGERS/SUPERVISORS
  // ============================================================
  useEffect(() => {
    if (!user) return;
    const isManagerOrSupervisor = user.role === 'manager' || user.role === 'supervisor';
    if (!isManagerOrSupervisor) return;

    const pullData = async () => {
      await pullScreenTimeFromServer();
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
  // PULL ALERTS FOR MANAGER
  // ============================================================
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'manager') return;

    const pullAlerts = async () => {
      await pullAlertsFromServer();
      const updated = await db.alerts.toArray();
      setAlerts(updated);
    };

    if (isOnline) pullAlerts();

    const handleOnline = () => {
      if (navigator.onLine) pullAlerts();
    };
    window.addEventListener('online', handleOnline);

    const handleForceSync = () => {
      if (navigator.onLine) pullAlerts();
    };
    window.addEventListener('force-sync', handleForceSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('force-sync', handleForceSync);
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
  // PULL SUPERVISOR REPORTS FOR MANAGER/SUPERVISOR
  // ============================================================
  useEffect(() => {
    if (!user) return;
    if (user.role !== 'manager' && user.role !== 'supervisor') return;

    const pullReports = async () => {
      await pullSupervisorReportsFromServer();
      const updated = await db.supervisor_reports.toArray();
      setSupervisorReports(updated);
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
        updatedReports, updatedCitizens, updatedAttendance, 
        updatedTasks, updatedLeaves, updatedPermissions, 
        updatedSupervisorReports
      ] = await Promise.all([
        db.reports.toArray(),
        db.citizens.toArray(),
        db.attendance.toArray(),
        db.tasks.toArray(),
        db.leaves.toArray(),
        db.permissions.toArray(),
        db.supervisor_reports.toArray()
      ]);
      
      setReports(updatedReports);
      setCitizens(updatedCitizens);
      setAttendance(updatedAttendance);
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
  // NETWORK STATUS MONITORING
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
          setTimeout(() => runSync(), 1000);
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
  }, [reports, runSync, isOnline]);

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
      return reports.filter(r => teamIds.includes(r.employeeId) || r.employeeId === user.employeeId);
    }
    return reports;
  }, [reports, isOfficer, isSupervisor, user, teamMembers]);

  const filteredAttendance = useMemo(() => {
    if (isOfficer && user) {
      return attendance.filter(a => a.employeeId === user.employeeId);
    }
    if (isSupervisor && user) {
      const teamIds = teamMembers.map(m => m.employeeId);
      return attendance.filter(a => teamIds.includes(a.employeeId));
    }
    return attendance;
  }, [attendance, isOfficer, isSupervisor, user, teamMembers]);

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
          attendanceRate: 0,
          totalWorkHours: 0,
          lateDays: 0,
          absentDays: 0,
          trustScore: 0,
          productivityScore: 0,
          tasksCompleted: 0,
          tasksInProgress: 0
        };
      }
      map[r.employeeId].totalReports += 1;
    });

    attendance.forEach(a => {
      if (map[a.employeeId]) {
        const totalAtt = attendance.filter(att => att.employeeId === a.employeeId).length;
        const presentAtt = attendance.filter(att => att.employeeId === a.employeeId && att.status === 'present').length;
        map[a.employeeId].attendanceRate = totalAtt > 0 ? (presentAtt / totalAtt) * 100 : 0;
        map[a.employeeId].totalWorkHours += a.workHours || 0;
        if (a.status === 'late') map[a.employeeId].lateDays += 1;
        if (a.status === 'absent') map[a.employeeId].absentDays += 1;
      }
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
  }, [reports, attendance, screenTime, liveStatus, citizens]);

  const totalReports = reports.length;
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

  const attendanceSummary = useMemo(() => {
    const today = getToday();
    const todayAttendance = attendance.filter(a => a.date === today);
    const total = todayAttendance.length;
    const present = todayAttendance.filter(a => a.status === 'present').length;
    const late = todayAttendance.filter(a => a.status === 'late').length;
    const absent = todayAttendance.filter(a => a.status === 'absent').length;
    const halfDay = todayAttendance.filter(a => a.status === 'half_day').length;
    const pending = todayAttendance.filter(a => a.status === 'pending').length;
    return { total, present, late, absent, halfDay, pending, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
  }, [attendance]);

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
    if (!isSupervisor || !user) return reports;
    const teamIds = teamMembers.map(m => m.employeeId);
    return reports.filter(r => teamIds.includes(r.employeeId) || r.employeeId === user.employeeId);
  };

  const getSupervisorLeaves = () => {
    if (!isSupervisor || !user) return leaves;
    return leaves.filter(l => l.employeeId === user.employeeId);
  };

  const getSupervisorPermissions = () => {
    if (!isSupervisor || !user) return permissions;
    return permissions.filter(p => p.employeeId === user.employeeId);
  };

  const getSupervisorAttendance = () => {
    if (!isSupervisor || !user) return attendance;
    const teamIds = teamMembers.map(m => m.employeeId);
    return attendance.filter(a => teamIds.includes(a.employeeId));
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
  // AUTHENTICATION
  // ============================================================
  const handleLogin = async (email, password) => {
    const foundUser = users.find(u => u.email === email && u.password === password && u.status === 'active');
    if (foundUser) {
      setUser(foundUser);
      await db.auth.put({ id: 'session', userId: foundUser.id });
      setLoginError('');
      addNotification(foundUser.id, '👋 Welcome Back!', `Welcome back ${foundUser.name}!`, 'success');
      addAuditLog('LOGIN', { email: foundUser.email, name: foundUser.name });
      return true;
    }
    setLoginError('Invalid email or password');
    return false;
  };

  const handleLogout = async () => {
    if (isScreenTimeRunning) {
      await stopScreenTime();
    }
    if (user) {
      addNotification(user.id, 'Goodbye', 'You have been logged out successfully', 'info');
      addAuditLog('LOGOUT', { email: user.email, name: user.name });
    }
    setUser(null);
    await db.auth.clear();
    // Removed: window.location.reload();
  };

  // ============================================================
  // USER MANAGEMENT
  // ============================================================
  const handleCreateUser = async (e) => {
    e.preventDefault();
    const userExists = users.some(u => u.email === newUser.email);
    if (userExists) {
      alert('User with this email already exists!');
      return;
    }

    const newUserObj = {
      id: uid(),
      employeeId: newUser.role === 'supervisor'
        ? `SUP${String(users.filter(u => u.role === 'supervisor').length + 1).padStart(3, '0')}`
        : `FO${String(users.filter(u => u.role === 'field_officer').length + 1).padStart(3, '0')}`,
      name: newUser.name,
      email: newUser.email,
      password: newUser.password,
      phone: newUser.phone,
      role: newUser.role,
      region: newUser.region,
      supervisorId: newUser.role === 'field_officer' ? newUser.supervisorId : null,
      assignedSites: newUser.role === 'field_officer' ? newUser.assignedSites.split(',').map(s => s.trim()).filter(s => s) : [],
      status: 'active',
      managerId: 'm1',
      shift: newUser.shift,
      department: newUser.department || '',
      gpsEnabled: true,
      pin: newUser.role === 'field_officer' ? '1234' : null
    };

    setUsers(prev => { const updated = [...prev, newUserObj]; db.users.bulkPut(updated); return updated; });
    addNotification(newUserObj.id, 'Account Created', `Welcome ${newUserObj.name}! Your account has been created.`, 'success');
    addAuditLog('CREATE_USER', { email: newUserObj.email, role: newUserObj.role, name: newUserObj.name });
    const manager = users.find(u => u.role === 'manager');
    if (manager) {
      addNotification(manager.id, 'New User Created', `${newUserObj.name} (${newUserObj.role}) has been created`, 'info');
    }
    alert(`✅ User ${newUserObj.name} created successfully!`);
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
  };

  const toggleUserStatus = async (userId) => {
    setUsers(prev => {
      const updated = prev.map(u => u.id === userId ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' } : u);
      db.users.bulkPut(updated);
      return updated;
    });
    const userObj = users.find(u => u.id === userId);
    if (userObj) {
      addNotification(userObj.id, 'Account Status Updated', `Your account has been ${userObj.status === 'active' ? 'deactivated' : 'activated'}`, 'warning');
    }
    addAuditLog('TOGGLE_USER_STATUS', { userId, newStatus: userObj?.status === 'active' ? 'inactive' : 'active' });
  };

  const deleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      const userObj = users.find(u => u.id === userId);
      setUsers(prev => { const updated = prev.filter(u => u.id !== userId); db.users.bulkPut(updated); return updated; });
      if (userObj) addNotification(userObj.id, 'Account Deleted', 'Your account has been deleted', 'error');
      addAuditLog('DELETE_USER', { userId, name: userObj?.name });
      alert(`User ${userObj?.name} deleted`);
    }
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
        const response = await fetch('http://localhost:5000/api/tasks', {
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
          const response = await fetch('http://localhost:5000/api/leaves', {
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
          const response = await fetch('http://localhost:5000/api/permissions', {
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
  // ATTENDANCE MANAGEMENT (handled by AttendanceManagement component)
  // ============================================================
  const handleOpenAttendanceModal = (officer) => {
    setSelectedAttendanceOfficer(officer);
    const today = getToday();
    const existing = attendance.find(a => a.employeeId === officer.employeeId && a.date === today);
    setAttendanceForm({
      status: existing?.status || 'present',
      checkIn: existing?.checkIn || '08:00',
      checkOut: existing?.checkOut || '17:00',
      notes: existing?.notes || ''
    });
    setShowAttendanceModal(true);
  };

  const handleSubmitAttendance = async () => {
    // Handled inside AttendanceManagement component
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
      nationalId: `NID-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
        const response = await fetch('http://localhost:5000/api/citizens', {
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

    if (!form.siteName.trim()) {
      alert('Site name is required');
      return;
    }
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
      siteName: form.siteName.trim(),
      employeeId: user.employeeId,
      employeeName: user.name,
      supervisorId: user.supervisorId || '',
      registrations: Number(form.registrations) || 0,
      registrationEfficiency: Math.round((Number(form.registrations) / 100) * 100),
      operationalStatus: form.operationalStatus,
      attendance: form.attendance,
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
        const response = await fetch('http://localhost:5000/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReport)
        });
        if (response.ok) {
          await db.reports.update(newReport.id, { synced: true });
          setReports(prev => prev.map(r => r.id === newReport.id ? { ...r, synced: true } : r));
        } else {
          throw new Error('API failed');
        }
      } catch (err) {
        syncQueue.add({ type: 'report', id: newReport.id, data: newReport });
        console.log('📡 Report queued for sync');
      }
    } else {
      syncQueue.add({ type: 'report', id: newReport.id, data: newReport });
      alert('📋 Report saved offline! It will sync when you\'re back online.');
    }

    if (isOfficer && user) {
      const supervisor = users.find(u => u.id === user.supervisorId);
      if (supervisor) {
        addNotification(supervisor.id, '📋 Report Submitted', `${user.name} submitted report for ${form.siteName}`, 'success');
      }
      const manager = users.find(u => u.role === 'manager');
      if (manager) {
        addNotification(manager.id, '📋 Report Submitted', `${user.name} submitted report for ${form.siteName}`, 'info');
      }
    } else if (isSupervisor && user) {
      const manager = users.find(u => u.role === 'manager');
      if (manager) {
        addNotification(manager.id, '📋 Report Submitted', `${user.name} submitted report for ${form.siteName}`, 'info');
      }
    }
    addAuditLog('SUBMIT_REPORT', { site: form.siteName, registrations: form.registrations });

    const today = getToday();
    const existingAttendance = attendance.find(a => a.employeeId === user.employeeId && a.date === today);
    if (existingAttendance) {
      setAttendance(prev => {
        const updated = prev.map(a => a.employeeId === user.employeeId && a.date === today ? { ...a, status: form.attendance, workHours: Number(form.workHours) } : a);
        db.attendance.bulkPut(updated);
        return updated;
      });
    } else {
      const newAttendance = {
        id: uid(),
        employeeId: user.employeeId,
        employeeName: user.name,
        date: today,
        status: form.attendance,
        checkIn: '08:00',
        checkOut: `${8 + Number(form.workHours)}:00`,
        workHours: Number(form.workHours),
        region: form.region || user.region,
        supervisorId: user.supervisorId || '',
        notes: '',
        approved: true,
        updatedBy: user.employeeId,
        overtime: 0,
        submittedToManager: false
      };
      setAttendance(prev => { const updated = [...prev, newAttendance]; db.attendance.bulkPut(updated); return updated; });
    }

    setForm({
      reportDate: getToday(),
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

    // Save locally
    setSupervisorReports(prev => { const updated = [newReport, ...prev]; db.supervisor_reports.bulkPut(updated); return updated; });

    setReports(prev => {
      const updated = prev.map(r => r.employeeId === officer.employeeId ? { ...r, reviewed: true, reviewedBy: user.name, reviewDate: new Date().toISOString() } : r);
      db.reports.bulkPut(updated);
      return updated;
    });

    // Push to server
    if (online) {
      try {
        // CORRECT URL: supervisor-reports (hyphen)
        const response = await fetch('http://localhost:5000/api/supervisor-reports', {
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

    // Save locally
    setSupervisorReports(prev => { const updated = [newReport, ...prev]; db.supervisor_reports.bulkPut(updated); return updated; });

    // Push to server
    if (online) {
      try {
        // CORRECT URL: supervisor-reports (hyphen)
        const response = await fetch('http://localhost:5000/api/supervisor-reports', {
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
  const renderAttendanceModal = () => { /* implemented in AttendanceManagement */ };
  const renderScreenTimeTable = () => { /* implemented in ScreenTimeManagement */ };

  // ============================================================
  // LOGIN PAGE
  // ============================================================
  // Show loading only if no user and still loading
  if (!user) {
    if (isLoading) {
      return <LoadingScreen />;
    }
    return <Login onLogin={handleLogin} loginError={loginError} isOnline={isOnline} />;
  }

  // If user exists, show app immediately – no loading screen
  // (isLoading may still be true but we ignore it)

  // ============================================================
  // MAIN APP RETURN
  // ============================================================
  return (
    <>
      {isOfficer && showPopup && (
        <VerificationPopup
          officerId={user?.id}
          officerName={user?.name}
          onAnswer={handleAnswer}
          onClose={handleClose}
        />
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
          attendance={attendance}
          verificationScore={verificationScore}
          onLogout={handleLogout}
        />
        <div className="main-content">
          <Header 
            user={user}
            isOnline={isOnline}
            syncing={syncing}
            pendingSync={pendingSync}
            screenTimeDisplay={screenTimeDisplay}
            isScreenTimeRunning={isScreenTimeRunning}
            activeTab={activeTab}
            notifications={appNotifications}
            setNotifications={setAppNotifications}
            markNotificationRead={markNotificationRead}
            markAllNotificationsRead={markAllNotificationsRead}
          />
          <div className="content">
            {/* Dashboard */}
            {activeTab === 'dashboard' && (
              <Dashboard 
                isManager={isManager}
                isSupervisor={isSupervisor}
                isOfficer={isOfficer}
                user={user}
                reports={reports}
                users={users}
                attendance={attendance}
                screenTime={screenTime}
                leaves={leaves}
                permissions={permissions}
                citizens={citizens}
                totalReports={totalReports}
                totalRegistrations={totalRegistrations}
                attendanceSummary={attendanceSummary}
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
            
            {/* Register - Officer only */}
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
            
            {/* Reports - Officer or Supervisor */}
            {activeTab === 'reports' && (isOfficer || isSupervisor) && (
              <ReportList 
                reports={isSupervisor ? getSupervisorReports() : filteredReports}
                filteredReports={filteredReports}
                isOfficer={isOfficer}
                isSupervisor={isSupervisor}
                user={user}
                selectedRegion={selectedRegion}
                setSelectedRegion={setSelectedRegion}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                dateRange={dateRange}
                setDateRange={setDateRange}
                exportCSV={exportCSVWithNotification}
              />
            )}
            
            {/* Report New - Officer only */}
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
            
            {/* Attendance - Supervisor or Officer */}
            {activeTab === 'attendance' && (isSupervisor || isOfficer) && (
              <AttendanceManagement 
                filteredAttendance={isSupervisor ? getSupervisorAttendance() : filteredAttendance}
                attendance={attendance}
                setAttendance={setAttendance}
                users={users}
                user={user}
                isSupervisor={isSupervisor}
                isOfficer={isOfficer}
                teamMembers={teamMembers}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                attendanceFilter={attendanceFilter}
                setAttendanceFilter={setAttendanceFilter}
                attendanceSummary={attendanceSummary}
                handleOpenAttendanceModal={handleOpenAttendanceModal}
                renderAttendanceModal={renderAttendanceModal}
                addNotification={addNotification}
              />
            )}
            
            {/* Manager Attendance - Manager only */}
            {activeTab === 'manager_attendance' && isManager && (
              <ManagerAttendance 
                attendance={attendance}
                users={users}
                setAttendance={setAttendance}
                addNotification={addNotification}
              />
            )}
            
            {/* Tasks - All roles */}
            {activeTab === 'tasks' && (isManager || isSupervisor || isOfficer) && (
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
            
            {/* LEAVES - All roles */}
            {activeTab === 'leaves' && (isManager || isSupervisor || isOfficer) && (
              <LeaveManagement 
                filteredLeaves={isSupervisor ? getSupervisorLeaves() : filteredLeaves}
                leaves={leaves}
                setLeaves={setLeaves}
                users={users}
                user={user}
                isManager={isManager}
                isSupervisor={isSupervisor}
                isOfficer={isOfficer}
                teamMembers={teamMembers}
                addNotification={addNotification}
                renderLeaves={renderLeaves}
                renderLeaveModal={renderLeaveModal}
              />
            )}
            
            {/* PERMISSIONS - All roles */}
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
            
            {/* Screen Time - Supervisor or Manager ONLY */}
            {(activeTab === 'screentime' && (isSupervisor || isManager)) && (
              <ScreenTimeManagement 
                screenTime={screenTime}
                setScreenTime={setScreenTime}
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
            
            {/* Supervisor Reports - Supervisor only */}
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
            
            {/* Team - Manager or Supervisor */}
            {activeTab === 'team' && (isManager || isSupervisor) && (
              <TeamManagement 
                users={users}
                user={user}
                isManager={isManager}
                isSupervisor={isSupervisor}
                teamMembers={teamMembers}
                reports={reports}
                attendance={attendance}
                screenTime={screenTime}
                liveStatus={liveStatus}
                employeePerformance={employeePerformance}
                selectedOfficer={selectedOfficer}
                setSelectedOfficer={setSelectedOfficer}
                citizens={citizens}
              />
            )}
            
            {/* Users - Manager only */}
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
              />
            )}
            
            {/* Analytics - Manager only */}
            {activeTab === 'analytics' && isManager && (
              <Analytics 
                reports={reports}
                users={users}
                attendance={attendance}
                screenTime={screenTime}
                liveStatus={liveStatus}
                citizens={citizens}        // <-- THIS LINE ADDED
                totalReports={totalReports}
                totalRegistrations={totalRegistrations}
                regionStats={regionStats}
                employeePerformance={employeePerformance}
                renderBarChart={renderBarChart}
              />
            )}
            
            {/* Citizens - Manager only */}
            {activeTab === 'citizens' && isManager && (
              <CitizensDatabase 
                citizens={citizens}
              />
            )}
            
            {/* Audit - Manager only */}
            {activeTab === 'audit' && isManager && (
              <AuditLog 
                auditLog={auditLog}
                setAuditLog={setAuditLog}
              />
            )}
            
            {/* All Reports - Manager only */}
            {activeTab === 'all_reports' && isManager && (
              <AllReports 
                reports={reports}
                filteredReports={filteredReports}
                users={users}
                supervisorReports={supervisorReports}
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
            
            {/* Alerts - Manager only */}
            {activeTab === 'alerts' && isManager && (
              <AlertManagement 
                alerts={alerts}
                setAlerts={setAlerts}
                users={users}
                user={user}
                newAlert={newAlert}
                setNewAlert={setNewAlert}
                addNotification={addNotification}
                showAlertModal={showAlertModal}
                setShowAlertModal={setShowAlertModal}
                renderAlerts={renderAlerts}
                renderAlertModal={renderAlertModal}
              />
            )}
            
            {/* VERIFICATION - All Roles */}
            {activeTab === 'verification' && (
              <VerificationPage 
                users={users}
                liveStatus={liveStatus}
                verificationHistory={verificationHistory}
                reports={reports}
                citizens={citizens}
                attendance={attendance}
                verificationScore={verificationScore}
              />
            )}
            
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