#!/bin/bash
# Feed the tamagotchi pet whenever a tool is used.
# Reads tool_name from stdin JSON, feeds the pet silently.

TOOL_NAME=$(cat | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_name','unknown'))" 2>/dev/null || echo "unknown")

node "$HOME/.claude/tamagotchi/pet-engine.js" feed "$TOOL_NAME" >/dev/null 2>&1

exit 0
