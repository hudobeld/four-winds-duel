// The screenshot scenes behind ?shot=title|play|win|lose. Each one plays the
// real rules forward from a fresh match, steered by the same autopilot brain
// the AI uses, so every frame is what a real game looks like and the same
// seed always gives the same frame. The win scene replays seeds until the
// player takes the match; the lose scene plays a passive player who never
// plays a card, so the rival takes it.
import { autopilotPlayerTurn, takeAiTurn } from './ai.js';
import { CARD_BY_ID } from './cards.js';
import { affordableIndexes, createMatch, endTurn, nextDuel, playCard } from './rules.js';
import { SCREEN_MATCHOVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** A weak player: one card a turn, the weakest it can afford. It fights, and loses. */
function weakPlayerTurn(match) {
  const player = match.sides[0];
  const affordable = affordableIndexes(match, 0);
  if (affordable.length === 0) return [];
  let worst = affordable[0];
  for (const index of affordable) {
    const card = CARD_BY_ID.get(player.hand[index]);
    const worstCard = CARD_BY_ID.get(player.hand[worst]);
    if (card.power < worstCard.power || (card.power === worstCard.power && card.cost < worstCard.cost)) worst = index;
  }
  return playCard(match, 0, worst) ?? [];
}

function playFullTurn(match, mode) {
  // Phase-driven: duels alternate who moves first, so either side may open.
  if (match.phase === 'player') {
    if (mode === 'auto') autopilotPlayerTurn(match);
    else if (mode === 'weak') weakPlayerTurn(match);
    if (match.phase === 'duelover' || match.winner !== null) return;
    endTurn(match);
  } else if (match.phase === 'ai') {
    takeAiTurn(match);
    if (match.phase === 'duelover' || match.winner !== null) return;
    endTurn(match);
  }
}

/** Play whole duels until the match ends; returns the winner (0 or 1). */
function playMatch(match, mode) {
  for (let guard = 0; guard < 400 && match.winner === null; guard += 1) {
    if (match.phase === 'duelover') {
      nextDuel(match);
      continue;
    }
    playFullTurn(match, mode);
  }
  return match.winner;
}

/**
 * Set up the named scene and return the screen to draw, the UI hints and
 * the match behind it. Any other name stages the title.
 */
export function stageShot(name, seed) {
  if (name !== 'play' && name !== 'win' && name !== 'lose') {
    const match = createMatch(seed);
    return { match, screen: SCREEN_TITLE, ui: {} };
  }
  if (name === 'play') {
    const match = createMatch(seed);
    for (let turn = 0; turn < 5 && match.winner === null; turn += 1) {
      if (match.phase === 'duelover') nextDuel(match);
      playFullTurn(match, 'auto');
    }
    // Stage a mid-duel table: both sides hurt, cards in hand, a last play shown.
    const stage = {};
    const playerLast = match.sides[0].discard.at(-1);
    const aiLast = match.sides[1].discard.at(-1);
    if (playerLast) stage.player = playerLast;
    if (aiLast) stage.ai = aiLast;
    return {
      match,
      screen: SCREEN_PLAY,
      ui: { stage, banner: match.phase === 'player' ? 'Your turn — play a card!' : 'The rival is thinking…' },
    };
  }
  if (name === 'win') {
    // Find a seed where the autopilot player takes the match.
    for (let s = seed; s < seed + 40; s += 1) {
      const match = createMatch(s);
      if (playMatch(match, 'auto') === 0) {
        return { match, screen: SCREEN_MATCHOVER, ui: {} };
      }
    }
    // Fallback: the first seed's match, whatever its ending.
    const match = createMatch(seed);
    playMatch(match, 'auto');
    return { match, screen: SCREEN_MATCHOVER, ui: {} };
  }
  // Lose: a weak player fights one feeble card a turn, so the rival wins
  // a real match instead of a walkover.
  for (let s = seed; s < seed + 40; s += 1) {
    const match = createMatch(s);
    if (playMatch(match, 'weak') === 1) {
      return { match, screen: SCREEN_MATCHOVER, ui: {} };
    }
  }
  const match = createMatch(seed);
  playMatch(match, 'weak');
  return { match, screen: SCREEN_MATCHOVER, ui: {} };
}
