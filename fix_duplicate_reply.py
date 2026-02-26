#!/usr/bin/env python3
"""
Fix duplicate Facebook comment replies in n8n workflow
Problem: Switch node outputs 0 and 1 both connect to the same "FB Graph Reply Text" node
Solution: Add a Merge node between Switch and FB Graph Reply Text
"""

import sqlite3
import json
import sys
from datetime import datetime

DB_PATH = '/Users/teerayutyeerahem/My-project/n8n/.n8n/database.sqlite'
WORKFLOW_ID = 'Ga5bDLZW6uUaY2KI'

def backup_workflow(conn, workflow_id):
    """Backup workflow to file before making changes"""
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM workflow_entity WHERE id = ?", (workflow_id,))
    workflow = cursor.fetchone()

    if not workflow:
        print(f"❌ Workflow {workflow_id} not found!")
        return False

    backup_file = f'/tmp/workflow_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'

    # Get column names
    columns = [description[0] for description in cursor.description]
    workflow_dict = dict(zip(columns, workflow))

    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(workflow_dict, f, indent=2, ensure_ascii=False)

    print(f"✅ Backup created: {backup_file}")
    return True

def analyze_workflow(conn, workflow_id):
    """Analyze current workflow structure"""
    cursor = conn.cursor()
    cursor.execute("SELECT nodes, connections FROM workflow_entity WHERE id = ?", (workflow_id,))
    row = cursor.fetchone()

    if not row:
        return None, None

    nodes = json.loads(row[0])
    connections = json.loads(row[1])

    print("\n📊 Current Workflow Analysis:")
    print(f"Total nodes: {len(nodes)}")

    # Find Switch node
    switch_node = next((n for n in nodes if n['name'] == 'FB Action Switch'), None)
    if switch_node:
        print(f"\n🔀 FB Action Switch found (ID: {switch_node['id']})")

    # Analyze connections
    switch_conn = connections.get('FB Action Switch', {}).get('main', [])
    print(f"\n🔗 FB Action Switch connections ({len(switch_conn)} outputs):")
    for i, output in enumerate(switch_conn):
        targets = [conn['node'] for conn in output]
        print(f"  Output {i}: {', '.join(targets) if targets else 'None'}")
        if i <= 1 and 'FB Graph Reply Text' in targets:
            print(f"    ⚠️  Output {i} connects to FB Graph Reply Text")

    return nodes, connections

def create_merge_node(existing_nodes):
    """Create a new Merge node"""
    # Find max position to place new node
    max_x = max((n.get('position', [0, 0])[0] for n in existing_nodes), default=0)

    merge_node = {
        "parameters": {
            "mode": "append",
            "options": {}
        },
        "id": "merge_fb_replies_fix",
        "name": "Merge FB Replies",
        "type": "n8n-nodes-base.merge",
        "typeVersion": 3,
        "position": [-240, 180]  # Position between Switch and FB Graph Reply Text
    }

    return merge_node

def fix_connections(connections):
    """Fix Switch connections to use Merge node"""
    new_connections = connections.copy()

    # Modify Switch connections: Output 0 and 1 go to Merge
    if 'FB Action Switch' in new_connections:
        switch_main = new_connections['FB Action Switch']['main']

        # Output 0 (fb_complaint) -> Merge
        switch_main[0] = [{"node": "Merge FB Replies", "type": "main", "index": 0}]

        # Output 1 (fb_encouragement) -> Merge
        switch_main[1] = [{"node": "Merge FB Replies", "type": "main", "index": 1}]

        # Outputs 2, 3, 4 stay the same

    # Add Merge -> FB Graph Reply Text connection
    new_connections['Merge FB Replies'] = {
        "main": [[{"node": "FB Graph Reply Text", "type": "main", "index": 0}]]
    }

    return new_connections

def apply_fix(conn, workflow_id, dry_run=True):
    """Apply the fix to the workflow"""
    cursor = conn.cursor()
    cursor.execute("SELECT nodes, connections FROM workflow_entity WHERE id = ?", (workflow_id,))
    row = cursor.fetchone()

    if not row:
        print(f"❌ Workflow {workflow_id} not found!")
        return False

    nodes = json.loads(row[0])
    connections = json.loads(row[1])

    # Check if Merge node already exists
    if any(n['name'] == 'Merge FB Replies' for n in nodes):
        print("⚠️  Merge node already exists. Skipping fix.")
        return False

    # Create new Merge node
    merge_node = create_merge_node(nodes)
    new_nodes = nodes + [merge_node]

    # Fix connections
    new_connections = fix_connections(connections)

    print("\n🔧 Proposed Changes:")
    print(f"  - Add 'Merge FB Replies' node")
    print(f"  - Switch Output 0 (fb_complaint) → Merge")
    print(f"  - Switch Output 1 (fb_encouragement) → Merge")
    print(f"  - Merge → FB Graph Reply Text")

    if dry_run:
        print("\n⚠️  DRY RUN mode - no changes applied")
        print("Run with --apply to apply changes")

        # Save to file for review
        preview_file = '/tmp/workflow_fix_preview.json'
        with open(preview_file, 'w', encoding='utf-8') as f:
            json.dump({
                'nodes': new_nodes,
                'connections': new_connections
            }, f, indent=2, ensure_ascii=False)
        print(f"Preview saved to: {preview_file}")
        return True

    # Apply changes to database
    print("\n✍️  Applying changes to database...")
    cursor.execute("""
        UPDATE workflow_entity
        SET nodes = ?, connections = ?, updatedAt = ?
        WHERE id = ?
    """, (
        json.dumps(new_nodes),
        json.dumps(new_connections),
        datetime.now().isoformat(),
        workflow_id
    ))

    conn.commit()
    print("✅ Changes applied successfully!")
    print("\n⚠️  Please restart n8n for changes to take effect:")
    print("   pkill -f 'n8n start' && ./start-n8n.sh")

    return True

def main():
    """Main function"""
    print("🔧 n8n Workflow Fix: Duplicate Facebook Reply")
    print("=" * 60)

    dry_run = '--apply' not in sys.argv

    try:
        conn = sqlite3.connect(DB_PATH)

        # Backup workflow
        if not backup_workflow(conn, WORKFLOW_ID):
            return 1

        # Analyze current state
        nodes, connections = analyze_workflow(conn, WORKFLOW_ID)
        if not nodes:
            print("❌ Failed to load workflow")
            return 1

        # Apply fix
        if not apply_fix(conn, WORKFLOW_ID, dry_run=dry_run):
            if not dry_run:
                return 1

        conn.close()

        if dry_run:
            print("\n" + "=" * 60)
            print("ℹ️  To apply the fix, run:")
            print("   python3 fix_duplicate_reply.py --apply")

        return 0

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
