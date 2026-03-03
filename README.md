# claude-pet

A virtual pet that lives inside [Claude Code](https://docs.anthropic.com/en/docs/claude-code). It feeds on your tool usage, decays when you're away, and evolves as you code.

```
     ♥ ♥ ♥ ♡ ♡

       _.-._
      / ^_^ \    ♪
     |       |
      \_____/
  ░░░░░░░░░░░░░░░
```

## Install

```bash
git clone https://github.com/amellin794/claude-pet.git
cd claude-pet
./install.sh
```

Or name your pet on install:

```bash
./install.sh Bloop
```

## How it works

**Feeding** — Every time Claude Code uses a tool (Read, Edit, Bash, etc.), your pet gets fed. Bigger tools = more food:

| Tool | Feed |
|------|------|
| Agent | 50 |
| Bash | 30 |
| Edit / Write | 20 |
| WebFetch / WebSearch | 15 |
| Grep | 12 |
| Read | 10 |
| Glob | 8 |
| MCP tools | 15 |

**Decay** — Stats drop over time when you're not coding. Hunger falls ~5/hr, happiness ~3/hr. If hunger hits 0, happiness drops 2x faster.

**Streaks** — Code on consecutive days to build a streak. Streaks slow decay:

| Streak | Decay reduction |
|--------|----------------|
| 1+ days | 10% slower |
| 7+ days | 25% slower |
| 30+ days | 40% slower |
| 100+ days | 50% slower |

**Evolution** — Your pet grows as you accumulate lifetime tokens:

- **Baby** (0–1K tokens) — Small blob
- **Teen** (1K–10K tokens) — Medium blob
- **Adult** (10K+ tokens) — Large blob with arm bumps

**Moods** — Based on average of hunger + happiness:

- **Happy** (70+) — `^_^` with a music note
- **Neutral** (40–69) — `o_o`
- **Hungry** (20–39) — `>_<` with `...`
- **Sad** (0–19) — `;_;` with a teardrop

## Commands

Use these inside Claude Code:

```
/pet          — Full status display
/pet feed     — Give a snack (+25 hunger)
/pet play     — Play together (+20 happiness, -15 energy)
/pet name X   — Rename your pet
/pet help     — Show commands
```

## What it installs

All files go inside `~/.claude/` (Claude Code's config directory):

```
~/.claude/
├── tamagotchi/
│   ├── pet-engine.js      # Game engine
│   ├── state.json         # Pet state (created on first run)
│   └── hooks/
│       ├── post-tool-use.sh   # Feeds pet on tool use
│       └── session-start.sh   # Shows status on session start
├── commands/
│   └── pet.md             # /pet slash command
└── settings.json          # Hooks wired here (merged, not overwritten)
```

## Uninstall

```bash
cd claude-pet
./uninstall.sh
```

Removes all pet files and hooks. Your `settings.json` is cleaned up, not deleted.

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- Node.js (v16+)
- Python 3 (for hook JSON parsing)
