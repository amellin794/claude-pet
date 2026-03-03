#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'state.json');

// ─── ANSI Colors ───
const c = {
  r: '\x1b[0m',        // reset
  b: '\x1b[1m',        // bold
  d: '\x1b[2m',        // dim
  cy: '\x1b[36m',      // cyan
  ye: '\x1b[33m',      // yellow
  gy: '\x1b[90m',      // gray
  gn: '\x1b[32m',      // green (blob body)
  bg: '\x1b[92m',      // bright green
  by: '\x1b[93m',      // bright yellow
  br: '\x1b[91m',      // bright red
  bc: '\x1b[96m',      // bright cyan
  bm: '\x1b[95m',      // bright magenta
};

// ─── Feed values by tool ───
const FEED_VALUES = {
  Agent: 50,
  Bash: 30,
  Edit: 20,
  Write: 20,
  WebFetch: 15,
  WebSearch: 15,
  Grep: 12,
  Read: 10,
  Glob: 8,
};
const MCP_FEED = 15;
const DEFAULT_FEED = 10;

// ─── Date helpers ───
function getLocalDate(d) {
  d = d || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDate(d);
}

// ─── Evolution stages ───
function getStage(lifetimeTokens) {
  if (lifetimeTokens >= 10000) return 'adult';
  if (lifetimeTokens >= 1000) return 'teen';
  return 'baby';
}

// ─── Mood from avg(hunger, happiness) ───
function getMood(hunger, happiness) {
  const avg = (hunger + happiness) / 2;
  if (avg >= 70) return 'happy';
  if (avg >= 40) return 'neutral';
  if (avg >= 20) return 'hungry';
  return 'sad';
}

// ─── Streak system ───
const STREAK_MILESTONES = [7, 30, 100];

function migrateState(state) {
  if (state.streakDays === undefined) state.streakDays = 0;
  if (state.lastActiveDate === undefined) state.lastActiveDate = null;
  if (state.bestStreak === undefined) state.bestStreak = 0;
  if (state.milestones === undefined) state.milestones = [];
  return state;
}

function updateStreak(state) {
  migrateState(state);
  const today = getLocalDate();

  if (state.lastActiveDate === today) return; // already counted

  if (state.lastActiveDate === getYesterday()) {
    state.streakDays += 1;
  } else {
    state.streakDays = 1; // new streak starts today
  }

  state.lastActiveDate = today;
  state.bestStreak = Math.max(state.bestStreak, state.streakDays);

  for (const m of STREAK_MILESTONES) {
    if (state.streakDays >= m && !state.milestones.includes(m)) {
      state.milestones.push(m);
    }
  }
}

function getStreakDecayMultiplier(streakDays) {
  if (streakDays >= 100) return 0.50;
  if (streakDays >= 30) return 0.60;
  if (streakDays >= 7) return 0.75;
  if (streakDays >= 1) return 0.90;
  return 1.0;
}

function streakFire(streakDays) {
  if (streakDays >= 100) return '🔥🔥🔥';
  if (streakDays >= 30) return '🔥🔥';
  if (streakDays >= 7) return '🔥';
  if (streakDays >= 1) return '🔥';
  return '';
}

// ─── Aura line based on milestones ───
function getAuraLine(stage, milestones) {
  if (!milestones || milestones.length === 0) return null;
  const pad = { baby: '   ', teen: '     ', adult: '        ' }[stage];
  if (milestones.includes(100)) return `${pad}  ${c.by}♛${c.r}`;
  if (milestones.includes(30)) return `${pad} ${c.by}⚡*⚡${c.r}`;
  if (milestones.includes(7)) return `${pad} ${c.by}~*~${c.r}`;
  return null;
}

