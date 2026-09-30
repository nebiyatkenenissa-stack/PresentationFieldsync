# -*- coding: utf-8 -*-
"""Appendices content."""

COMPANY = "AFRICOM Technologies PLC"

APPENDICES = [
    ("appendix_h1", "APPENDIX A - DATABASE SCHEMA AND API SUMMARY"),
    ("p", "This appendix presents the core database schema of the FieldSync system as an entity-relationship "
          "diagram, together with a summary of the main REST API endpoints used by the application."),
    ("fig", {"file": "erd.png", "caption": "Core database schema of the FieldSync system",
             "width_in": 6.6, "label": "Figure"}),
    ("p", "Table A-1 below summarises the main API endpoints implemented in the Express backend."),
    ("table", {
        "caption": "Main REST API endpoints of the FieldSync system",
        "label": "Table",
        "headers": ["Endpoint", "Purpose"],
        "rows": [
            ["POST /api/auth/login", "Sign a user in and return their account details"],
            ["POST /api/auth/change-password", "Change the password of the current user"],
            ["GET/POST /api/users", "List and create users; also update, delete and reset passwords"],
            ["GET/POST /api/citizens", "List and create citizen registration records"],
            ["GET/POST /api/reports", "List and create daily field reports"],
            ["GET/POST /api/attendance", "List and create attendance records and check-in/out"],
            ["GET/POST /api/leaves", "List and create leave requests"],
            ["GET/POST /api/permissions", "List and create work-permission requests"],
            ["GET/POST /api/tasks", "List and create tasks assigned to officers"],
            ["GET/POST /api/alerts", "List and create alerts and notifications"],
            ["GET/POST /api/screen-time", "List and manage screen-time and trust-score records"],
            ["GET/POST /api/verification", "Records of verification questions and answers"],
            ["GET/POST /api/supervisor-reports", "Create and list supervisor evaluation reports"],
            ["GET/POST /api/audit", "Read and write the audit log of user actions"],
            ["GET /api/locations", "Ethiopian location hierarchy used in cascading selectors"],
            ["POST /api/sync", "Offline-first synchronisation endpoint for all record types"],
            ["GET /api/status", "Online/offline status of users"],
            ["GET /api/health", "Health check of the API and database connection"],
        ],
        "widths": [2.3, 4.2],
    }),
    ("p", "The synchronisation endpoint accepts a type (for example citizen, report, attendance, leave, "
          "permission, task, alert, user or screen_time) together with its data, and applies an idempotent "
          "insert-or-update operation so that the same record can be sent several times without creating "
          "duplicates."),

    ("appendix_h1", "APPENDIX B - SCREENSHOTS OF THE SYSTEM"),
    ("p", "This appendix presents screenshots of the main pages of the FieldSync system. The screenshots were "
          "taken during the development and testing of the application. Each placeholder below should be "
          "replaced by the corresponding capture when the final document is prepared with the running "
          "system."),
    ("fig", {"file": "login.png", "caption": "Login page of the FieldSync system",
             "width_in": 5.6, "label": "Figure"}),
    ("fig", {"file": "dashboard_manager.png", "caption": "Manager dashboard with analytics charts",
             "width_in": 5.6, "label": "Figure"}),
    ("fig", {"file": "registration_form.png", "caption": "Citizen registration form with GPS and photo capture",
             "width_in": 5.6, "label": "Figure"}),
    ("fig", {"file": "daily_report.png", "caption": "Daily field report form working in offline mode",
             "width_in": 5.6, "label": "Figure"}),
    ("fig", {"file": "offline_sync.png", "caption": "Offline indicator and synchronisation status",
             "width_in": 5.6, "label": "Figure"}),
    ("fig", {"file": "language_selector.png", "caption": "Four-language selector (English, Amharic, Afaan Oromoo, Tigrinya)",
             "width_in": 5.6, "label": "Figure"}),
    ("fig", {"file": "user_management.png", "caption": "User management page for managers and administrators",
             "width_in": 5.6, "label": "Figure"}),
    ("fig", {"file": "attendance.png", "caption": "Attendance and leave management",
             "width_in": 5.6, "label": "Figure"}),
    ("fig", {"file": "alerts.png", "caption": "Alert management and notifications",
             "width_in": 5.6, "label": "Figure"}),

    ("appendix_h1", "APPENDIX C - SAMPLE SOURCE CODE"),
    ("p", "This appendix contains short excerpts of the source code developed during the internship. The "
          "first excerpt shows the local database schema (Dexie / IndexedDB) that enables offline storage. "
          "The second excerpt shows the synchronisation logic that pushes pending records to the server, and "
          "the third shows how citizen registrations are saved offline with GPS coordinates."),
    ("h2", "C.1 Local Offline Database Schema (frontend/src/services/database.js)"),
    ("code", [
        "const db = new Dexie('FieldSyncDB');",
        "db.version(5).stores({",
        "  users: 'id, employeeId, email, role, region, status, pin',",
        "  reports: 'id, reportId, employeeId, region, reportDate, synced',",
        "  attendance: 'id, employeeId, date, status, region, synced',",
        "  citizens: 'id, nationalId, firstName, lastName, region, phone, synced',",
        "  audit: 'id, userId, action, timestamp',",
        "  screen_time: 'id, employeeId, date, trustScore',",
        "  tasks: 'id, employeeId, status, deadline, priority, synced',",
        "  leaves: 'id, employeeId, status, startDate, endDate, synced',",
        "  alerts: 'id, targetEmployeeId, targetAll, read, timestamp',",
        "  verification_history: 'id, officerId, timestamp, questionId, success, synced'",
        "});",
    ],),
    ("h2", "C.2 Synchronisation of Pending Records (frontend/src/services/SyncService.js)"),
    ("code", [
        "async retryPendingOperations() {",
        "  if (this.isSyncing || this.isPaused || !navigator.onLine) return;",
        "  this.isSyncing = true;",
        "  try {",
        "    const pendingOps = await db.operations",
        "      .where('status').anyOf(['pending', 'retrying']).toArray();",
        "    for (const op of pendingOps) { await this.syncOperation(op); }",
        "  } catch (error) {",
        "    console.error('Sync error:', error);",
        "  } finally { this.isSyncing = false; }",
        "}",
        "",
        "scheduleRetry(item, type) {",
        "  if (item.retryCount >= this.maxRetries) return;",
        "  const delay = this.retryDelay * Math.pow(2, item.retryCount); // backoff",
        "  setTimeout(() => this.syncOperation(item), delay);",
        "}",
    ],),
    ("h2", "C.3 Idempotent Server-Side Synchronisation (backend/sync.controller.ts)"),
    ("code", [
        "case 'citizen': {",
        "  // skip exact duplicates (first + last + grandfather name)",
        "  const dup = await pool.query(",
        "    `SELECT national_id FROM citizens",
        "     WHERE LOWER(first_name) = $1 AND LOWER(last_name) = $2",
        "       AND LOWER(COALESCE(grandfather_name,'')) = LOWER(COALESCE($3,''))`,",
        "    [data.firstName, data.lastName, data.grandfatherName]);",
        "  if (dup.rows.length > 0) return res.json({ success: true });",
        "  result = await pool.query(",
        "    `INSERT INTO citizens (national_id, first_name, last_name,",
        "        date_of_birth, gender, phone, latitude, longitude, gps_accuracy)",
        "     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        "     ON CONFLICT (national_id) DO UPDATE SET",
        "        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,",
        "        updated_at = CURRENT_TIMESTAMP RETURNING *`,",
        "    [data.nationalId, data.firstName, data.lastName, data.dateOfBirth,",
        "     data.gender, data.phone, data.latitude, data.longitude, data.gpsAccuracy]);",
        "  break;",
        "}",
    ],),
    ("p", "The complete source code of the FieldSync system, including the React front end, the Express "
          "backend and the Docker deployment files, is maintained in the project Git repository."),

    ("appendix_h1", "APPENDIX D - DAILY INTERNSHIP WORK LOG"),
    ("p", "Attached below is a summary of my daily work log during the internship. The full signed attendance "
          "sheets are kept by the company."),
    ("table", {
        "caption": "Sample of the daily internship work log",
        "label": "Table",
        "headers": ["Week", "Main activities", "Output / deliverable"],
        "rows": [
            ["Week 1", "Orientation, codebase walkthrough, environment setup", "Local FieldSync running"],
            ["Week 2", "Requirements reading, user stories, design discussions", "Requirements notes"],
            ["Week 3", "React components for login, dashboard and sidebar", "Components merged to main"],
            ["Week 4", "Citizen registration form with GPS and photo capture", "Working registration flow"],
            ["Week 5", "Offline data layer (Dexie schema) and sync service", "Offline working on device"],
            ["Week 6", "Backend routes for users, citizens, reports, attendance", "API endpoints tested"],
            ["Week 7", "Leave, permission, task and alert modules", "Modules merged to main"],
            ["Week 8", "Four-language support, dashboards and charts", "Localised UI + analytics"],
            ["Week 9", "Bug fixing, testing of sync and edge cases", "Bug fixes + regression test"],
            ["Week 10", "Docker deployment preparation and documentation", "Deployment notes"],
            ["Week 11", "Final testing, demo preparation and handover", "Final demo + report input"],
        ],
        "widths": [1.0, 3.3, 2.2],
    }),

    ("appendix_h1", "APPENDIX E - LETTER OF INTERNSHIP COMPLETION"),
    ("p", "A letter of internship completion issued by AFRICOM Technologies PLC is presented below. The "
          "official, signed letter on the company letterhead should be attached here."),
    ("placeholder_box", "Place for the signed letter of internship\ncompletion on company letterhead"),

    ("appendix_h1", "APPENDIX F - INTERNSHIP ATTENDANCE SHEET"),
    ("p", "The monthly attendance sheet signed daily by the internship mentor at AFRICOM Technologies PLC is "
          "presented below. A blank copy of the sheet is shown; the completed and signed sheets are kept "
          "with the other internship documents."),
    ("placeholder_box", "Place for the signed internship\nattendance sheet"),
]