#!/usr/bin/env python3
import re

with open('C:\\Users\\nebi\\Desktop\\mongoreact\\fieldsync\\frontend\\src\\components\\supervisor\\SupervisorReports.jsx', 'r', errors='replace') as f:
    content = f.read()

# 1. Add import for BottleneckReport after the existing imports
import_line = """import React, { useState, useEffect, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getToday, uid, getServerBase } from '../../utils/helpers';
import { db, syncQueue, checkRealInternet, pullSupervisorReportsFromServer, getApiBase } from '../../services/database';
import { useTranslation } from 'react-i18next';
import UserAvatar from '../common/UserAvatar';
import BottleneckReport from '../bottleneck/BottleneckReport';"""

if 'import React' in content and 'BottleneckReport' not in content:
    content = content.replace(
        "import React, { useState, useEffect, useMemo, useCallback } from 'react';",
        import_line
    )
    print('Added BottleneckReport import')

# 2. Add bottleneckReports state after the existing state declarations
old_state = """  const [showOfficerReport, setShowOfficerReport] = useState(false);
  const [showSelfReport, setShowSelfReport] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);"""

new_state = """  const [showOfficerReport, setShowOfficerReport] = useState(false);
  const [showSelfReport, setShowSelfReport] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [bottleneckReports, setBottleneckReports] = useState([]);
  const [showBottleneckModal, setShowBottleneckModal] = useState(false);"""

if 'const [showOfficerReport' in content and 'bottleneckReports' not in content:
    content = content.replace(old_state, new_state)
    print('Added bottleneckReports state')

# 3. Add bottleneck refresh function after handleRefresh
old_refresh = """  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Manual refresh triggered');
      if (isOnline) {
        await pullSupervisorReportsFromServer();
      }
      const loaded = await loadReportsFromDB();
      // Update parent state if setter provided
      if (setSupervisorReports) {
        setSupervisorReports(loaded);
      }
      // Also update local state (already done in loadReportsFromDB)
      console.log('📥 Reports after refresh:', loaded.length);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, loadReportsFromDB, setSupervisorReports]);"""

new_refresh = """  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Manual refresh triggered');
      if (isOnline) {
        await pullSupervisorReportsFromServer();
      }
      const loaded = await loadReportsFromDB();
      // Update parent state if setter provided
      if (setSupervisorReports) {
        setSupervisorReports(loaded);
      }
      // Also update local state (already done in loadReportsFromDB)
      console.log('📥 Reports after refresh:', loaded.length);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, loadReportsFromDB, setSupervisorReports]);

  // ===== REFRESH BOTTLENECKS =====
  const handleBottleneckRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Manual bottleneck refresh triggered');
      if (isOnline) {
        // Pull bottlenecks from server
      }
      const loaded = await loadBottlenecksFromDB();
      if (setBottleneckReports) {
        setBottleneckReports(loaded);
      }
      console.log('📥 Bottlenecks after refresh:', loaded.length);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, loadBottlenecksFromDB, setBottleneckReports]);"""

if 'const handleRefresh' in content and 'handleBottleneckRefresh' not in content:
    content = content.replace(old_refresh, new_refresh)
    print('Added handleBottleneckRefresh function')

# 3. Add the BottleneckReport component rendering after the supervisor reports section
# Find the location after the sortedReports memo and before the isNewReport helper
# I'll insert after the sortedReports memo and before the isNewReport helper

