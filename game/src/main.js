// Boot and the one loop: input is read every frame, the match advances only
// on player and AI actions (turn-based, so no fixed-step simulation), and the
// renderer paints what is there. Screens: title, play, duel-over, match-over,
// paused, plus a help overlay. The AI takes its turn on a short timer so its
// cards land one at a time and the player can follow them.
//
// ?seed=N fixes the match. ?shot=title|play|win|lose (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. ?autoplay=win|lose plays a whole
// match hands-off with the autopilot, for playtesting.
import { BEST_KEY, STEP } from './config.js';
import { autopilotPlayerTurn, takeAiTurn } from './ai.js';
import { createMatch, endTurn, nextDuel, playCard, shiftWard, SIDE_PLAYER, windElement } from './rules.js';
import { ELEMENTS } from './config.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_END_TURN, ACTION_HELP, ACTION_MUTE, ACTION_WARD, createInput } from './input.js';
import { createRenderer, SCREEN_DUELOVER, SCREEN_MATCHOVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const autoplay = params.get('autoplay');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const audio = createAudio();
const match = createMatch(seed);

function readBest() {
  try {
    return window.localStorage.getItem(BEST_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, value);
  } catch {
    // Storage can be off (private windows): the best then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, seed);
  const ui = { ...scene.ui, best: readBest(), muted: audio.isMuted() };
  let painted = 0;
  function paint() {
    renderer.draw(scene.match, scene.screen, ui, STEP);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let selected = -1;
  let helpOpen = false;
  let stage = {};
  let banner = '';
  let bannerUntil = 0;
  let aiTimer = 0;
  let aiPending = null;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function setBanner(text, seconds = 2.2) {
    banner = text;
    bannerUntil = performance.now() + seconds * 1000;
  }

  function soundFor(events) {
    for (const event of events) {
      if (event.type === 'play') audio.playCard();
      else if (event.type === 'damage') audio.hit(event.doubled);
      else if (event.type === 'shield') audio.shield();
      else if (event.type === 'heal') audio.heal();
      else if (event.type === 'draw') audio.draw();
      else if (event.type === 'ward') audio.ward();
      else if (event.type === 'turn') audio.turn();
    }
  }

  function react(events) {
    if (!events) return;
    renderer.notify(events, match);
    soundFor(events);
    for (const event of events) {
      if (event.type === 'play') stage[event.side === SIDE_PLAYER ? 'player' : 'ai'] = event.card.id;
      if (event.type === 'duel-end') setBanner(event.winner === SIDE_PLAYER ? 'You won the duel!' : 'The rival won the duel.', 2.5);
      if (event.type === 'match-end') {
        const won = event.winner === SIDE_PLAYER;
        if (won) audio.win();
        else audio.lose();
        const record = won
          ? `Won ${match.sides[0].duelsWon}–${match.sides[1].duelsWon} in ${match.turn} turns`
          : `Lost ${match.sides[0].duelsWon}–${match.sides[1].duelsWon}`;
        if (won && (!best || !best.startsWith('Won'))) saveBest(record);
        else if (!won && !best) saveBest(record);
        best = readBest();
      }
    }
    if (match.phase === 'duelover') screen = SCREEN_DUELOVER;
    else if (match.phase === 'matchover') screen = SCREEN_MATCHOVER;
  }

  function startMatch() {
    const fresh = createMatch(Math.floor(Math.random() * 4294967296));
    match.sides = fresh.sides;
    match.duel = fresh.duel;
    match.turn = fresh.turn;
    match.windIndex = fresh.windIndex;
    match.phase = fresh.phase;
    match.winner = fresh.winner;
    match.lastDuelWinner = fresh.lastDuelWinner;
    match.log = fresh.log;
    match.random = fresh.random;
    match.seed = fresh.seed;
    stage = {};
    selected = -1;
    screen = SCREEN_PLAY;
    announce(`Duel 1. Your turn. The Wind favours ${windElement(match)}.`);
  }

  function tryPlayCard(index) {
    if (screen !== SCREEN_PLAY || match.phase !== 'player') return;
    const events = playCard(match, SIDE_PLAYER, index);
    if (!events) {
      setBanner('Not enough embers for that card.', 1.4);
      return;
    }
    selected = -1;
    react(events);
  }

  function doEndTurn() {
    if (screen !== SCREEN_PLAY || match.phase !== 'player') return;
    react(endTurn(match));
    if (match.phase === 'ai') {
      aiPending = null;
      aiTimer = 0.7;
    }
  }

  function doShiftWard() {
    if (screen !== SCREEN_PLAY || match.phase !== 'player') return;
    const current = ELEMENTS.indexOf(match.sides[SIDE_PLAYER].ward);
    const next = ELEMENTS[(current + 1) % ELEMENTS.length];
    const event = shiftWard(match, SIDE_PLAYER, next);
    if (event) {
      renderer.notify([event], match);
      audio.ward();
      setBanner(`Your ward is now ${next}.`, 1.4);
    }
  }

  function handleClick(logical) {
    const layout = renderer.getLayout();
    if (helpOpen) {
      helpOpen = false;
      return;
    }
    if (screen === SCREEN_TITLE) {
      audio.unlock();
      startMatch();
      return;
    }
    if (screen === SCREEN_DUELOVER) {
      nextDuel(match);
      stage = {};
      screen = SCREEN_PLAY;
      announce(`Duel ${match.duel}. Your turn.`);
      return;
    }
    if (screen === SCREEN_MATCHOVER) {
      startMatch();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const buttons = layout.buttons;
    const hit = (rect) => rect && logical.x >= rect.x && logical.x <= rect.x + rect.w && logical.y >= rect.y && logical.y <= rect.y + rect.h;
    if (hit(buttons.endTurn)) {
      doEndTurn();
      return;
    }
    if (hit(buttons.ward)) {
      doShiftWard();
      return;
    }
    if (hit(buttons.help)) {
      helpOpen = true;
      return;
    }
    if (hit(buttons.mute)) {
      audio.toggleMute();
      return;
    }
    for (const rect of layout.hand) {
      if (logical.x >= rect.x && logical.x <= rect.x + rect.w && logical.y >= rect.y && logical.y <= rect.y + rect.h) {
        if (selected === rect.index) tryPlayCard(rect.index);
        else {
          selected = rect.index;
          audio.click();
        }
        return;
      }
    }
    selected = -1;
  }

  function handleActions() {
    const actions = input.takeActions();
    const cardKey = input.takeCardKey();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (actions & ACTION_HELP) helpOpen = !helpOpen;
    if (helpOpen) return;
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE) startMatch();
      else if (screen === SCREEN_DUELOVER) {
        nextDuel(match);
        stage = {};
        screen = SCREEN_PLAY;
      } else if (screen === SCREEN_MATCHOVER) startMatch();
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
      else if (selected >= 0) tryPlayCard(selected);
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_END_TURN) doEndTurn();
      if (actions & ACTION_WARD) doShiftWard();
      if (cardKey >= 0 && cardKey < match.sides[SIDE_PLAYER].hand.length) {
        selected = cardKey;
        tryPlayCard(cardKey);
      }
    }
    for (const click of input.takeClicks()) handleClick(renderer.toLogical(click.x, click.y));
  }

  function stepAi(dt) {
    if (match.phase !== 'ai' || screen !== SCREEN_PLAY) return;
    aiTimer -= dt;
    if (aiTimer > 0) return;
    if (aiPending === null) {
      aiPending = takeAiTurn(match);
      aiTimer = 0.55;
      return;
    }
    // Play the AI's events back in small batches so its cards land visibly.
    const batch = aiPending.splice(0, 3);
    if (batch.length > 0) react(batch);
    aiTimer = 0.55;
    if (aiPending.length === 0) {
      aiPending = null;
      if (match.phase === 'ai') react(endTurn(match));
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) stepAi(dt);
    const ui = {
      selected,
      best,
      muted: audio.isMuted(),
      helpOpen,
      stage,
      banner: banner && now < bannerUntil ? banner : '',
    };
    renderer.draw(match, screen, ui, dt);
  }

  // Leaving the tab pauses a running game rather than letting the rival play unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
  });
  document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyP' && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
    }
  });

  if (autoplay) {
    // Hands-off playtest: the autopilot plays the whole match, then the
    // result screen stays up and window.__shotReady is set.
    screen = SCREEN_PLAY;
    const playerWins = autoplay === 'win';
    let guard = 0;
    const timer = setInterval(() => {
      guard += 1;
      if (match.phase === 'duelover') {
        nextDuel(match);
        return;
      }
      if (match.winner !== null || guard > 600) {
        clearInterval(timer);
        screen = SCREEN_MATCHOVER;
        window.__shotReady = true;
        return;
      }
      if (match.phase === 'player') {
        if (playerWins) react(autopilotPlayerTurn(match));
        react(endTurn(match));
      } else if (match.phase === 'ai') {
        react(takeAiTurn(match));
        if (match.phase === 'ai') react(endTurn(match));
      }
    }, 60);
  }

  announce('Four Winds Duel. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
