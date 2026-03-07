#!/bin/bash
# InstructionsLoaded hook — confirm Golden Rules loaded
# Fires at session start and after compaction when CLAUDE.md reloads

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('file_path', ''))
except:
    print('')
" 2>/dev/null || echo "")

if echo "$FILE" | grep -q "CLAUDE.md"; then
  echo "✅ CLAUDE.md loaded — Golden Rules active (6 rules enforced)" >&2
fi

exit 0
