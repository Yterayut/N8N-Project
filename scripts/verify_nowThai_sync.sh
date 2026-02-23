#!/bin/bash
# verify_nowThai_sync.sh — ตรวจว่า nowThai() ใน 5 Code nodes ยังเหมือนกันทุก copy
# Usage: ./scripts/verify_nowThai_sync.sh
set -e

DB="/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.n8n/database.sqlite"
WF_ID="up1n75qEhbsXswii"

echo "=== nowThai() sync check ==="

python3 - <<'PYEOF'
import sqlite3, json, re, sys

DB = "/home/oneclimate-uat/Project-Yterayut/N8N-AUTO-RESPONSE/.n8n-dev/.n8n/database.sqlite"
WF_ID = "up1n75qEhbsXswii"

con = sqlite3.connect(DB)
row = con.execute(
    "SELECT nodes FROM workflow_history WHERE workflowId=? ORDER BY createdAt DESC LIMIT 1",
    (WF_ID,)
).fetchone()
con.close()

if not row:
    print("ERROR: workflow not found")
    sys.exit(1)

nodes = json.loads(row[0])
target = ['Code in JavaScript9','Code in JavaScript17','Code (Parse Result)','Code in JavaScript24','Code in JavaScript26']

blocks = {}
for n in nodes:
    if n.get('name') not in target:
        continue
    code = n.get('parameters',{}).get('jsCode','')
    m = re.search(r'function nowThai\(\).*?\n\}', code, re.DOTALL)
    blocks[n['name']] = m.group(0).strip() if m else ''

if len(blocks) < 5:
    print(f"WARNING: only {len(blocks)}/5 target nodes found")

# Check all identical
unique = set(blocks.values())
if len(unique) == 1:
    print(f"OK — all {len(blocks)} nodes have identical nowThai() ✓")
    sys.exit(0)
else:
    print(f"MISMATCH — {len(unique)} different versions found!")
    for name, body in blocks.items():
        print(f"  [{name}]: {hash(body)}")
    sys.exit(1)
PYEOF