// ─── ASCII Art (blob/slime shapes) ───
const ART = {
  baby: {
    happy:   ['     _.-._', '    / ^_^ \\', '   |       |', '    \\_____/'],
    neutral: ['     _.-._', '    / o_o \\', '   |       |', '    \\_____/'],
    hungry:  ['     _.-._', '    / >_< \\', '   |       |', '    \\_____/'],
    sad:     ['     _.-._', '    / ;_; \\', '   |       |', '    \\_____/'],
  },
  teen: {
    happy:   ['      _.---._', '     / ^   ^ \\', '    |    u    |', '    |         |', '     \\_______/'],
    neutral: ['      _.---._', '     / o   o \\', '    |    _    |', '    |         |', '     \\_______/'],
    hungry:  ['      _.---._', '     / >   < \\', '    |    ~    |', '    |         |', '     \\_______/'],
    sad:     ['      _.---._', '     / ;   ; \\', '    |    n    |', '    |         |', '     \\_______/'],
  },
  adult: {
    happy:   ['       _.------._', '      / ^      ^ \\', '    (      \\_/     )', '    (              )', '     \\            /', "      '----------'"],
    neutral: ['       _.------._', '      / o      o \\', '    (      __     )', '    (              )', '     \\            /', "      '----------'"],
    hungry:  ['       _.------._', '      / >      < \\', '    (      ~~     )', '    (              )', '     \\            /', "      '----------'"],
    sad:     ['       _.------._', '      / ;      ; \\', '    (      __     )', '    (       |      )', '     \\            /', "      '----------'"],
  },
};

// ─── Floating element based on state ───
function getFloatingElement(mood, energy) {
  if (energy < 30) return `${c.gy}z z Z${c.r}`;
  if (mood === 'happy') return `${c.bm}♪${c.r}`;
  if (mood === 'hungry') return `${c.by}...${c.r}`;
  if (mood === 'sad') return `${c.bc},${c.r}`;
  return '';
}

// ─── Build scene (hearts + blob + floating element + ground) ───
function buildScene(stage, mood, state) {
  const lines = [];

  // Aura line (streak milestones) — above hearts
  const aura = getAuraLine(stage, state.milestones);
  if (aura) lines.push(aura);

  // Hearts row (happiness: filled vs empty, 5 total)
  const filledCount = Math.min(5, Math.ceil(state.happiness / 20));
  const hearts = [];
  for (let i = 0; i < 5; i++) {
    hearts.push(i < filledCount ? `${c.br}♥${c.r}` : `${c.gy}♡${c.r}`);
  }
  const heartPad = { baby: '   ', teen: '     ', adult: '        ' }[stage];
  lines.push(`${heartPad}${hearts.join(' ')}`);
  lines.push('');

  // Blob art with green color + floating element on face line
  const artLines = ART[stage][mood];
  const floater = getFloatingElement(mood, state.energy);
  for (let i = 0; i < artLines.length; i++) {
    let line = `${c.gn}${artLines[i]}${c.r}`;
    if (i === 1 && floater) {
      line += `    ${floater}`;
    }
    lines.push(line);
  }

  // Ground line
  const groundWidth = { baby: 15, teen: 19, adult: 23 }[stage];
  lines.push(`${c.gy}${'░'.repeat(groundWidth)}${c.r}`);

  return lines;
}

// ─── Flavor text ───
const FLAVOR = {
  baby: {
    happy: [
      '* Bouncing with joy!',
      '~ Happy little code buddy!',
      '* Living their best baby life!',
    ],
    neutral: [
      '  Just vibing...',
      '  Watching you code quietly.',
      '  Calm and content.',
    ],
    hungry: [
      '  Tummy is rumbling...',
      '  Feed me with tool calls!',
      '  A snack would be nice...',
    ],
    sad: [
      '  Misses you...',
      '  Please come back and code...',
      '  *sad beeping noises*',
    ],
  },
  teen: {
    happy: [
      '* Feeling unstoppable!',
      '~ Growing up fast!',
      '* Ready to take on the world!',
    ],
    neutral: [
      '  Contemplating the codebase...',
      '  Quietly learning.',
      '  Steady as she goes.',
    ],
    hungry: [
      '  Could really go for some commits...',
      '  Running on empty here!',
      '  Need fuel for growth!',
    ],
    sad: [
      '  Feeling forgotten...',
      '  The code feels far away.',
      '  *teenage angst intensifies*',
    ],
  },
  adult: {
    happy: [
      '* Peak performance!',
      '~ Battle-tested and thriving!',
      '* A true coding companion!',
    ],
    neutral: [
      '  Steady and reliable.',
      '  Wisdom comes with experience.',
      '  Standing guard over the repo.',
    ],
    hungry: [
      '  Even veterans need fuel...',
      '  The old hunger returns.',
      '  Feed the beast!',
    ],
    sad: [
      '  Even the strongest feel low sometimes.',
      '  Remember the good times...',
      '  *stares into the void of unused imports*',
    ],
  },
};

