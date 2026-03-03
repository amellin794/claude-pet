#!/bin/bash
set -e

INSTALL_DIR="$HOME/.claude/tamagotchi"
COMMANDS_DIR="$HOME/.claude/commands"
SETTINGS_FILE="$HOME/.claude/settings.json"

DIM='\033[2m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

info() { echo -e "${DIM}$1${NC}"; }

echo "This will remove claude-pet from your Claude Code setup."
read -p "Continue? [y/N] " -n 1 -r
echo
[[ ! $REPLY =~ ^[Yy]$ ]] && exit 0

# ─── Remove hooks from settings.json ───
info "Removing hooks..."
node -e "
const fs = require('fs');
const path = '$SETTINGS_FILE';

let settings = {};
try { settings = JSON.parse(fs.readFileSync(path, 'utf8')); } catch { process.exit(0); }

if (settings.hooks) {
  for (const event of ['PostToolUse', 'SessionStart']) {
    if (settings.hooks[event]) {
      settings.hooks[event] = settings.hooks[event].filter(h =>
        !(h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('tamagotchi')))
      );
      if (settings.hooks[event].length === 0) delete settings.hooks[event];
    }
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
}

fs.writeFileSync(path, JSON.stringify(settings, null, 2));
"

# ─── Remove files ───
info "Removing files..."
rm -rf "$INSTALL_DIR"
rm -f "$COMMANDS_DIR/pet.md"

echo -e "${GREEN}${BOLD}✓ claude-pet removed.${NC}"
