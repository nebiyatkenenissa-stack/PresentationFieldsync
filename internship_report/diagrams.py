import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle

ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")


def _box(ax, x, y, w, h, text, fc="#ffffff", ec="#1f2937", fs=9, lw=1.4, tc="#111827", bold=False):
    p = FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.008,rounding_size=0.012",
        facecolor=fc, edgecolor=ec, linewidth=lw, zorder=3,
    )
    ax.add_patch(p)
    ax.text(
        x + w / 2, y + h / 2, text, ha="center", va="center",
        fontsize=fs, color=tc, zorder=4,
        fontweight="bold" if bold else "normal", linespacing=1.3,
    )
    return (x, y, w, h)


def _arrow(ax, p1, p2, text=None, color="#374151", lw=1.6, style="-|>"):
    ax.add_patch(
        FancyArrowPatch(
            p1, p2, arrowstyle=style, mutation_scale=14,
            color=color, lw=lw, zorder=2,
        )
    )
    if text:
        mid = ((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2)
        ax.text(mid[0], mid[1] + 0.02, text, ha="center", va="bottom",
                fontsize=7.5, color="#6b7280", zorder=5, style="italic")


def _new(w, h):
    fig, ax = plt.subplots(figsize=(w, h), dpi=150)
    fig.patch.set_facecolor("white")
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    return fig, ax


def org_chart(path):
    fig, ax = _new(9.5, 6.6)
    _box(ax, 0.38, 0.86, 0.24, 0.09, "General Manager / CEO", ec="#0f766e", bold=True, fs=10)
    for tx, ty, tw, th, txt in [
        (0.02, 0.62, 0.21, 0.10, "Software\nDevelopment"),
        (0.27, 0.62, 0.23, 0.10, "GovTech /\nE-Government"),
        (0.54, 0.62, 0.22, 0.10, "BPO &\nOutsourcing"),
        (0.80, 0.62, 0.18, 0.10, "IT Consulting &\nIT Audit"),
    ]:
        _box(ax, tx, ty, tw, th, txt, fc="#e2fff9", ec="#0f766e", fs=8.5)
        _arrow(ax, (0.5, 0.86), (tx + tw / 2, ty + th))
    for tx, ty, tw, th, txt in [
        (0.15, 0.40, 0.19, 0.10, "Networking &\nSecurity"),
        (0.38, 0.40, 0.21, 0.10, "E-commerce &\nERP Systems"),
        (0.63, 0.40, 0.22, 0.10, "E-learning /\nTraining & Tech Hub"),
    ]:
        _box(ax, tx, ty, tw, th, txt, fc="#e2fff9", ec="#0f766e", fs=8.5)
        _arrow(ax, (0.12, 0.62), (tx + tw / 2, ty + th), style="-|>")
    _box(ax, 0.30, 0.16, 0.40, 0.12, "FieldSync Project Team\n(Software Development Section)", fc="#ffe9e0", ec="#c2410c", bold=True, fs=9)
    _arrow(ax, (0.12, 0.62), (0.5, 0.28), style="-|>")
    ax.text(0.5, 0.045, "Figure 1.1", ha="center", fontsize=8, color="#9ca3af")
    plt.savefig(path, bbox_inches="tight", pad_inches=0.15)
    plt.close(fig)


def architecture(path):
    fig, ax = _new(10.5, 6.4)
    ax.text(0.5, 0.955, "FieldSync - Three-Tier System Architecture", ha="center", fontsize=12, fontweight="bold")
    _box(ax, 0.03, 0.52, 0.30, 0.34, "Client Layer (PWA - React + Vite)\n\nUI (Tailwind CSS, multi-language)\nOffline IndexedDB (Dexie)\nSync Service (queue + retries)\nGPS capture (Geolocation API)", fc="#e8f0fe", ec="#1d4ed8", fs=8)
    _box(ax, 0.37, 0.52, 0.26, 0.34, "API Layer\n\nNode.js + Express 5\nREST endpoints (/api/*)\nJWT-style session + bcrypt auth\nMulter file uploads\nNodemailer e-mail", fc="#e8f0fe", ec="#1d4ed8", fs=8)
    _box(ax, 0.68, 0.52, 0.29, 0.34, "Database Layer\n\nPostgreSQL 16\nusers, citizens, reports,\nattendance, leaves, tasks,\nalerts, audit_logs...", fc="#e8f0fe", ec="#1d4ed8", fs=8)
    _box(ax, 0.03, 0.12, 0.30, 0.22, "Offline Mode\ndata written locally\nqueued as 'pending'\nre-synced on reconnect", fc="#fef3c7", ec="#b45309", fs=8)
    _box(ax, 0.37, 0.12, 0.26, 0.22, "Sync Engine\n/api/sync (idempotent upsert)\nexponential backoff, max 5 retries\nduplicate-citizen business rule", fc="#fef3c7", ec="#b45309", fs=8)
    _box(ax, 0.68, 0.12, 0.29, 0.22, "Docker Compose Deployment\ndb + backend + frontend(nginx)\nvolumes: pgdata, uploads", fc="#fef3c7", ec="#b45309", fs=8)
    _arrow(ax, (0.33, 0.72), (0.37, 0.72), "HTTPS/JSON", lw=2)
    _arrow(ax, (0.63, 0.72), (0.68, 0.72), "SQL", lw=2)
    _arrow(ax, (0.18, 0.34), (0.06, 0.14), style="-|>")
    _arrow(ax, (0.45, 0.52), (0.34, 0.26), style="-|>")
    _arrow(ax, (0.76, 0.52), (0.99, 0.28), style="-|>")
    ax.text(0.5, 0.03, "Figure 2.1", ha="center", fontsize=8, color="#9ca3af")
    plt.savefig(path, bbox_inches="tight", pad_inches=0.15)
    plt.close(fig)


def sync_workflow(path):
    fig, ax = _new(10, 6.6)
    ax.text(0.5, 0.955, "Offline-First Synchronization Workflow", ha="center", fontsize=12, fontweight="bold")
    _box(ax, 0.03, 0.72, 0.28, 0.14, "1. Field officer creates record\n(citizen / report / attendance)", fc="#d1fae5", ec="#047857", fs=8)
    _box(ax, 0.36, 0.72, 0.28, 0.14, "2. Record saved to local\nIndexedDB with status 'pending'", fc="#d1fae5", ec="#047857", fs=8)
    _box(ax, 0.69, 0.72, 0.28, 0.14, "3. Network check\n(online event / 30s interval)", fc="#d1fae5", ec="#047857", fs=8)
    _arrow(ax, (0.31, 0.80), (0.36, 0.80))
    _arrow(ax, (0.64, 0.80), (0.69, 0.80))
    _box(ax, 0.02, 0.42, 0.30, 0.16, "Offline - queue in order\nattendance first, then operations\nstatus stays 'pending'", fc="#fef3c7", ec="#b45309", fs=8)
    _box(ax, 0.36, 0.42, 0.28, 0.16, "Online - push to /api/sync\nidempotent INSERT ...\nON CONFLICT DO UPDATE", fc="#fef3c7", ec="#b45309", fs=8)
    _box(ax, 0.69, 0.42, 0.28, 0.16, "Server validates & stores\n(photo base64, GPS, duplicate\ncitizen rule)", fc="#fef3c7", ec="#b45309", fs=8)
    _arrow(ax, (0.18, 0.72), (0.15, 0.58))
    _arrow(ax, (0.50, 0.72), (0.50, 0.58))
    _arrow(ax, (0.83, 0.72), (0.83, 0.58))
    _box(ax, 0.36, 0.10, 0.28, 0.18, "Success - mark 'synced'\nclear local record / tombstone", fc="#d1fae5", ec="#047857", fs=8)
    _box(ax, 0.02, 0.10, 0.28, 0.18, "Failure - status 'failed'\nretry with exponential backoff\n(3s, 6s, 12s ... max 5)", fc="#fee2e2", ec="#b91c1c", fs=8)
    _box(ax, 0.69, 0.10, 0.28, 0.18, "Conflict resolution - last write\nwins per field; duplicate citizen\nskipped with warning", fc="#f3e8ff", ec="#7e22ce", fs=8)
    _arrow(ax, (0.83, 0.42), (0.83, 0.28))
    _arrow(ax, (0.16, 0.42), (0.16, 0.28))
    _arrow(ax, (0.36, 0.19), (0.64, 0.19))
    _arrow(ax, (0.50, 0.42), (0.50, 0.28))
    ax.text(0.5, 0.02, "Figure 2.2", ha="center", fontsize=8, color="#9ca3af")
    plt.savefig(path, bbox_inches="tight", pad_inches=0.15)
    plt.close(fig)


def erd(path):
    fig, ax = _new(11, 7.6)
    ax.text(0.5, 0.965, "FieldSync - Core Database Schema (PostgreSQL)", ha="center", fontsize=12, fontweight="bold")
    cards = [
        (0.02, 0.80, "users", "id (PK), employee_id UQ\nname, email UQ, password_hash\nrole, shift, supervisor_id FK\nregion, phone, department\nstatus, online_status, location_path"),
        (0.27, 0.80, "citizens", "national_id (PK)\nfirst_name, last_name\ngrandfather_name, gender\ndate_of_birth, phone, email\nphoto, biometrics\nlatitude, longitude"),
        (0.52, 0.80, "reports", "report_id (PK)\nemployee_id FK, supervisor_id FK\nsite_name, registrations\nattendance, work_hours\nactivities, challenges, issues\nlatitude, longitude"),
        (0.77, 0.80, "attendance", "id (PK), employee_id FK\nemployee_name, date, status\ncheck_in, check_out, work_hours\nsupervisor_id FK"),
        (0.02, 0.44, "leaves / permissions", "id (PK), employee_id FK\nstart_date, end_date, reason\ntype, status, approved_by FK\napproved_at, synced"),
        (0.27, 0.44, "tasks", "id (PK), employee_id FK\nassigned_by FK, title, deadline\npriority, status, completed_at"),
        (0.52, 0.44, "alerts / notifications", "id (PK), title, message\npriority, type, target_all\nsent_by FK, read, timestamp"),
        (0.77, 0.44, "screen_time / verification", "id (PK), employee_id FK, date\nlogin_time, logout_time\nscreen_time_limit, trust_score\nofficer_id, score, penalties"),
    ]
    for (x, y, t, f) in cards:
        _box(ax, x, y, 0.21, 0.17, t, fc="#dbeafe", ec="#1e40af", bold=True, fs=8)
        ax.text(x + 0.105, y + 0.072, f, ha="center", va="top", fontsize=6, color="#111827", linespacing=1.4)
    _box(ax, 0.02, 0.08, 0.96, 0.26,
         "Related tables: audit_logs, gps_locations, check_ins, kiosk_sessions, supervisor_reports, notifications\n"
         "Key relations: supervisor_id -> users.id | employee_id -> users.id | report_id -> citizens via national_id\n"
         "Pattern: INSERT ... ON CONFLICT (pk) DO UPDATE (idempotent sync) | Timestamps stored in UTC",
         fc="#fafaf9", ec="#78716c", fs=7.5)
    ax.text(0.5, 0.005, "Figure A-1", ha="center", fontsize=8, color="#9ca3af")
    plt.savefig(path, bbox_inches="tight", pad_inches=0.15)
    plt.close(fig)


def screenshot_placeholder(path, title, subtitle=""):
    fig, ax = _new(9, 5.4)
    fig.patch.set_facecolor("white")
    ax.add_patch(Rectangle((0.02, 0.90), 0.96, 0.08, facecolor="#111827", edgecolor="none", zorder=2))
    ax.text(0.05, 0.94, f"  FieldSync - {title}", color="white", fontsize=9, va="center", zorder=3)
    ax.add_patch(Rectangle((0.02, 0.04), 0.96, 0.84, facecolor="#f3f4f6",
                           edgecolor="#9ca3af", linestyle="--", linewidth=1.4, zorder=2))
    ax.plot([0.05, 0.95], [0.78, 0.78], color="#d1d5db", lw=1)
    ax.text(0.5, 0.5, "[ Replace this box with the actual\nFieldSync screen capture of:\n\n" + title + " ]",
            ha="center", va="center", fontsize=11, color="#6b7280", linespacing=1.5, zorder=3)
    if subtitle:
        ax.text(0.5, 0.10, subtitle, ha="center", va="center", fontsize=8, color="#9ca3af", style="italic")
    plt.savefig(path, bbox_inches="tight", pad_inches=0.12)
    plt.close(fig)


def main():
    os.makedirs(ASSETS, exist_ok=True)
    org_chart(os.path.join(ASSETS, "org_chart.png"))
    print("org_chart.png done")
    architecture(os.path.join(ASSETS, "architecture.png"))
    print("architecture.png done")
    sync_workflow(os.path.join(ASSETS, "sync_workflow.png"))
    print("sync_workflow.png done")
    erd(os.path.join(ASSETS, "erd.png"))
    print("erd.png done")

    screens = {
        "login.png": "Login Page (role-based sign in)",
        "dashboard_manager.png": "Manager Dashboard with Analytics and Charts",
        "registration_form.png": "Citizen Registration Form with GPS and Photo Capture",
        "daily_report.png": "Daily Field Report Form (offline mode)",
        "offline_sync.png": "Offline Indicator and Sync Status",
        "language_selector.png": "Language Selector (English / Amharic / Afaan Oromoo / Tigrinya)",
        "user_management.png": "User Management (roles, shifts, regions)",
        "attendance.png": "Attendance and Leave Management",
        "alerts.png": "Alert Management and Notifications",
    }
    for fname, caption in screens.items():
        screenshot_placeholder(os.path.join(ASSETS, fname), caption)
    print("screenshot placeholders done")


if __name__ == "__main__":
    main()