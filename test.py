#!/usr/bin/env python3
import subprocess
result = subprocess.run([
    'python', '-c', 
    'with open(r"C:\\Users\\nebi\\Desktop\\mongoreact\\fieldsync\\backend\\src\\models\\supervisorReport.model.ts", "r", errors="replace") as f:'
), cwd='C:\\Users\\nebi\\Desktop\\mongoreact\\fieldsync'
]
print(result)