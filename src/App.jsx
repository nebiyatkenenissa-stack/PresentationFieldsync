import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db, initializeAllData } from './services/database';
import { useScreenTime } from './hooks/useScreenTime';
import { getToday, formatTime, exportCSV, exportJSON, fakeSyncApi } from './utils/helpers';
import { uid } from './utils/helpers';
import './App.css';

// Import components
import Login from './components/auth/Login';
import Dashboard from './components/dashboard/Dashboard';
import Sidebar from './components/common/Sidebar';
import Header from './components/common/Header';
import LoadingScreen from './components/common/LoadingScreen';
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

function App() {
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
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

  const { screenTimeDisplay, isScreenTimeRunning, stopScreenTime } = useScreenTime(user);

  // ===== ROLE CHECKS =====
  const isManager = user?.role === 'manager';
  const isSupervisor = user?.role === 'supervisor';
  const isOfficer = user?.role === 'field_officer';

  // ============================================================
  // AUDIT LOG FUNCTIONS
  // ============================================================
  const addAuditLog = async (action, details) => {
    const log = {
      id: uid(),
      userId: user?.employeeId || 'system',
      userName: user?.name || 'System',
      action,
      details: typeof details === 'object' ? JSON.stringify(details) : details,
      timestamp: new Date().toISOString(),
      ip: '127.0.0.1'
    };
    setAuditLog(prev => {
      const updated = [log, ...prev];
      db.audit.bulkPut(updated);
      return updated;
    });
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
  // DATA LOADING - DISABLE AUTO-LOGIN
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

        setUsers(usersData);
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

        // ===== DISABLE AUTO-LOGIN =====
        // Clear any existing session to force login
        await db.auth.clear();
        
        // The auto-login is now disabled - user must login manually
        
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllData();
  }, []);

  // ============================================================
  // AUTO-SYNC
  // ============================================================
  const runSync = useCallback(async () => {
    if (!isOnline || syncing) return;
    const pending = reports.filter(r => !r.synced);
    if (pending.length === 0) return;

    setSyncing(true);
    let updated = [...reports];
    const logEntries = [];

    for (const report of pending) {
      try {
        const result = await fakeSyncApi(report);
        const idx = updated.findIndex(r => r.id === report.id);
        if (idx !== -1) {
          updated[idx] = { ...result, synced: true, syncAttempts: (report.syncAttempts || 0) + 1 };
          updated[idx] = { ...updated[idx], reviewed: true, reviewedBy: 'System Auto-Review', reviewDate: new Date().toISOString() };
        }
        logEntries.push(`✅ ${report.employeeName} - ${report.siteName} synced`);
        if (user) addNotification(user.id, 'Sync Complete', `Report from ${report.siteName} synced successfully`, 'success');
        addAuditLog('SYNC_COMPLETE', { reportId: report.reportId, site: report.siteName });
      } catch (err) {
        const idx = updated.findIndex(r => r.id === report.id);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], syncAttempts: (updated[idx].syncAttempts || 0) + 1, syncError: err.message };
        }
        logEntries.push(`❌ ${report.employeeName} - ${report.siteName} failed: ${err.message}`);
        if (user) addNotification(user.id, 'Sync Failed', `Report from ${report.siteName} failed to sync`, 'error');
      }
    }

    setReports(updated);
    await db.reports.bulkPut(updated);
    setSyncLog(prev => [...logEntries, ...prev].slice(0, 20));
    setSyncing(false);
  }, [reports, isOnline, syncing, user, addNotification, addAuditLog]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setTimeout(() => {
        if (reports.some(r => !r.synced)) runSync();
      }, 2000);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [reports, runSync]);

  useEffect(() => {
    let intervalId = null;
    if (isOnline) {
      intervalId = setInterval(() => {
        if (reports.some(r => !r.synced) && !syncing) runSync();
      }, 30000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isOnline, reports, syncing, runSync]);

  // ============================================================
  // COMPUTED VALUES - ORDER MATTERS!
  // ============================================================
  
  // 1. First define teamMembers
  const teamMembers = useMemo(() => {
    if (isSupervisor && user) {
      return users.filter(u => u.supervisorId === user.id);
    }
    return [];
  }, [users, user, isSupervisor]);

  // 2. Then define filtered values that use teamMembers
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
      // Supervisor sees ONLY their OWN leaves (not team)
      return leaves.filter(l => l.employeeId === user.employeeId);
    }
    return leaves;
  }, [leaves, isOfficer, isSupervisor, user]);

  const filteredPermissions = useMemo(() => {
    if (isOfficer && user) {
      return permissions.filter(p => p.employeeId === user.employeeId);
    }
    if (isSupervisor && user) {
      // Supervisor sees ONLY their OWN permissions (not team)
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

  // 3. Then computed values
  const employeePerformance = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      if (!map[r.employeeId]) {
        map[r.employeeId] = {
          employeeId: r.employeeId,
          employeeName: r.employeeName,
          region: r.region,
          totalReports: 0,
          // FIX: Use ACTUAL registered citizens count from citizens array
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
        map[s.employeeId].trustScore = s.trustScore || 0;
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
  const totalRegistrations = citizens.length; // FIX: Use actual citizen count
  const totalCitizens = citizens.length;
  const pendingSync = reports.filter(r => !r.synced).length;

  const regionStats = useMemo(() => {
    const map = {};
    reports.forEach(r => {
      if (!map[r.region]) map[r.region] = { reports: 0, registrations: 0, employees: new Set() };
      map[r.region].reports += 1;
      // FIX: Use actual registered citizens by region
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
  // SUPERVISOR FILTERS - DIRECT FILTERING IN RENDER FUNCTIONS
  // ============================================================
  
  // REPORTS: Supervisor sees Team + Self only
  const getSupervisorReports = () => {
    if (!isSupervisor || !user) return reports;
    const teamIds = teamMembers.map(m => m.employeeId);
    return reports.filter(r => teamIds.includes(r.employeeId) || r.employeeId === user.employeeId);
  };

  // LEAVES: Supervisor sees ONLY own leaves
  const getSupervisorLeaves = () => {
    if (!isSupervisor || !user) return leaves;
    return leaves.filter(l => l.employeeId === user.employeeId);
  };

  // PERMISSIONS: Supervisor sees ONLY own permissions
  const getSupervisorPermissions = () => {
    if (!isSupervisor || !user) return permissions;
    return permissions.filter(p => p.employeeId === user.employeeId);
  };

  // ATTENDANCE: Supervisor sees Team only
  const getSupervisorAttendance = () => {
    if (!isSupervisor || !user) return attendance;
    const teamIds = teamMembers.map(m => m.employeeId);
    return attendance.filter(a => teamIds.includes(a.employeeId));
  };

  // SCREEN TIME: Supervisor sees Team only
  const getSupervisorScreenTime = () => {
    if (!isSupervisor || !user) return screenTime;
    const teamIds = teamMembers.map(m => m.employeeId);
    return screenTime.filter(s => teamIds.includes(s.employeeId));
  };

  // TASKS: Supervisor sees Team tasks
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
    if (isScreenTimeRunning) await stopScreenTime();
    if (user) addNotification(user.id, 'Goodbye', 'You have been logged out successfully', 'info');
    if (user) addAuditLog('LOGOUT', { email: user.email, name: user.name });
    setUser(null);
    await db.auth.clear();
    window.location.reload();
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
      department: newUser.department || ''
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
      completedAt: null
    };

    setTasks(prev => { const updated = [...prev, task]; db.tasks.bulkPut(updated); return updated; });
    const assignedUser = users.find(u => u.employeeId === task.employeeId);
    if (assignedUser) {
      addNotification(assignedUser.id, 'New Task Assigned', `Task "${task.title}" has been assigned to you`, 'info');
    }
    addAuditLog('CREATE_TASK', { task: task.title, assignedTo: task.employeeId });
    const manager = users.find(u => u.role === 'manager');
    if (manager) {
      addNotification(manager.id, '📋 Task Assigned', `Task "${task.title}" assigned to ${assignedUser?.name}`, 'info');
    }
    setLiveStatus(prev => {
      const updated = prev.map(l => l.employeeId === task.employeeId ? { ...l, tasksInProgress: (l.tasksInProgress || 0) + 1 } : l);
      db.status.bulkPut(updated);
      return updated;
    });
    setShowTaskModal(false);
    alert('✅ Task assigned successfully!');
  };

  const updateTaskStatus = async (taskId, status) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, status, completedAt: status === 'completed' ? new Date().toISOString() : t.completedAt } : t);
      db.tasks.bulkPut(updated);
      return updated;
    });
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
  // LEAVE MANAGEMENT - Supervisor sees ONLY own, Manager sees all but NO Request button
  // ============================================================
  const handleRequestLeave = async (e) => {
    e.preventDefault();
    if (!newLeave.startDate || !newLeave.endDate || !newLeave.reason) {
      alert('Please fill all required fields');
      return;
    }

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
      approvedAt: null
    };

    try {
      await db.leaves.add(leave);
      setLeaves(prev => [leave, ...prev]);
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

      const updatedLeave = {
        ...leave,
        status: approve ? 'approved' : 'rejected',
        approvedBy: user.employeeId,
        approvedAt: new Date().toISOString()
      };

      await db.leaves.update(leaveId, updatedLeave);
      setLeaves(prev => prev.map(l => l.id === leaveId ? updatedLeave : l));
      const officer = users.find(u => u.employeeId === leave.employeeId);
      if (officer) {
        addNotification(officer.id, 'Leave Request Update', `Your leave request has been ${approve ? 'approved ✅' : 'rejected ❌'}`, approve ? 'success' : 'error');
      }
      addAuditLog('APPROVE_LEAVE', { leaveId, status: approve ? 'approved' : 'rejected' });
      alert(`✅ Leave ${approve ? 'approved' : 'rejected'} successfully!`);
    } catch (error) {
      console.error('Error updating leave:', error);
      alert('❌ Error updating leave');
    }
  };

  // ============================================================
  // PERMISSION MANAGEMENT - Supervisor sees ONLY own, Manager sees all but NO Request button
  // ============================================================
  const handleRequestPermission = async (e) => {
    e.preventDefault();
    if (!permissionRequest.permissionType || !permissionRequest.startDate || !permissionRequest.endDate || !permissionRequest.reason) {
      alert('Please fill all required fields');
      return;
    }

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
      approvedAt: null
    };

    try {
      await db.permissions.add(permission);
      setPermissions(prev => [permission, ...prev]);
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

      const updatedPermission = {
        ...permission,
        status: approve ? 'approved' : 'rejected',
        approvedBy: user.employeeId,
        approvedAt: new Date().toISOString()
      };

      await db.permissions.update(permissionId, updatedPermission);
      setPermissions(prev => prev.map(p => p.id === permissionId ? updatedPermission : p));
      const officer = users.find(u => u.employeeId === permission.employeeId);
      if (officer) {
        addNotification(officer.id, 'Permission Request Update', `Your permission request has been ${approve ? 'approved ✅' : 'rejected ❌'}`, approve ? 'success' : 'error');
      }
      addAuditLog('APPROVE_PERMISSION', { permissionId, status: approve ? 'approved' : 'rejected' });
      alert(`✅ Permission ${approve ? 'approved' : 'rejected'} successfully!`);
    } catch (error) {
      console.error('Error updating permission:', error);
      alert('❌ Error updating permission');
    }
  };

  // ============================================================
  // ALERT MANAGEMENT
  // ============================================================
  const handleSendAlert = async (e) => {
    e.preventDefault();
    if (!newAlert.title || !newAlert.message) {
      alert('Please fill all required fields');
      return;
    }

    const newAlertObj = {
      id: uid(),
      title: newAlert.title,
      message: newAlert.message,
      priority: newAlert.priority,
      type: 'emergency',
      timestamp: new Date().toISOString(),
      read: false,
      targetAll: newAlert.targetAll,
      targetEmployeeId: newAlert.targetAll ? null : newAlert.targetEmployeeId,
      sentBy: user.employeeId,
      sentByName: user.name
    };

    try {
      await db.alerts.add(newAlertObj);
      setAlerts(prev => [newAlertObj, ...prev]);
      if (newAlert.targetAll) {
        users.filter(u => u.role === 'field_officer' || u.role === 'supervisor').forEach(o => {
          addNotification(o.id, `🚨 ${newAlertObj.title}`, newAlertObj.message, 'error');
        });
        const manager = users.find(u => u.role === 'manager');
        if (manager && manager.id !== user.id) {
          addNotification(manager.id, `🚨 ${newAlertObj.title}`, newAlertObj.message, 'error');
        }
      } else if (newAlert.targetEmployeeId) {
        const targetUser = users.find(u => u.employeeId === newAlert.targetEmployeeId);
        if (targetUser) {
          addNotification(targetUser.id, `🚨 ${newAlertObj.title}`, newAlertObj.message, 'error');
        }
        const manager = users.find(u => u.role === 'manager');
        if (manager && manager.id !== user.id) {
          addNotification(manager.id, `🚨 ${newAlertObj.title}`, `Alert sent to ${targetUser?.name}`, 'error');
        }
      }
      addAuditLog('SEND_ALERT', { title: newAlertObj.title, priority: newAlertObj.priority });
      setShowAlertModal(false);
      setNewAlert({
        title: '',
        message: '',
        priority: 'medium',
        targetAll: true,
        targetEmployeeId: ''
      });
      alert('🚨 Alert sent successfully!');
    } catch (error) {
      console.error('Error sending alert:', error);
      alert('❌ Error sending alert');
    }
  };

  const markAlertRead = async (alertId) => {
    setAlerts(prev => {
      const updated = prev.map(a => a.id === alertId ? { ...a, read: true } : a);
      db.alerts.bulkPut(updated);
      return updated;
    });
  };

  // ============================================================
  // ATTENDANCE MANAGEMENT
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
    if (!selectedAttendanceOfficer) return;
    const today = getToday();

    let workHours = 0;
    if (attendanceForm.checkIn && attendanceForm.checkOut) {
      const checkIn = attendanceForm.checkIn.split(':');
      const checkOut = attendanceForm.checkOut.split(':');
      const inHours = parseInt(checkIn[0]);
      const inMins = parseInt(checkIn[1]);
      const outHours = parseInt(checkOut[0]);
      const outMins = parseInt(checkOut[1]);
      workHours = (outHours - inHours) + (outMins - inMins) / 60;
      if (workHours < 0) workHours += 24;
    }

    try {
      const existingRecord = attendance.find(
        a => a.employeeId === selectedAttendanceOfficer.employeeId && a.date === today
      );

      const attendanceData = {
        status: attendanceForm.status,
        checkIn: attendanceForm.checkIn,
        checkOut: attendanceForm.checkOut,
        workHours: Math.round(workHours * 10) / 10,
        notes: attendanceForm.notes || '',
        approved: true,
        updatedBy: user.employeeId,
        submittedToManager: true
      };

      if (existingRecord) {
        await db.attendance.update(existingRecord.id, attendanceData);
        setAttendance(prev => prev.map(a => a.id === existingRecord.id ? { ...a, ...attendanceData } : a));
      } else {
        const newRecord = {
          id: uid(),
          employeeId: selectedAttendanceOfficer.employeeId,
          employeeName: selectedAttendanceOfficer.name,
          date: today,
          region: selectedAttendanceOfficer.region,
          supervisorId: user.id,
          ...attendanceData,
          createdAt: new Date().toISOString()
        };
        await db.attendance.add(newRecord);
        setAttendance(prev => [newRecord, ...prev]);
      }

      const manager = users.find(u => u.role === 'manager');
      if (manager) {
        addNotification(manager.id, '📋 Attendance Submitted', `Attendance for ${selectedAttendanceOfficer.name} has been submitted by ${user.name}`, 'info');
      }
      addNotification(selectedAttendanceOfficer.id, '📋 Attendance Updated', `Your attendance has been marked by ${user.name}`, 'info');
      addAuditLog('SUBMIT_ATTENDANCE', { officer: selectedAttendanceOfficer.name });
      setShowAttendanceModal(false);
      setSelectedAttendanceOfficer(null);
      alert('✅ Attendance submitted to manager successfully!');
    } catch (error) {
      console.error('Error submitting attendance:', error);
      alert('❌ Error submitting attendance');
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
      status: 'active'
    };

    setCitizens(prev => { const updated = [newCitizen, ...prev]; db.citizens.bulkPut(updated); return updated; });
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
      synced: isOnline ? true : false,
      syncAttempts: 0,
      syncError: null,
      reviewed: false,
      reviewedBy: null
    };

    setReports(prev => { const updated = [newReport, ...prev]; db.reports.bulkPut(updated); return updated; });

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

    alert(isOnline ? '📋 Report submitted and synced successfully!' : '📋 Report submitted offline! It will sync when internet is back.');
  };

  // ============================================================
  // SUPERVISOR REPORTS
  // ============================================================
  const handleSupervisorReportSubmit = async (e) => {
    e.preventDefault();
    const officer = users.find(u => u.id === supervisorReportForm.officerId);
    if (!officer) {
      alert('Please select an officer');
      return;
    }

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
      type: 'officer_report'
    };

    setSupervisorReports(prev => { const updated = [newReport, ...prev]; db.supervisor_reports.bulkPut(updated); return updated; });

    setReports(prev => {
      const updated = prev.map(r => r.employeeId === officer.employeeId ? { ...r, reviewed: true, reviewedBy: user.name, reviewDate: new Date().toISOString() } : r);
      db.reports.bulkPut(updated);
      return updated;
    });

    const manager = users.find(u => u.role === 'manager');
    if (manager) {
      addNotification(manager.id, '📋 Supervisor Report', `${user.name} submitted a report about ${officer.name}`, 'info');
    }
    addNotification(officer.id, '📋 Supervisor Report', `${user.name} submitted a report about you`, 'info');
    addAuditLog('SUPERVISOR_REPORT', { officer: officer.name, rating: supervisorReportForm.overallRating });
    setShowSupervisorReportModal(false);
    alert('✅ Supervisor report submitted successfully!');
  };

  const handleSupervisorSelfReportSubmit = async (e) => {
    e.preventDefault();
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
      type: 'self_report'
    };

    setSupervisorReports(prev => { const updated = [newReport, ...prev]; db.supervisor_reports.bulkPut(updated); return updated; });

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
  // RENDER FUNCTIONS
  // ============================================================
  const renderBarChart = () => {
    if (regionStats.length === 0) return <div className="chart-empty">No data available</div>;
    const maxValue = Math.max(...regionStats.map(r => r.registrations)) || 1;
    return (
      <div className="css-chart">
        {regionStats.map((region, index) => (
          <div key={region.region} className="css-chart-bar-wrapper">
            <div className="css-chart-label">{region.region}</div>
            <div className="css-chart-bar-container">
              <div className="css-chart-bar" style={{ width: `${(region.registrations / maxValue) * 100}%`, background: ['#1e3a5f', '#2b4c7a', '#4a7a9c', '#6b9ec4', '#2d6a4f', '#1a3a5f'][index % 6] }}>
                <span className="css-chart-value">{region.registrations}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTrendChart = () => {
    const today = new Date();
    const dates = [];
    const registrations = [];
    let maxTrend = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      dates.push(dateStr);
      const dailyTotal = reports.filter(r => r.reportDate === dateStr).reduce((sum, r) => sum + (r.registrations || 0), 0);
      registrations.push(dailyTotal);
      if (dailyTotal > maxTrend) maxTrend = dailyTotal;
    }
    if (maxTrend === 0) maxTrend = 1;
    return (
      <div className="css-trend-chart">
        <div className="css-trend-labels">
          {dates.map((date, i) => <div key={i} className="css-trend-label">{date}</div>)}
        </div>
        <div className="css-trend-bars">
          {registrations.map((value, i) => (
            <div key={i} className="css-trend-bar-wrapper">
              <div className="css-trend-bar" style={{ height: `${(value / maxTrend) * 100}%`, background: value > 0 ? '#1e3a5f' : '#E5E7EB' }}>
                <span className="css-trend-value">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderScreenTimeTable = () => {
    const dateOptions = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dateOptions.push(d.toISOString().slice(0, 10));
    }
    const displayScreenTime = isSupervisor ? getSupervisorScreenTime() : filteredScreenTime;
    
    return (
      <div className="screentime-management">
        <div className="attendance-controls">
          <div className="attendance-filters">
            <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="filter-select">
              {dateOptions.map(date => <option key={date} value={date}>{date}</option>)}
            </select>
            <select value={trustFilter} onChange={e => setTrustFilter(e.target.value)} className="filter-select">
              <option value="all">All Trust Scores</option>
              <option value="high">High (80-100)</option>
              <option value="medium">Medium (60-79)</option>
              <option value="low">Low (Below 60)</option>
            </select>
          </div>
          <span className="attendance-count">{displayScreenTime.length} records</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Employee</th><th>Date</th><th>Login</th><th>Logout</th><th>Total Time</th><th>Limit</th><th>Status</th><th>Trust Score</th>{isManager && <th>Action</th>}</tr></thead>
            <tbody>
              {displayScreenTime.length === 0 && (
                <tr><td colSpan={isManager ? "9" : "8"} className="empty-state"><div className="empty-icon">📱</div><div>No screen time records found</div></td></tr>
              )}
              {displayScreenTime.map(s => {
                const totalSecs = s.totalScreenTime || 0;
                const formattedTime = formatTime(totalSecs);
                return (
                  <tr key={s.id}>
                    <td><strong>{s.employeeName}</strong></td>
                    <td>{s.date}</td>
                    <td>{s.loginTime || '--'}</td>
                    <td>{s.logoutTime || '--'}</td>
                    <td><span className={`screen-time ${s.screenTime > s.screenTimeLimit ? 'exceeded' : 'normal'}`}>{formattedTime}</span></td>
                    <td>{s.screenTimeLimit || 8}h</td>
                    <td>{s.isLoggedIn ? <span className="status-badge online">🟢 Active</span> : s.logoutTime ? <span className="status-badge offline">🔴 Offline</span> : <span className="status-badge away">⚪ Not Started</span>}</td>
                    <td><span className={`trust-score ${s.trustScore >= 80 ? 'high' : s.trustScore >= 60 ? 'medium' : 'low'}`}>{s.trustScore}%</span></td>
                    {isManager && (
                      <td>
                        <button className="btn-sm btn-approve" onClick={() => {
                          const newLimit = window.prompt('Enter new screen time limit (hours):', s.screenTimeLimit || 8);
                          if (newLimit !== null) {
                            const limit = parseInt(newLimit);
                            if (limit >= 4 && limit <= 12) {
                              setScreenTime(prev => {
                                const updated = prev.map(item => item.id === s.id ? { ...item, screenTimeLimit: limit, verified: true, verifiedBy: user.employeeId } : item);
                                db.screen_time.bulkPut(updated);
                                return updated;
                              });
                              addNotification(s.employeeId, '📱 Screen Time Limit Updated', `Your screen time limit has been updated to ${limit}h`, 'info');
                              addAuditLog('SET_SCREEN_TIME_LIMIT', { employee: s.employeeId, limit });
                              alert('✅ Screen time limit updated!');
                            } else {
                              alert('Please enter a value between 4 and 12 hours');
                            }
                          }
                        }}>Set Limit</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isOfficer && (
          <div className="screen-time-controls" style={{padding: '16px 20px', borderTop: '1px solid #e5e7eb'}}>
            <h4>⏱️ Work Time Tracker</h4>
            <div style={{display: 'flex', gap: '16px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap'}}>
              {(() => {
                const today = getToday();
                const todayScreen = screenTime.find(s => s.employeeId === user.employeeId && s.date === today);
                const isActive = todayScreen?.isLoggedIn || isScreenTimeRunning;
                return (
                  <>
                    <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                      {!isActive ? (
                        <button className="btn-primary" onClick={() => {}} style={{padding: '10px 24px', fontSize: '16px'}}>🟢 Start Work</button>
                      ) : (
                        <button className="btn-primary btn-danger" onClick={stopScreenTime} style={{padding: '10px 24px', fontSize: '16px'}}>🔴 End Work</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 30px', background: isActive ? '#d1fae5' : '#f1f5f9', borderRadius: '12px', border: isActive ? '3px solid #0b7e4b' : '2px solid #e5e7eb', minWidth: '180px', justifyContent: 'center' }}>
                      <span style={{ fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace', color: isActive ? '#065f37' : '#1a202c' }}>
                        {isActive ? screenTimeDisplay : '00:00:00'}
                      </span>
                      {isActive && <span style={{marginLeft: '12px', color: '#0b7e4b', fontSize: '14px', fontWeight: '600'}}>🔴 LIVE</span>}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderNotificationBell = () => {
    return (
      <div className="notification-container">
        <button className="notification-btn" onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}>
          🔔
          {unreadNotifications.length > 0 && <span className="notification-badge">{unreadNotifications.length}</span>}
        </button>
        {showNotificationDropdown && (
          <div className="notification-dropdown">
            <div className="notification-dropdown-header">
              <span>Notifications ({unreadNotifications.length} unread)</span>
              {unreadNotifications.length > 0 && <button className="mark-all-read" onClick={markAllNotificationsRead}>Mark all read</button>}
            </div>
            <div className="notification-dropdown-body">
              {getUserNotifications.length === 0 && <div className="notification-empty">No notifications</div>}
              {getUserNotifications.slice(0, 15).map(n => (
                <div key={n.id} className={`notification-item ${n.type} ${!n.read ? 'unread' : ''}`} onClick={() => markNotificationRead(n.id)}>
                  <div className="notification-message">{n.title}</div>
                  <div className="notification-detail">{n.message}</div>
                  <div className="notification-time">{new Date(n.timestamp).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // RENDER TASKS
  // ============================================================
  const renderTasks = () => {
    const displayTasks = isSupervisor ? getSupervisorTasks() : filteredTasks;
    
    return (
      <div className="tasks-management">
        <div className="tasks-header">
          <div className="tasks-filters">
            <select value={taskFilter} onChange={e => setTaskFilter(e.target.value)} className="filter-select">
              <option value="all">All Tasks</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          {(isManager || isSupervisor) && <button className="btn-primary" onClick={() => setShowTaskModal(true)}>➕ Assign Task</button>}
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Task</th><th>Assigned To</th><th>Region</th><th>Deadline</th><th>Priority</th><th>Status</th>{(isManager || isSupervisor) && <th>Action</th>}</tr></thead>
            <tbody>
              {displayTasks.length === 0 && (
                <tr><td colSpan={(isManager || isSupervisor) ? "7" : "6"} className="empty-state"><div className="empty-icon">📋</div><div>No tasks found</div></td></tr>
              )}
              {displayTasks.map(t => {
                const assignedUser = users.find(u => u.employeeId === t.employeeId);
                return (
                  <tr key={t.id}>
                    <td><strong>{t.title}</strong><div className="task-description">{t.description}</div></td>
                    <td>{assignedUser?.name || t.employeeId}</td>
                    <td>{assignedUser?.region || 'N/A'}</td>
                    <td>{t.deadline}</td>
                    <td><span className={`priority-tag ${t.priority}`}>{t.priority}</span></td>
                    <td><span className={`task-status ${t.status}`}>{t.status.replace('_', ' ')}</span></td>
                    {(isManager || isSupervisor) && (
                      <td>
                        <select value={t.status} onChange={(e) => updateTaskStatus(t.id, e.target.value)} className="task-status-select">
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER LEAVES - Manager has NO Request button
  // ============================================================
  const renderLeaves = () => {
    const displayLeaves = isSupervisor 
      ? leaves.filter(l => l.employeeId === user.employeeId)
      : filteredLeaves;
    
    // Manager does NOT see Request button
    const showRequestButton = isOfficer || isSupervisor;
    
    return (
      <div className="leaves-management">
        <div className="leaves-header">
          <div><h4>Leave Requests</h4><p>{displayLeaves.length} requests</p></div>
          {showRequestButton && (
            <button className="btn-primary" onClick={() => setShowLeaveModal(true)}>📋 Request Leave</button>
          )}
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              {displayLeaves.length === 0 && (
                <tr><td colSpan="6" className="empty-state"><div className="empty-icon">📋</div><div>No leave requests found</div></td></tr>
              )}
              {displayLeaves.map(l => (
                <tr key={l.id}>
                  <td><strong>{l.employeeName}</strong></td>
                  <td>{l.type}</td>
                  <td>{l.startDate}</td>
                  <td>{l.endDate}</td>
                  <td>{l.reason}</td>
                  <td><span className={`leave-status ${l.status}`}>{l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER PERMISSIONS - Manager has NO Request button
  // ============================================================
  const renderPermissions = () => {
    const displayPermissions = isSupervisor 
      ? permissions.filter(p => p.employeeId === user.employeeId)
      : filteredPermissions;
    
    // Manager does NOT see Request button
    const showRequestButton = isOfficer || isSupervisor;
    
    return (
      <div className="permissions-management">
        <div className="permissions-header">
          <div><h4>Permission Requests</h4><p>{displayPermissions.length} requests</p></div>
          {showRequestButton && (
            <button className="btn-primary" onClick={() => setShowPermissionRequestModal(true)}>📋 Request Permission</button>
          )}
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Employee</th><th>Permission Type</th><th>Start</th><th>End</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              {displayPermissions.length === 0 && (
                <tr><td colSpan="6" className="empty-state"><div className="empty-icon">📋</div><div>No permission requests found</div></td></tr>
              )}
              {displayPermissions.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.employeeName}</strong></td>
                  <td>{p.permissionType}</td>
                  <td>{p.startDate}</td>
                  <td>{p.endDate}</td>
                  <td>{p.reason}</td>
                  <td><span className={`permission-status ${p.status}`}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ============================================================
  // RENDER ALERTS
  // ============================================================
  const renderAlerts = () => {
    return (
      <div className="alerts-management">
        <div className="alerts-header">
          <div><h4>Emergency Alerts</h4><p>{filteredAlerts.filter(a => !a.read).length} unread</p></div>
          {isManager && <button className="btn-primary btn-danger" onClick={() => setShowAlertModal(true)}>🚨 Send Alert</button>}
        </div>
        <div className="alerts-list">
          {filteredAlerts.length === 0 && (
            <div className="empty-state"><div className="empty-icon">🔔</div><div>No alerts</div></div>
          )}
          {filteredAlerts.map(a => (
            <div key={a.id} className={`alert-item ${a.priority} ${!a.read ? 'unread' : ''}`} onClick={() => markAlertRead(a.id)}>
              <div className="alert-icon">{a.priority === 'high' ? '🔴' : a.priority === 'medium' ? '🟡' : '🔵'}</div>
              <div className="alert-content">
                <div className="alert-title"><strong>{a.title}</strong></div>
                <div className="alert-message">{a.message}</div>
                <div className="alert-meta">
                  <span className="alert-sender">From: {a.sentByName}</span>
                  <span className="alert-time">{new Date(a.timestamp).toLocaleString()}</span>
                </div>
              </div>
              {!a.read && <div className="alert-unread-dot"></div>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ============================================================
  // MODALS
  // ============================================================
  const renderTaskModal = () => {
    if (!showTaskModal) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3>Assign New Task</h3><button className="modal-close" onClick={() => setShowTaskModal(false)}>✕</button></div>
          <form onSubmit={handleCreateTask} className="modal-form">
            <div className="form-group">
              <label>Assign To *</label>
              <select value={newTask.employeeId} onChange={e => setNewTask({...newTask, employeeId: e.target.value})} required>
                <option value="">Select Officer</option>
                {(isManager ? users.filter(u => u.role === 'field_officer') : teamMembers).map(u => (
                  <option key={u.id} value={u.employeeId}>{u.name} ({u.region})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Task Title *</label>
              <input type="text" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} placeholder="Enter task title" required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} placeholder="Enter task description" rows="3" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Deadline *</label>
                <input type="date" value={newTask.deadline} onChange={e => setNewTask({...newTask, deadline: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="submit" className="btn-submit">Assign Task</button>
              <button type="button" className="btn-cancel" onClick={() => setShowTaskModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderLeaveModal = () => {
    if (!showLeaveModal) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowLeaveModal(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3>Request Leave</h3><button className="modal-close" onClick={() => setShowLeaveModal(false)}>✕</button></div>
          <form onSubmit={handleRequestLeave} className="modal-form">
            <div className="form-row">
              <div className="form-group">
                <label>Start Date *</label>
                <input type="date" value={newLeave.startDate} onChange={e => setNewLeave({...newLeave, startDate: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>End Date *</label>
                <input type="date" value={newLeave.endDate} onChange={e => setNewLeave({...newLeave, endDate: e.target.value})} required />
              </div>
            </div>
            <div className="form-group">
              <label>Leave Type</label>
              <select value={newLeave.type} onChange={e => setNewLeave({...newLeave, type: e.target.value})}>
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="personal">Personal</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Reason *</label>
              <textarea value={newLeave.reason} onChange={e => setNewLeave({...newLeave, reason: e.target.value})} placeholder="Enter reason for leave" rows="3" required />
            </div>
            <div className="modal-actions">
              <button type="submit" className="btn-submit">Submit Request</button>
              <button type="button" className="btn-cancel" onClick={() => setShowLeaveModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderPermissionRequestModal = () => {
    if (!showPermissionRequestModal) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowPermissionRequestModal(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3>Request Permission</h3><button className="modal-close" onClick={() => setShowPermissionRequestModal(false)}>✕</button></div>
          <form onSubmit={handleRequestPermission} className="modal-form">
            <div className="form-group">
              <label>Permission Type *</label>
              <select value={permissionRequest.permissionType} onChange={e => setPermissionRequest({...permissionRequest, permissionType: e.target.value})} required>
                <option value="">Select Type</option>
                <option value="Work Permission">Work Permission</option>
                <option value="Personal Permission">Personal Permission</option>
                <option value="Medical Permission">Medical Permission</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Start Date *</label>
                <input type="date" value={permissionRequest.startDate} onChange={e => setPermissionRequest({...permissionRequest, startDate: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>End Date *</label>
                <input type="date" value={permissionRequest.endDate} onChange={e => setPermissionRequest({...permissionRequest, endDate: e.target.value})} required />
              </div>
            </div>
            <div className="form-group">
              <label>Reason *</label>
              <textarea value={permissionRequest.reason} onChange={e => setPermissionRequest({...permissionRequest, reason: e.target.value})} placeholder="Enter reason for permission" rows="3" required />
            </div>
            <div className="modal-actions">
              <button type="submit" className="btn-submit">Submit Request</button>
              <button type="button" className="btn-cancel" onClick={() => setShowPermissionRequestModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderAlertModal = () => {
    if (!showAlertModal) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowAlertModal(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3>🚨 Send Emergency Alert</h3><button className="modal-close" onClick={() => setShowAlertModal(false)}>✕</button></div>
          <form onSubmit={handleSendAlert} className="modal-form">
            <div className="form-group">
              <label>Alert Title *</label>
              <input type="text" value={newAlert.title} onChange={e => setNewAlert({...newAlert, title: e.target.value})} placeholder="Enter alert title" required />
            </div>
            <div className="form-group">
              <label>Message *</label>
              <textarea value={newAlert.message} onChange={e => setNewAlert({...newAlert, message: e.target.value})} placeholder="Enter alert message" rows="4" required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Priority</label>
                <select value={newAlert.priority} onChange={e => setNewAlert({...newAlert, priority: e.target.value})}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="form-group">
                <label>Target</label>
                <select value={newAlert.targetAll} onChange={e => setNewAlert({...newAlert, targetAll: e.target.value === 'true'})}>
                  <option value="true">All Officers</option>
                  <option value="false">Specific Officer</option>
                </select>
              </div>
            </div>
            {!newAlert.targetAll && (
              <div className="form-group">
                <label>Target Officer</label>
                <select value={newAlert.targetEmployeeId} onChange={e => setNewAlert({...newAlert, targetEmployeeId: e.target.value})}>
                  <option value="">Select Officer</option>
                  {users.filter(u => u.role === 'field_officer').map(u => <option key={u.id} value={u.employeeId}>{u.name} ({u.region})</option>)}
                </select>
              </div>
            )}
            <div className="modal-actions">
              <button type="submit" className="btn-submit btn-danger">🚨 Send Alert</button>
              <button type="button" className="btn-cancel" onClick={() => setShowAlertModal(false)}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderAttendanceModal = () => {
    if (!showAttendanceModal || !selectedAttendanceOfficer) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowAttendanceModal(false)}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h3>Edit Attendance - {selectedAttendanceOfficer.name}</h3><button className="modal-close" onClick={() => setShowAttendanceModal(false)}>✕</button></div>
          <div className="modal-form">
            <div className="form-group"><label>Date</label><input type="text" value={getToday()} disabled /></div>
            <div className="form-group">
              <label>Status</label>
              <select value={attendanceForm.status} onChange={e => setAttendanceForm({...attendanceForm, status: e.target.value})}>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="half_day">Half Day</option>
                <option value="absent">Absent</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Check In Time</label><input type="time" value={attendanceForm.checkIn} onChange={e => setAttendanceForm({...attendanceForm, checkIn: e.target.value})} /></div>
              <div className="form-group"><label>Check Out Time</label><input type="time" value={attendanceForm.checkOut} onChange={e => setAttendanceForm({...attendanceForm, checkOut: e.target.value})} /></div>
            </div>
            <div className="form-group"><label>Notes</label><textarea value={attendanceForm.notes} onChange={e => setAttendanceForm({...attendanceForm, notes: e.target.value})} placeholder="Additional notes..." rows="2" /></div>
            <div className="modal-actions">
              <button className="btn-submit" onClick={handleSubmitAttendance}>✅ Submit to Manager</button>
              <button className="btn-cancel" onClick={() => setShowAttendanceModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================
  // LOGIN PAGE
  // ============================================================
  if (!user) {
    return <Login onLogin={handleLogin} loginError={loginError} isOnline={isOnline} />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  // ============================================================
  // MAIN APP RETURN
  // ============================================================
  return (
    <div className="app">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
        pendingSync={pendingSync}
        isManager={isManager}
        isSupervisor={isSupervisor}
        isOfficer={isOfficer}
        onLogout={handleLogout}
      />
      <div className="main-content">
        <Header 
          user={user}
          isOnline={isOnline}
          syncing={syncing}
          pendingSync={pendingSync}
          screenTimeDisplay={screenTimeDisplay}
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
          
          {/* Reports - Officer or Supervisor (Supervisor sees Team + Self) */}
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
            />
          )}
          
          {/* Attendance - Supervisor or Officer (Supervisor sees Team only) */}
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
          
          {/* Tasks - All roles (Supervisor sees Team tasks) */}
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
          
          {/* LEAVES - Manager sees all, but NO Request button */}
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
          
          {/* PERMISSIONS - Manager sees all, but NO Request button */}
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
              filteredScreenTime={isSupervisor ? getSupervisorScreenTime() : filteredScreenTime}
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
              renderScreenTimeTable={renderScreenTimeTable}
              addNotification={addNotification}
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
              exportCSV={exportCSVWithNotification}
              exportJSON={exportJSONWithNotification}
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
  );
}

export default App;