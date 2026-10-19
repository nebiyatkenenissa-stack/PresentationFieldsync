#!/usr/bin/env python3
filepath = r'C:\Users\nebi\Desktop\mongoreact\fieldsync\frontend\src\components\audit\AuditLog.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# The list section - using regular string with escaped quotes where needed
list_section = "  {/* List */}\n" + \
"        <div className=\"activity-list\" style={{ padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '20px' }}>\n" + \
"          <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '600' }}>{t('audit.activity_records')}</h3>\n" + \
"          {(!logs || logs.length === 0) && (\n" + \
"            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>\n" + \
"              <div style={{ fontSize: '48px', marginBottom: '8px' }}>📜</div>\n" + \
"              <div>{t('audit.no_records')}</div>\n" + \
"              <div style={{ fontSize: '12px', marginTop: '4px' }}>\n" + \
"                {t('audit.click_refresh')}\n" + \
"              </div>\n" + \
"            </div>\n" + \
"          )}\n" + \
"          {logs && logs.map(log => (\n" + \
"            <div key={log.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0', borderBottom: '1px solid #e5e7eb' }}>\n" + \
"              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>\n" + \
"                <span style={{ fontSize: '13px', color: '#64748b' }}>{new Date(log.timestamp).toLocaleString()}</span>\n" + \
"                <span style={{ fontSize: '12px', color: '#9ca3af' }}>{t('audit.by', { user: log.userName })}</span>\n" + \
"              </div>\n" + \
"              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>\n" + \
"                <span className=\"status-tag\" style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '500', background: '(ACTION_COLORS[log.action] || DEFAULT_COLOR).bg', color: '(ACTION_COLORS[log.action] || DEFAULT_COLOR).color' }}">\n" + \
"                  {actionLabel(log.action)}\n" + \
                "</span>\n" + \
"              </div>\n" + \
"              <div style={{ fontSize: '13px', color: '#4a5568', marginTop: '4px', maxWidth: '320px', whiteSpace: 'pre-wrap' }}>\n" + \
"                {formatDetails(log.details)}\n" + \
              "</div>\n" + \
"              <div style={{ display: 'flex', gap: '6px' }}>\n" + \
"                <button\n" + \
"                  onClick={() => setSelectedLog(log)}\n" + \
"                  title={t('audit.view_detail')}\n" + \
"                  style={{ background: '#1e3a5f', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>\n" + \
"                  {t('audit.view')}\n" + \
                "</button>\n" + \
"                <button\n" + \
"                  onClick={() => handleDeleteLog(log)}\n" + \
"                  disabled={deletingId === log.id}\n" + \
"                  title={t('audit.delete_title')}\n" + \
"                  style={{ background: '#dc2626', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: deletingId === log.id ? 'wait' : 'pointer', fontSize: '12px', opacity: deletingId === log.id ? 0.6 : 1 }}>\n" + \
"                  {deletingId === log.id ? t('audit.deleting') : '🗑️'}\n" + \
                "</button>\n" + \
              "</div>\n" + \
            "</div>\n" + \
          ))\n" + \
        "</div>\n"

# The list section replaces lines 422-573 (1-indexed), which is indices 421-572 (0-indexed)
# Keep lines 1-421 (0-indexed: 0 to 421), i.e., lines[:422]
# Keep lines 574+ (0-indexed: 573+), i.e., lines[573:]

part1 = ''.join(lines[:422])  # lines 1-421 + line 422? need to check
part2 = ''.join(lines[573:])  # detail view section starting at line 574 (1-indexed) = index 573

new_content = part1 + list_section + part2

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Replacement done successfully')
print(f'Original had {len(lines)} lines')
new_lines = new_content.split('\n')
print(f'New content has {len(new_lines)} lines')
"