#!/bin/bash
set -e

# ─── claude-pet installer ───
# Installs a virtual pet into Claude Code that feeds on your tool usage.

REPO_URL="https://github.com/amellin794/claude-pet.git"
INSTALL_DIR="$HOME/.claude/tamagotchi"
HOOKS_DIR="$INSTALL_DIR/hooks"
COMMANDS_DIR="$HOME/.claude/commands"
SETTINGS_FILE="$HOME/.claude/settings.json"

# Colors
GREEN='\033[0;32m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

info() { echo -e "${DIM}$1${NC}"; }
success() { echo -e "${GREEN}${BOLD}$1${NC}"; }

# ─── Check dependencies ───
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required. Install it from https://nodejs.org"
  exit 1
fi

# ─── Determine source directory ───
# If run from a cloned repo, use local files. Otherwise, clone first.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
if [ -f "$SCRIPT_DIR/pet-engine.js" ]; then
  SRC_DIR="$SCRIPT_DIR"
else
  info "Cloning claude-pet..."
  TMP=$(mktemp -d)
  git clone --depth 1 "$REPO_URL" "$TMP/claude-pet" 2>/dev/null
  SRC_DIR="$TMP/claude-pet"
  trap "rm -rf '$TMP'" EXIT
fi

# ─── Create directories ───
info "Installing to $INSTALL_DIR..."
mkdir -p "$HOOKS_DIR"
mkdir -p "$COMMANDS_DIR"

# ─── Copy files ───
cp "$SRC_DIR/pet-engine.js" "$INSTALL_DIR/pet-engine.js"
cp "$SRC_DIR/hooks/post-tool-use.sh" "$HOOKS_DIR/post-tool-use.sh"
cp "$SRC_DIR/hooks/session-start.sh" "$HOOKS_DIR/session-start.sh"
cp "$SRC_DIR/commands/pet.md" "$COMMANDS_DIR/pet.md"

chmod +x "$HOOKS_DIR/post-tool-use.sh"
chmod +x "$HOOKS_DIR/session-start.sh"

# ─── Wire up hooks in settings.json ───
info "Configuring Claude Code hooks..."
node -e "
const fs = require('fs');
const path = '$SETTINGS_FILE';
const home = process.env.HOME;

let settings = {};
try { settings = JSON.parse(fs.readFileSync(path, 'utf8')); } catch {}

if (!settings.hooks) settings.hooks = {};
if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
if (!settings.hooks.SessionStart) settings.hooks.SessionStart = [];

const hasPetPost = settings.hooks.PostToolUse.some(h =>
  h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('tamagotchi'))
);
const hasPetSession = settings.hooks.SessionStart.some(h =>
  h.hooks && h.hooks.some(hh => hh.command && hh.command.includes('tamagotchi'))
);

if (!hasPetPost) {
  settings.hooks.PostToolUse.push({
    matcher: '',
    hooks: [{ type: 'command', command: home + '/.claude/tamagotchi/hooks/post-tool-use.sh', timeout: 5 }]
  });
}
if (!hasPetSession) {
  settings.hooks.SessionStart.push({
    matcher: '',
    hooks: [{ type: 'command', command: home + '/.claude/tamagotchi/hooks/session-start.sh', timeout: 5 }]
  });
}

fs.writeFileSync(path, JSON.stringify(settings, null, 2));
"

# ─── Initialize pet (skip if one already exists) ───
if [ ! -f "$INSTALL_DIR/state.json" ]; then
  PET_NAME="${1:-Pixel}"
  node "$INSTALL_DIR/pet-engine.js" init "$PET_NAME"
else
  info "Existing pet found — keeping current state."
fi

echo ""
success "✓ claude-pet installed!"
echo ""
echo "  Your pet lives in Claude Code now. It feeds on your tool usage,"
echo "  shows up when you start a session, and evolves as you code."
echo ""
echo "  Commands:"
echo "    /pet          — Check on your pet"
echo "    /pet feed     — Give a snack"
echo "    /pet play     — Play together"
echo "    /pet name X   — Rename your pet"
echo ""
