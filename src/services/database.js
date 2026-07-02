import Dexie from 'dexie';
import { SAMPLE_USERS } from '../utils/constants';
import { uid, getToday } from '../utils/helpers';

// Create Dexie database
const db = new Dexie('FieldSyncDB');

db.version(1).stores({
  users: 'id, employeeId, email, role, region, status',
  reports: 'id, reportId, employeeId, region, reportDate, synced',
  attendance: 'id, employeeId, date, status, region',
  citizens: 'id, nationalId, firstName, lastName, region, phone',
  audit: 'id, userId, action, timestamp',
  supervisor_reports: 'id, supervisorId, officerId, reportDate',
  screen_time: 'id, employeeId, date, trustScore',
  notifications: 'id, userId, read, timestamp',
  status: 'id, employeeId, status, lastActive',
  tasks: 'id, employeeId, status, deadline, priority',
  leaves: 'id, employeeId, status, startDate, endDate',
  alerts: 'id, targetEmployeeId, targetAll, read, timestamp',
  auth: 'id',
  permissions: 'id, employeeId, status, startDate, endDate'
});

export { db };

export const initializeAllData = async () => {
  try {
    const userCount = await db.users.count();
    if (userCount > 0) {
      console.log('✅ Data already exists, skipping initialization');
      return;
    }

    console.log('📦 Initializing data...');
    const today = getToday();

    await db.users.bulkAdd(SAMPLE_USERS);

    const fieldOfficers = SAMPLE_USERS.filter(u => u.role === 'field_officer');
    
    const attendance = fieldOfficers.map(o => ({
      id: uid(),
      employeeId: o.employeeId,
      employeeName: o.name,
      date: today,
      status: 'present',
      checkIn: '08:00',
      checkOut: '17:00',
      workHours: 8,
      region: o.region,
      supervisorId: o.supervisorId,
      notes: '',
      approved: true,
      updatedBy: 'system',
      overtime: 0,
      submittedToManager: true
    }));
    await db.attendance.bulkAdd(attendance);

    const officers = SAMPLE_USERS.filter(u => u.role === 'field_officer' || u.role === 'supervisor');
    const status = officers.map(o => ({
      id: uid(),
      userId: o.id,
      employeeId: o.employeeId,
      employeeName: o.name,
      status: 'online',
      lastActive: new Date().toISOString(),
      currentTask: '',
      productivityScore: Math.floor(70 + Math.random() * 30),
      tasksCompleted: Math.floor(Math.random() * 5),
      tasksInProgress: Math.floor(Math.random() * 3),
      efficiency: Math.floor(65 + Math.random() * 35)
    }));
    await db.status.bulkAdd(status);

    const screenTime = fieldOfficers.map(o => ({
      id: uid(),
      employeeId: o.employeeId,
      employeeName: o.name,
      date: today,
      loginTime: '08:00',
      logoutTime: '17:00',
      activeHours: 8,
      idleTime: 0,
      screenTime: 8,
      trustScore: Math.floor(70 + Math.random() * 30),
      supervisorId: o.supervisorId,
      verified: true,
      notes: '',
      verifiedBy: 'system',
      screenTimeLimit: 8,
      screenTimeWarnings: 0,
      screenTimeExceeded: false,
      isLoggedIn: false,
      sessionStart: null,
      sessionEnd: null,
      totalScreenTime: 28800
    }));
    await db.screen_time.bulkAdd(screenTime);

    const notifications = SAMPLE_USERS.map(u => ({
      id: uid(),
      userId: u.id,
      title: '👋 Welcome!',
      message: `Welcome to FieldSync ${u.name}!`,
      type: 'success',
      read: false,
      timestamp: new Date().toISOString(),
      link: '/dashboard'
    }));
    await db.notifications.bulkAdd(notifications);

    const leaves = [
      { id: uid(), employeeId: 'FO001', employeeName: 'መሠረት አለሙ', startDate: '2024-02-15', endDate: '2024-02-17', reason: 'Family event', type: 'annual', status: 'pending', createdAt: new Date().toISOString(), approvedBy: null, approvedAt: null },
      { id: uid(), employeeId: 'FO004', employeeName: 'መለስ ዘነበ', startDate: '2024-02-20', endDate: '2024-02-22', reason: 'Sick', type: 'sick', status: 'pending', createdAt: new Date().toISOString(), approvedBy: null, approvedAt: null }
    ];
    await db.leaves.bulkAdd(leaves);

    const reports = [
      { id: uid(), reportId: 'RPT-001', reportDate: today, region: 'North', siteName: 'Site A', employeeId: 'FO001', employeeName: 'መሠረት አለሙ', supervisorId: 's1', registrations: 15, registrationEfficiency: 75, operationalStatus: 'Active', attendance: 'present', workHours: 8, issues: 'None', comments: 'Good progress', challenges: 'Weather', activities: 'Registration', equipmentStatus: 'operational', materialsUsed: 'Forms', teamMembers: 'Team A', weatherConditions: 'Sunny', communityFeedback: 'Positive', submittedAt: new Date().toISOString(), synced: true, syncAttempts: 0, syncError: null, reviewed: true, reviewedBy: 'System' },
      { id: uid(), reportId: 'RPT-002', reportDate: today, region: 'South', siteName: 'Site B', employeeId: 'FO004', employeeName: 'መለስ ዘነበ', supervisorId: 's2', registrations: 10, registrationEfficiency: 50, operationalStatus: 'Active', attendance: 'present', workHours: 7, issues: 'None', comments: 'Good', challenges: 'None', activities: 'Registration', equipmentStatus: 'operational', materialsUsed: 'Forms', teamMembers: 'Team B', weatherConditions: 'Cloudy', communityFeedback: 'Good', submittedAt: new Date().toISOString(), synced: true, syncAttempts: 0, syncError: null, reviewed: true, reviewedBy: 'System' },
      { id: uid(), reportId: 'RPT-003', reportDate: today, region: 'East', siteName: 'Site C', employeeId: 'FO007', employeeName: 'ፍቅሬ ገብረእግዚአብሔር', supervisorId: 's3', registrations: 8, registrationEfficiency: 40, operationalStatus: 'Active', attendance: 'present', workHours: 6, issues: 'None', comments: 'Good', challenges: 'None', activities: 'Registration', equipmentStatus: 'operational', materialsUsed: 'Forms', teamMembers: 'Team C', weatherConditions: 'Sunny', communityFeedback: 'Good', submittedAt: new Date().toISOString(), synced: true, syncAttempts: 0, syncError: null, reviewed: true, reviewedBy: 'System' }
    ];
    await db.reports.bulkAdd(reports);

    const citizens = [
      { id: uid(), nationalId: 'NID-001', firstName: 'አበበ', lastName: 'ከበደ', dateOfBirth: '1990-01-01', gender: 'Male', phone: '+251-911-000001', email: 'abebe@test.com', address: 'Addis Ababa', region: 'North', district: 'District 1', village: 'Village 1', occupation: 'Teacher', maritalStatus: 'Married', registrationDate: new Date().toISOString(), registeredBy: 'FO001', registeredByName: 'መሠረት አለሙ', idType: 'National ID', idNumber: 'NID-001', biometrics: false, status: 'active' },
      { id: uid(), nationalId: 'NID-002', firstName: 'ሣህለ', lastName: 'ወርቅ', dateOfBirth: '1985-06-15', gender: 'Female', phone: '+251-911-000002', email: 'sahle@test.com', address: 'Addis Ababa', region: 'South', district: 'District 2', village: 'Village 2', occupation: 'Nurse', maritalStatus: 'Single', registrationDate: new Date().toISOString(), registeredBy: 'FO004', registeredByName: 'መለስ ዘነበ', idType: 'National ID', idNumber: 'NID-002', biometrics: false, status: 'active' },
      { id: uid(), nationalId: 'NID-003', firstName: 'ኪዳን', lastName: 'ተሰማ', dateOfBirth: '1992-03-20', gender: 'Male', phone: '+251-911-000003', email: 'kidan@test.com', address: 'Addis Ababa', region: 'East', district: 'District 3', village: 'Village 3', occupation: 'Engineer', maritalStatus: 'Single', registrationDate: new Date().toISOString(), registeredBy: 'FO007', registeredByName: 'ፍቅሬ ገብረእግዚአብሔር', idType: 'National ID', idNumber: 'NID-003', biometrics: false, status: 'active' }
    ];
    await db.citizens.bulkAdd(citizens);

    const supervisorReports = [{
      id: uid(),
      supervisorId: 's1',
      supervisorName: 'ብርሃን ገብረእግዚአብሔር',
      officerId: 'o1',
      officerName: 'መሠረት አለሙ',
      officerRegion: 'North',
      reportDate: today,
      performance: 'good',
      attendance: 'good',
      quality: 'good',
      punctuality: 'good',
      teamwork: 'good',
      communication: 'good',
      comments: 'Good performance',
      recommendations: 'Keep it up',
      overallRating: 4,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      region: 'North',
      type: 'officer_report'
    }];
    await db.supervisor_reports.bulkAdd(supervisorReports);

    const audit = [
      { id: uid(), userId: 'MGR001', userName: 'አበበ በቀለ', action: 'LOGIN', details: 'User logged in', timestamp: new Date().toISOString(), ip: '127.0.0.1' },
      { id: uid(), userId: 'FO001', userName: 'መሠረት አለሙ', action: 'SUBMIT_REPORT', details: 'Report submitted for Site A', timestamp: new Date().toISOString(), ip: '127.0.0.1' }
    ];
    await db.audit.bulkAdd(audit);

    const alerts = [{
      id: uid(),
      title: 'Emergency Meeting',
      message: 'All officers must attend emergency meeting at 2pm today',
      priority: 'high',
      type: 'emergency',
      timestamp: new Date().toISOString(),
      read: false,
      targetAll: true,
      targetEmployeeId: null,
      sentBy: 'MGR001',
      sentByName: 'አበበ በቀለ'
    }];
    await db.alerts.bulkAdd(alerts);

    const permissions = [{
      id: uid(),
      employeeId: 'FO001',
      employeeName: 'መሠረት አለሙ',
      permissionType: 'Work Permission',
      startDate: '2024-02-25',
      endDate: '2024-02-25',
      reason: 'Medical appointment',
      status: 'pending',
      requestedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null
    }];
    await db.permissions.bulkAdd(permissions);

    console.log('✅ Data initialization complete!');
  } catch (error) {
    console.error('Error initializing data:', error);
  }
};