function getFlavorText(stage, mood) {
  const options = FLAVOR[stage][mood];
  return options[Math.floor(Math.random() * options.length)];
}

// ─── Stat helpers ───
function statColor(value) {
  if (value >= 70) return c.bg;
  if (value >= 40) return c.by;
  return c.br;
}

function moodColor(mood) {
  return { happy: c.bg, neutral: c.by, hungry: c.by, sad: c.br }[mood];
}

function statBar(value, width = 10) {
  const filled = Math.round((value / 100) * width);
  const empty = width - filled;
  const color = statColor(value);
  return `${color}${'█'.repeat(filled)}${c.gy}${'░'.repeat(empty)}${c.r}`;
}

// ─── Evolution progress ───
function getEvolution(tokens) {
  const stage = getStage(tokens);
  if (stage === 'adult') return null;

  const thresholds = {
    baby: { start: 0, end: 1000, next: 'Teen' },
    teen: { start: 1000, end: 10000, next: 'Adult' },
  };
  const t = thresholds[stage];
  const progress = tokens - t.start;
  const range = t.end - t.start;
  const pct = Math.min(progress / range, 1);
  const width = 20;
  const filled = Math.round(pct * width);
  const empty = width - filled;

  return {
    bar: `${c.cy}${'▓'.repeat(filled)}${c.gy}${'░'.repeat(empty)}${c.r}`,
    next: t.next,
    progress,
    target: range,
    pct: Math.round(pct * 100),
  };
}

// ─── Clamp helper ───
function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

// ─── Load state ───
function loadState() {
  if (!fs.existsSync(STATE_FILE)) return null;
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  return migrateState(state);
}

// ─── Save state ───
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Create default state ───
function createDefaultState(name) {
  return {
    name: name || 'Pixel',
    hunger: 50,
    happiness: 50,
    energy: 80,
    lifetimeTokens: 0,
    lastUpdate: Date.now(),
    born: Date.now(),
    streakDays: 0,
    lastActiveDate: null,
    bestStreak: 0,
    milestones: [],
  };
}

// ─── Apply time-based decay (streak reduces decay) ───
function applyDecay(state) {
  const now = Date.now();
  const hours = (now - state.lastUpdate) / (1000 * 60 * 60);
  if (hours < 0.01) return state; // skip tiny intervals

  const streakMult = getStreakDecayMultiplier(state.streakDays || 0);
  let hungerDecay = 5 * hours * streakMult;
  let happinessDecay = 3 * hours * streakMult;
  const energyGain = 2 * hours;

  // If hunger hits 0, happiness decays 2x faster
  if (state.hunger <= 0) {
    happinessDecay *= 2;
  }

  state.hunger = clamp(state.hunger - hungerDecay);
  state.happiness = clamp(state.happiness - happinessDecay);
  state.energy = clamp(state.energy + energyGain);
  state.lastUpdate = now;

  return state;
}

// ─── Get feed amount for a tool ───
function getFeedAmount(toolName) {
  if (FEED_VALUES[toolName]) return FEED_VALUES[toolName];
  if (toolName && toolName.startsWith('mcp_')) return MCP_FEED;
  return DEFAULT_FEED;
}

