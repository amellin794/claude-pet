#!/bin/bash
# Feed the pet on tool use. Pure bash — no python dependency.

# Extract tool_name from stdin JSON with lightweight grep
TOOL_NAME=$(grep -o '"tool_name":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -z "$TOOL_NAME" ] && TOOL_NAME="unknown"

node "$HOME/.claude/tamagotchi/pet-engine.js" feed "$TOOL_NAME" >/dev/null 2>&1 &
exit 0
