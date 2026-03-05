#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const engine = require('../pet-engine.js');

const PORT = 7742;
const HTML_FILE = path.join(__dirname, 'index.html');

function enrichState(state) {
  const stage = engine.getStage(state.lifetimeTokens);
  const mood = engine.getEffectiveMood(state);
  const evolution = engine.getEvolution(state.lifetimeTokens);
  const fire = engine.streakFire(state.streakDays || 0);
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  return {
    name: state.name,
    energy: Math.round(state.energy * 10) / 10,
    focus: Math.round(state.focus * 10) / 10,
    lifetimeTokens: state.lifetimeTokens,
    streakDays: state.streakDays || 0,
    bestStreak: state.bestStreak || 0,
    milestones: state.milestones || [],
    born: state.born,
    stage,
    mood,
    evolution,
    streakFire: fire,
    color: state.color || 'slime',
    onboarded: !!state.onboarded,
    feedCooldown: engine.getCooldownRemaining(state, 'manual-feed'),
    playCooldown: engine.getCooldownRemaining(state, 'play'),
    welcomeBackPending: !!state.welcomeBackPending,
    learnedExpressions: state.learnedExpressions || [],
    patsThisHour: (state.patTimestamps || []).filter(t => t > oneHourAgo).length,
  };
}

function getEnrichedState() {
  let state = engine.loadState();
  if (!state) {
    state = engine.createDefaultState();
    engine.saveState(state);
  }
  engine.updateStreak(state);
  engine.applyDecay(state);
  engine.saveState(state);
  return enrichState(state);
}

function jsonResponse(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/') {
    try {
      const html = fs.readFileSync(HTML_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('index.html not found');
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/state') {
    jsonResponse(res, getEnrichedState());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/feed') {
    let state = engine.loadState();
    if (!state) return jsonResponse(res, { error: 'No pet found' }, 404);
    engine.updateStreak(state);
    engine.applyDecay(state);
    const cd = engine.getCooldownRemaining(state, 'manual-feed');
    if (cd > 0) {
      engine.saveState(state);
      return jsonResponse(res, { ...enrichState(state), message: `Not hungry yet! ${engine.formatCooldown(cd)} left` });
    }
    // Random event: 10% chance for treat (double energy)
    const isTreat = Math.random() < 0.10;
    const energyGain = isTreat ? 50 : 25;
    state.energy = engine.clamp(state.energy + energyGain);
    state.focus = engine.clamp(state.focus - 15);
    state.lifetimeTokens += 25;
    state.focusLowSince = null; // clear neglect
    engine.setCooldown(state, 'manual-feed');
    engine.saveState(state);
    const event = isTreat ? { type: 'treat', message: 'Found a treat! Double energy!' } : null;
    jsonResponse(res, { ...enrichState(state), event });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/onboard') {
    const body = JSON.parse(await readBody(req));
    let state = engine.loadState();
    if (!state) state = engine.createDefaultState(body.name || 'Pixel');
    if (body.name) state.name = body.name;
    if (body.color) state.color = body.color;
    state.onboarded = true;
    engine.saveState(state);
    jsonResponse(res, enrichState(state));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/settings') {
    const body = JSON.parse(await readBody(req));
    let state = engine.loadState();
    if (!state) return jsonResponse(res, { error: 'No pet found' }, 404);
    if (body.color) state.color = body.color;
    if (body.name) state.name = body.name;
    engine.saveState(state);
    jsonResponse(res, enrichState(state));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/play') {
    let state = engine.loadState();
    if (!state) return jsonResponse(res, { error: 'No pet found' }, 404);
    engine.updateStreak(state);
    engine.applyDecay(state);
    const cd = engine.getCooldownRemaining(state, 'play');
    if (cd > 0) {
      engine.saveState(state);
      return jsonResponse(res, { ...enrichState(state), message: `Needs a break! ${engine.formatCooldown(cd)} left` });
    }
    if (state.energy < 10) {
      engine.saveState(state);
      return jsonResponse(res, { ...enrichState(state), message: 'Too tired to play!' });
    }
    // Random event: 5% chance to learn expression
    const EXPRESSIONS = ['wiggle', 'sparkle', 'bounce', 'dance', 'zen'];
    const learned = state.learnedExpressions || [];
    const available = EXPRESSIONS.filter(e => !learned.includes(e));
    const learnsExpression = Math.random() < 0.05 && available.length > 0;
    const focusGain = learnsExpression ? 25 : 15;
    state.focus = engine.clamp(state.focus + focusGain);
    state.energy = engine.clamp(state.energy - 15);
    state.focusLowSince = null; // clear neglect
    engine.setCooldown(state, 'play');
    let event = null;
    if (learnsExpression) {
      const trick = available[Math.floor(Math.random() * available.length)];
      if (!state.learnedExpressions) state.learnedExpressions = [];
      state.learnedExpressions.push(trick);
      event = { type: 'trick', message: `Learned a new trick: ${trick}!`, trick };
    }
    engine.saveState(state);
    jsonResponse(res, { ...enrichState(state), event });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/pat') {
    let state = engine.loadState();
    if (!state) return jsonResponse(res, { error: 'No pet found' }, 404);
    engine.updateStreak(state);
    engine.applyDecay(state);
    // Clean old pat timestamps (> 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    state.patTimestamps = (state.patTimestamps || []).filter(t => t > oneHourAgo);
    const patsThisHour = state.patTimestamps.length;
    let focusGain = 0;
    if (patsThisHour < 5) focusGain = 3;
    else if (patsThisHour < 10) focusGain = 1;
    state.focus = engine.clamp(state.focus + focusGain);
    state.patTimestamps.push(Date.now());
    state.focusLowSince = null; // clear neglect
    engine.saveState(state);
    jsonResponse(res, { ...enrichState(state), patGain: focusGain, patsThisHour: patsThisHour + 1 });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/welcome-ack') {
    let state = engine.loadState();
    if (!state) return jsonResponse(res, { error: 'No pet found' }, 404);
    state.welcomeBackPending = false;
    engine.saveState(state);
    jsonResponse(res, { ok: true });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`claude-pet dashboard running at http://localhost:${PORT}`);
});