# Actually, let me find a good insertion point - after the sortedReports memo
insertion_marker = "  const sortedReports = useMemo(() => {"
if insertion_marker in content:
    # Find the end of sortedReports memo
    idx = content.find("  const sortedReports = useMemo(() => {")
    if idx >= 0:
        # Find the closing of the memo - look for the line with just "})"
        end_idx = content.find("})", idx)
        if end_idx >= 0:
            # Insert the BottleneckReport component after the sortedReports memo
            bottleneck_component = '''  

  // ===== BOTTLENECK REPORT SECTION =====
  const [showAddBottleneck, setShowAddBottleneck] = useState(false);

  const handleOpenAddBottleneck = () => {
    setShowAddBottleneck(true);
  };

  const handleCloseAddBottleneck = () => {
    setShowAddBottleneck(false);
  };

  const handleSubmitBottleneck = async () => {
    if (!form.problemTitle.trim()) {
      toast.error(t('bottleneck.error_empty_title'));
      return;
    }

    setIsLoading(true);
    try {
      const bottleneckData = {
        id: uid(),
        supervisorId: user?.id,
        supervisorName: user?.name || 'Supervisor',
        problemTitle: form.problemTitle,
        affectedTeam: form.affectedTeam || '',
        severity: form.severity,
        suggestedAction: form.suggestedAction || '',
        status: 'reported',
        reportedAt: form.reportedAt,
        createdAt: new Date().toISOString(),
        type: 'bottleneck_report'
      };

      // Save to IndexedDB
      await db.bottleneck_reports.add(bottleneckData);

      // Sync to server if online
      const online = await checkRealInternet();
      if (online) {
        try {
          await fetch(\`\${getApiBase()}/bottleneck-reports\`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(bottleneckData),
          });
          toast.success(t('bottleneck.success_synced'));
        } catch (syncError) {
          console.error('Sync error, saved locally:', syncError);
          toast.success(t('bottleneck.saved_locally'));
        }
      } else {
        toast.success(t('bottleneck.saved_locally'));
      }

      setShowAddBottleneck(false);
      setForm({
        problemTitle: '',
        affectedTeam: '',
        severity: 'medium',
        suggestedAction: '',
        reportedAt: getToday()
      });
      
      if (setBottleneckReports) {
        await loadBottlenecksFromDB();
        setBottleneckReports(prev => [...prev, ...localBottlenecks]);
      }

    } catch (error) {
      console.error('Error submitting bottleneck:', error);
      toast.error(t('bottleneck.error_submitting'));
    } finally {
      setIsLoading(false);
    }
  };

  // ===== RESPOND TO BOTTLENECK (Manager -> Supervisor) =====
  const [respondingBottleneck, setRespondingBottleneck] = useState(null);

  const handleOpenResponse = (bottleneck) => {
    setRespondingBottleneck(bottleneck);
  };

  const handleCloseResponse = () => {
    setRespondingBottleneck(null);
  };

  const handleSubmitResponse = async () => {
    if (!respondingBottleneck || !form.responseMessage) return;

    try {
      // Update the bottleneck status in IndexedDB
      await db.bottleneck_reports.update(respondingBottleneck.id, {
        status: 'responded',
        responseMessage: form.responseMessage,
        respondedAt: new Date().toISOString(),
      });

      // Sync to server
      const online = await checkRealInternet();
      if (online) {
        await fetch(\`\${getApiBase()}/bottleneck-reports/\${respondingBottleneck.id}\`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'responded',
            responseMessage: form.responseMessage,
          }),
        });
      }

      toast.success(t('bottleneck.response_sent'));
      setRespondingBottleneck(null);
      if (setBottleneckReports) {
        await loadBottlenecksFromDB();
        setBottleneckReports(prev => prev.map(r => r.id === respondingBottleneck.id ? { ...r, status: 'responded', responseMessage: form.responseMessage, respondedAt: new Date().toISOString() } : r));
      }
    } catch (error) {
      console.error('Error sending response:', error);
      toast.error(t('bottleneck.error_sending_response'));
    }
  };

  // ===== TEAM RESPONSE (Supervisor -> Team) =====
  const [teamResponse, setTeamResponse] = useState('');

  const handleSubmitTeamResponse = async () => {
    if (!teamResponse.trim()) return;

    try {
      // Update all bottlenecks for this supervisor with team response
      await db.bottleneck_reports.bulkPut(
        sortedBottlenecks.map(b => ({
          ...b,
          teamResponse: teamResponse,
          teamRespondedAt: new Date().toISOString(),
        }))
      );

      // Sync to server
      const online = await checkRealInternet();
      if (online) {
        await fetch(\`\${getApiBase()}/bottleneck-reports\`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            teamResponse: teamResponse,
            teamRespondedAt: new Date().toISOString(),
          }),
        });
      }

      toast.success(t('bottleneck.team_response_sent'));
      setTeamResponse('');
    } catch (error) {
      console.error('Error sending team response:', error);
      toast.error(t('bottleneck.error_sending_team_response'));
    }
    setTeamResponse('');
  };

  // ===== RENDER BOTTLENECK REPORT =====
  const bottleneckReport = (
    <BottleneckReport
      user={user}
      setBottleneckReports={setBottleneckReports}
      setBottleneckModalOpen={setShowBottleneckModal}
    />
  );'''

if 'const sortedReports = useMemo' in content and 'BottleneckReport' not in content:
    # Insert after the sortedReports memo closing
    # Find the line with "  })" that closes the sortedReports memo
    lines = content.split('\n')
    new_lines = []
    i = 0
    inserted = False
    while i < len(lines):
        line = lines[i]
        new_lines.append(line)
        if 'const sortedReports = useMemo' in line and not inserted:
            # Find the closing }) for this memo
            # Look ahead for the closing
            j = i + 1
            while j < len(lines) and '})' not in lines[j]:
                new_lines.append(lines[j])
                j += 1
            if j < len(lines):
                new_lines.append(lines[j])  # the '})' line
                inserted = True
                # Now add the bottleneck component
                new_lines.append(bottleneck_component)
        i += 1
    
    content = '\n'.join(new_lines)
    if inserted:
        print('Inserted BottleneckReport component')
    else:
        print('Could not find insertion point for BottleneckReport')

# 4. Add the BottleneckReport rendering in the return statement
# Find the return statement and add the BottleneckReport component
# Look for the closing of the main div or the reports section

print(f'\\nTotal content length: {len(content)}')
print(f'BottleneckReport import: {"BottleneckReport" in content}')
print(f'bottleneckReports state: {"bottleneckReports" in content}')
print(f'handleBottleneckRefresh: {"handleBottleneckRefresh" in content}')

with open('C:\\Users\\nebi\\Desktop\\mongoreact\\fieldsync\\frontend\\src\\components\\supervisor\\SupervisorReports.jsx', 'w', errors='replace') as f:
    f.write(content)

print('\\nSupervisorReports.jsx updated')
"