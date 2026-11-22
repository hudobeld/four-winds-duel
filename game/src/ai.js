// The rival's brain: a heuristic player, not a random one. Each turn it
// scores every card it can afford — damage (weighed by the ward matchup and
// the Resonance bonus), shields and healing when hurt, card draw when its
// hand is thin — plays the best one, then re-scores, until nothing good is
// left or the mana runs out. It also sets its ward to counter the element
// the player has played most, and it always takes lethal when it sees it.
import { CARD_BY_ID, wardMultiplier } from './cards.js';
import { MATCH } from './config.js';
import { affordableIndexes, cardCost, playCard, SIDE_AI, SIDE_PLAYER } from './rules.js';

/** Value of playing `card` for the AI right now, in rough damage points. */
export function scoreCard(match, card) {
  const ai = match.sides[SIDE_AI];
  const player = match.sides[SIDE_PLAYER];
  const mult = wardMultiplier(card.element, player.ward);
  const resonance = ai.playedElements.includes(card.element) ? 2 : 0;
  const power = card.power + resonance;
  let value = 0;

  switch (card.effect) {
    case 'strike':
    case 'pierce': {
      const raw = Math.max(1, Math.round(power * mult));
      // Damage is worth more the closer the player is to falling.
      value = raw * (player.hp <= raw ? 100 : player.hp <= 10 ? 2 : 1);
      if (card.effect === 'pierce' && player.shield > 0) value += player.shield * 0.5;
      break;
    }
    case 'draw':
      value = Math.max(1, Math.round(power * mult)) + (ai.hand.length <= 4 ? 3 : 1);
      break;
    case 'siphon':
      value = Math.max(1, Math.round(power * mult)) + (ai.hp < MATCH.maxHp ? 2 : 0);
      break;
    case 'feast':
      value = Math.max(1, Math.round(power * mult)) - (ai.hand.length <= 1 ? 4 : 1);
      break;
    case 'guard':
      // Shields matter when the player can hit hard next turn; little when safe.
      value = ai.hp <= 12 ? power * 1.2 : ai.hp <= 20 ? power * 0.6 : power * 0.2;
      break;
    case 'mend':
      value = ai.hp >= MATCH.maxHp ? -5 : (MATCH.maxHp - ai.hp) * 0.8 + (card.id === 'tide-5' ? 2 : 0);
      break;
    case 'tailwind':
      value = ai.hand.length <= 3 ? 4 : 1;
      break;
    case 'ward':
      value = ai.hp <= 15 ? 5 : 2;
      break;
    default:
      value = 0;
      break;
  }
  // Cheap cards are efficient; don't waste a turn's mana on a weak play.
  value -= cardCost(match, card) * 0.15;
  // Resonance setup: playing this card is worth more when another card of
  // the same element is still in hand and affordable afterwards, because
  // the second one then lands with +2 power.
  const sameElementLeft = ai.hand.some((id) => {
    const other = CARD_BY_ID.get(id);
    return other !== card && other.element === card.element && cardCost(match, other) <= ai.mana - cardCost(match, card);
  });
  if (sameElementLeft) value += 2;
  return value;
}

/**
 * Play the AI's whole turn. Returns every event the turn caused, in order.
 * `onStep` is called after each card (the renderer uses it to animate).
 */
export function takeAiTurn(match, onStep) {
  const events = [];
  const ai = match.sides[SIDE_AI];
  // Note: the rival does NOT chase the player's most-played element with its
  // ward. A ward that always counters the player's history just tells the
  // player which element doubles this turn (measured: it cost the rival
  // 11 matches in 30 against the same brain), because the player's hand is
  // drawn at random and can always answer with the doubling element. The
  // rival keeps the ward it was dealt for the duel and spends its thinking
  // on the cards instead; the player is the one who shifts wards.
  for (let guard = 0; guard < 12; guard += 1) {
    const affordable = affordableIndexes(match, SIDE_AI);
    if (affordable.length === 0) break;
    let bestIndex = -1;
    let bestValue = 0.5;
    for (const index of affordable) {
      const value = scoreCard(match, CARD_BY_ID.get(ai.hand[index]));
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    }
    if (bestIndex === -1) break;
    const played = playCard(match, SIDE_AI, bestIndex);
    if (!played) break;
    events.push(...played);
    if (onStep) onStep(events);
    if (match.winner !== null || match.phase === 'duelover') break;
  }
  return events;
}

/**
 * The same brain, driving the player's side for autopilot playtests and the
 * screenshot scenes. Returns the events of one player turn.
 */
export function autopilotPlayerTurn(match) {
  const events = [];
  const player = match.sides[SIDE_PLAYER];
  for (let guard = 0; guard < 12; guard += 1) {
    const affordable = affordableIndexes(match, SIDE_PLAYER);
    if (affordable.length === 0) break;
    let bestIndex = -1;
    let bestValue = 0.5;
    for (const index of affordable) {
      // Reuse the AI's scoring with the sides swapped: score from the
      // player's point of view by temporarily mirroring the matchup.
      const card = CARD_BY_ID.get(player.hand[index]);
      const mult = wardMultiplier(card.element, match.sides[SIDE_AI].ward);
      const resonance = player.playedElements.includes(card.element) ? 2 : 0;
      const power = card.power + resonance;
      let value = 0;
      if (card.effect === 'strike' || card.effect === 'pierce' || card.effect === 'draw' || card.effect === 'siphon' || card.effect === 'feast') {
        const raw = Math.max(1, Math.round(power * mult));
        value = raw * (match.sides[SIDE_AI].hp <= raw ? 100 : 1);
        if (card.effect === 'draw') value += 2;
        if (card.effect === 'siphon') value += 1;
      } else if (card.effect === 'guard') {
        value = player.hp <= 12 ? power * 1.2 : power * 0.3;
      } else if (card.effect === 'mend') {
        value = player.hp >= MATCH.maxHp ? -5 : (MATCH.maxHp - player.hp) * 0.8;
      } else if (card.effect === 'tailwind') {
        value = player.hand.length <= 3 ? 4 : 1;
      } else if (card.effect === 'ward') {
        value = player.hp <= 15 ? 5 : 2;
      }
      value -= cardCost(match, card) * 0.15;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    }
    if (bestIndex === -1) break;
    const played = playCard(match, SIDE_PLAYER, bestIndex);
    if (!played) break;
    events.push(...played);
    if (match.winner !== null || match.phase === 'duelover') break;
  }
  return events;
}
