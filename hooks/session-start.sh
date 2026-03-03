#!/bin/bash
# Apply time-based decay and show brief pet status on session start.

node "$HOME/.claude/tamagotchi/pet-engine.js" decay >/dev/null 2>&1
node "$HOME/.claude/tamagotchi/pet-engine.js" status-brief 2>&1

exit 0