// ─── Actions ───
const actions = {
  init() {
    let state = loadState();
    if (state) {
      console.log(`Pet "${state.name}" already exists! Use 'status' to check on them.`);
      return;
    }
    const name = process.argv[3] || 'Pixel';
    state = createDefaultState(name);
    saveState(state);
    console.log(`Your pet "${name}" has been born! Use 'status' to see them.`);
  },

  feed() {
    const state = loadState();
    if (!state) { console.error('No pet found. Run init first.'); process.exit(1); }

    const toolName = process.argv[3] || 'unknown';
    const amount = getFeedAmount(toolName);

    updateStreak(state);
    applyDecay(state);
    state.hunger = clamp(state.hunger + amount * 0.3);
    state.happiness = clamp(state.happiness + amount * 0.1);
    state.energy = clamp(state.energy - amount * 0.05);
    state.lifetimeTokens += amount;
    saveState(state);
  },

  decay() {
    const state = loadState();
    if (!state) return;
    applyDecay(state);
    saveState(state);
  },

  status() {
    const state = loadState();
    if (!state) { console.log('No pet found. Run `node pet-engine.js init` to create one!'); return; }

    updateStreak(state);
    applyDecay(state);
    saveState(state);

    const stage = getStage(state.lifetimeTokens);
    const mood = getMood(state.hunger, state.happiness);
    const stageLabel = stage.charAt(0).toUpperCase() + stage.slice(1);
    const moodLabel = mood.charAt(0).toUpperCase() + mood.slice(1);
    const mc = moodColor(mood);

    const lines = [];

    // ── Header frame ──
    const titleRaw = `  ${state.name} the ${stageLabel}  ·  ${moodLabel}  `;
    const boxW = Math.max(titleRaw.length, 31);
    const titleStyled = `  ${c.b}${c.bc}${state.name} the ${stageLabel}${c.r}  ${c.gy}·${c.r}  ${mc}${c.b}${moodLabel}${c.r}  `;
    const pad = Math.max(0, boxW - titleRaw.length);

    lines.push('');
    lines.push(`  ${c.gy}╭${'─'.repeat(boxW)}╮${c.r}`);
    lines.push(`  ${c.gy}│${c.r}${titleStyled}${' '.repeat(pad)}${c.gy}│${c.r}`);
    lines.push(`  ${c.gy}╰${'─'.repeat(boxW)}╯${c.r}`);

    // ── Streak (right under header) ──
    const streak = state.streakDays || 0;
    if (streak > 0) {
      const fire = streakFire(streak);
      const best = state.bestStreak > streak ? `  ${c.gy}best: ${state.bestStreak}${c.r}` : '';
      const bonus = streak >= 7 ? `  ${c.d}(${Math.round((1 - getStreakDecayMultiplier(streak)) * 100)}% slower decay)${c.r}` : '';
      lines.push(`  ${fire} ${c.b}${streak}${c.r} day streak${best}${bonus}`);
    }
    lines.push('');

    // ── Scene (hearts + blob + ground) ──
    const scene = buildScene(stage, mood, state);
    for (const line of scene) {
      lines.push(`  ${line}`);
    }
    lines.push('');

    // ── Stat bars ──
    const p = (n) => String(Math.round(n)).padStart(3);
    lines.push(`  Hunger     ${statBar(state.hunger)}  ${statColor(state.hunger)}${p(state.hunger)}%${c.r}`);
    lines.push(`  Happiness  ${statBar(state.happiness)}  ${statColor(state.happiness)}${p(state.happiness)}%${c.r}`);
    lines.push(`  Energy     ${statBar(state.energy)}  ${statColor(state.energy)}${p(state.energy)}%${c.r}`);
    lines.push('');

    // ── Evolution progress ──
    const evo = getEvolution(state.lifetimeTokens);
    if (evo) {
      const evoTitle = `Next: ${evo.next}`;
      const dashLen = Math.max(1, 30 - evoTitle.length);
      lines.push(`  ${c.gy}──${c.r} ${c.cy}${evoTitle}${c.r} ${c.gy}${'─'.repeat(dashLen)}${c.r}`);
      lines.push(`  ${evo.bar}  ${c.d}${String(evo.pct).padStart(3)}%${c.r}`);
      lines.push(`  ${c.d}${evo.progress.toLocaleString()} / ${evo.target.toLocaleString()} tokens${c.r}`);
    } else {
      lines.push(`  ${c.bm}${c.b}★ MAX EVOLUTION ★${c.r}`);
    }
    lines.push('');

    // ── Flavor text ──
    lines.push(`  ${c.d}${getFlavorText(stage, mood)}${c.r}`);
    lines.push('');

    console.log(lines.join('\n'));
  },

  'status-brief'() {
    const state = loadState();
    if (!state) return;
    updateStreak(state);
    applyDecay(state);
    saveState(state);
    const mood = getMood(state.hunger, state.happiness);
    const face = { happy: '^_^', neutral: 'o_o', hungry: '>_<', sad: 'T_T' }[mood];
    const fire = (state.streakDays || 0) > 0 ? ` 🔥${state.streakDays}` : '';
    process.stderr.write(`(${face}) ${state.name}: H:${Math.round(state.hunger)}% J:${Math.round(state.happiness)}% E:${Math.round(state.energy)}%${fire}\n`);
  },

  play() {
    const state = loadState();
    if (!state) { console.error('No pet found. Run init first.'); process.exit(1); }

    updateStreak(state);
    applyDecay(state);

    if (state.energy < 10) {
      console.log(`${state.name} is too tired to play! Let them rest.`);
      saveState(state);
      return;
    }

    state.happiness = clamp(state.happiness + 20);
    state.energy = clamp(state.energy - 15);
    state.hunger = clamp(state.hunger - 5);
    saveState(state);

    const stage = getStage(state.lifetimeTokens);
    const mood = getMood(state.hunger, state.happiness);
    const scene = buildScene(stage, mood, state);

    const lines = [''];
    for (const line of scene) lines.push(`  ${line}`);
    lines.push('');
    lines.push(`  ${c.bg}+20 Happiness${c.r}  ${c.br}-15 Energy${c.r}  ${c.by}-5 Hunger${c.r}`);
    lines.push(`  ${c.d}${state.name} had fun playing!${c.r}`);
    lines.push('');
    console.log(lines.join('\n'));
  },

  'manual-feed'() {
    const state = loadState();
    if (!state) { console.error('No pet found. Run init first.'); process.exit(1); }

    updateStreak(state);
    applyDecay(state);
    state.hunger = clamp(state.hunger + 25);
    state.lifetimeTokens += 25;
    saveState(state);

    const stage = getStage(state.lifetimeTokens);
    const mood = getMood(state.hunger, state.happiness);
    const scene = buildScene(stage, mood, state);

    const lines = [''];
    for (const line of scene) lines.push(`  ${line}`);
    lines.push('');
    lines.push(`  ${c.bg}+25 Hunger${c.r}  ${c.d}nom nom nom${c.r}`);
    lines.push('');
    console.log(lines.join('\n'));
  },

  name() {
    const state = loadState();
    if (!state) { console.error('No pet found. Run init first.'); process.exit(1); }

    const newName = process.argv.slice(3).join(' ');
    if (!newName) { console.error('Please provide a name.'); process.exit(1); }

    const oldName = state.name;
    state.name = newName;
    saveState(state);
    console.log(`Renamed "${oldName}" to "${newName}"!`);
  },
};

// ─── Main ───
const action = process.argv[2];
if (!action || !actions[action]) {
  console.log('Usage: node pet-engine.js <action> [args]');
  console.log('Actions: init, feed <tool>, decay, status, status-brief, play, manual-feed, name <name>');
  process.exit(1);
}

actions[action]();
