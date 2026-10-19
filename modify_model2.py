#!/usr/bin/env python3
import re

with open('C:\\Users\\nebi\\Desktop\\mongoreact\\fieldsync\\backend\\src\\models\\supervisorReport.model.ts', 'r', errors='replace') as f:
    content = f.read()

# Add bottleneck type check after isSelfReport
old_line = '  const isSelfReport =    !data.officerId || data.officerId === \"null\" || data.officerId === null;'
new_line = '  const isSelfReport =    !data.officerId || data.officerId === \"null\" || data.officerId === null;\n  const isBottleneckReport = data.type === \"bottleneck_report\";'

if old_line in content:
    content = content.replace(old_line, new_line)
    print('Replaced isSelfReport line')
else:
    print('Could not find isSelfReport line')
    # Try without escaped quotes
    old_line2 = '  const isSelfReport =    !data.officerId || data.officerId === \'null\' || data.officerId === null;'
    if old_line2 in content:
        content = content.replace(old_line2, new_line)
        print('Replaced isSelfReport line (version 2)')
    else:
        print('Could not find isSelfReport line (version 2)')

# Write back
with open('C:\\Users\\nebi\\Desktop\\mongoreact\\fieldsync\\backend\\src\\models\\supervisorReport.model.ts', 'w', errors='replace') as f:
    f.write(content)

print('File written successfully')

# Verify
with open('C:\\Users\\nebi\\Desktop\\mongoreact\\fieldsync\\backend\\src\\models\\supervisorReport.model.ts', 'r', errors='replace') as f:
    content2 = f.read()

print(f\"isBottleneckReport present: {'isBottleneckReport' in content2}\")
print(f\"bottleneck_report type present: {'bottleneck_report' in content2}\")