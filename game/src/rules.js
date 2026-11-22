// The rules of Four Winds Duel, with no drawing and no browser in them.
// A match is best of three duels; first to two duel wins takes the match.
// Each duel: both sides have 30 life, draw 5 cards, and take turns. On your
// turn you gain embers (1 on turn one, up to 8), draw a card, and may play
// any number of cards you can afford. A card's cost drops by 1 while its
// element matches the Wind. Playing two cards of the same element in one
// turn triggers Resonance: the second one is +2 power. Attacks are weighed
// against the defender's ward: double when your element beats their ward,
// half when their ward beats yours. Shields absorb damage first.
//
// Every function here is deterministic given the match's seeded generator,
// so a seeded match can be replayed exactly. State changes are reported as
// events ({ type, ... }) the renderer and the sound player react to.
import { CARD_BY_ID, beats, wardMultiplier } from './cards.js';
import { ELEMENTS, MATCH } from './config.js';
import { buildDeck, drawCards } from './deck.js';
import { createRandom } from './random.js';

export const SIDE_PLAYER = 0;
export const SIDE_AI = 1;

export const EVENT_DAMAGE = 'damage';
export const EVENT_SHIELD = 'shield';
export const EVENT_HEAL = 'heal';
export const EVENT_DRAW = 'draw';
export const EVENT_WARD = 'ward';
export const EVENT_DUEL_END = 'duel-end';
export const EVENT_MATCH_END = 'match-end';
export const EVENT_TURN = 'turn';

function newSide(random) {
  return {
    hp: MATCH.maxHp,
    shield: 0,
    mana: 0,
    hand: [],
    deck: buildDeck(random),
    discard: [],
    ward: ELEMENTS[Math.floor(random() * ELEMENTS.length)],
    wardShifted: false,
    duelsWon: 0,
    damageDealt: 0,
    playedElements: [],
  };
}

export function createMatch(seed) {
  const random = createRandom(seed);
  const match = {
    seed,
    random,
    sides: [newSide(random), newSide(random)],
    duel: 1,
    turn: 1,
    windIndex: Math.floor(random() * ELEMENTS.length),
    phase: 'player',
    winner: null,
    lastDuelWinner: null,
    log: [],
  };
  startDuel(match);
  return match;
}

/** The element the Wind favours this turn: its cards cost 1 less. */
export function windElement(match) {
  return ELEMENTS[match.windIndex % ELEMENTS.length];
}

/** What a card costs right now, after the Wind discount. */
export function cardCost(match, card) {
  return Math.max(0, card.cost - (card.element === windElement(match) ? 1 : 0));
}

function dealDamage(match, attackerSide, defenderSide, amount, pierce) {
  const defender = match.sides[defenderSide];
  const attacker = match.sides[attackerSide];
  let left = amount;
  if (!pierce && defender.shield > 0) {
    const absorbed = Math.min(defender.shield, left);
    defender.shield -= absorbed;
    left -= absorbed;
  }
  defender.hp = Math.max(0, defender.hp - left);
  attacker.damageDealt += left;
  return left;
}

function log(match, text) {
  match.log.push(text);
  if (match.log.length > 8) match.log.shift();
}

function startDuel(match) {
  for (const side of match.sides) {
    side.hp = MATCH.maxHp;
    side.shield = 0;
    side.mana = 0;
    side.hand = [];
    side.deck = buildDeck(match.random);
    side.discard = [];
    side.ward = ELEMENTS[Math.floor(match.random() * ELEMENTS.length)];
    side.wardShifted = false;
    side.playedElements = [];
  }
  match.turn = 1;
  match.windIndex = Math.floor(match.random() * ELEMENTS.length);
  for (const side of match.sides) drawCards(side.deck, side.discard, side.hand, MATCH.handStart, match.random);
  // The duels alternate who moves first by comeback: the loser of the last
  // duel opens the next one, so neither side keeps the first-move edge all
  // match; the side going second draws a bonus card, the lantern lit for
  // the player who waits.
  const starter = match.duel === 1 ? SIDE_PLAYER : 1 - match.lastDuelWinner;
  const second = 1 - starter;
  drawCards(match.sides[second].deck, match.sides[second].discard, match.sides[second].hand, 1, match.random);
  match.phase = starter === SIDE_AI ? 'ai' : 'player';
  beginTurn(match, starter);
  log(match, `Duel ${match.duel} begins — ${starter === SIDE_PLAYER ? 'you move first' : 'the rival moves first'}. The Wind favours ${windElement(match)}.`);
}

function beginTurn(match, sideIndex) {
  const side = match.sides[sideIndex];
  side.mana = Math.min(match.turn, MATCH.manaMax);
  side.wardShifted = false;
  side.playedElements = [];
  drawCards(side.deck, side.discard, side.hand, 1, match.random);
  while (side.hand.length > MATCH.handMax) side.discard.push(side.hand.pop());
}

/** Shift your own ward to a new element; once per turn, free. */
export function shiftWard(match, sideIndex, element) {
  const side = match.sides[sideIndex];
  if (side.wardShifted || side.ward === element) return null;
  side.ward = element;
  side.wardShifted = true;
  return { type: EVENT_WARD, side: sideIndex, element };
}

/**
 * Play the card at `handIndex` for `sideIndex`. Returns the events it caused,
 * or null when the card cannot be played (wrong phase, unaffordable, or the
 * duel is over). Resonance: a second card of an element already played this
 * turn gains +2 power.
 */
export function playCard(match, sideIndex, handIndex) {
  if (match.phase !== 'player' && sideIndex === SIDE_PLAYER) return null;
  if (match.phase !== 'ai' && sideIndex === SIDE_AI) return null;
  if (match.winner !== null) return null;
  const side = match.sides[sideIndex];
  const other = match.sides[1 - sideIndex];
  const cardId = side.hand[handIndex];
  if (cardId === undefined) return null;
  const card = CARD_BY_ID.get(cardId);
  const cost = cardCost(match, card);
  if (side.mana < cost) return null;
  const resonance = side.playedElements.includes(card.element);
  const power = card.power + (resonance ? 2 : 0);

  side.mana -= cost;
  side.hand.splice(handIndex, 1);
  side.discard.push(cardId);
  side.playedElements.push(card.element);

  const events = [{ type: 'play', side: sideIndex, card }];
  const who = sideIndex === SIDE_PLAYER ? 'You' : 'Rival';
  const mult = wardMultiplier(card.element, other.ward);

  function strike(amount, pierce) {
    const dealt = dealDamage(match, sideIndex, 1 - sideIndex, amount, pierce);
    events.push({
      type: EVENT_DAMAGE, side: 1 - sideIndex, amount: dealt,
      doubled: mult === 2, halved: mult === 0.5, pierce,
    });
    log(match, dealt > 0
      ? `${who} played ${card.name} — ${dealt} damage${mult === 2 ? ' (ward broken!)' : ''}.`
      : `${who} played ${card.name} — blocked by shield.`);
  }

  switch (card.effect) {
    case 'strike':
      strike(Math.max(1, Math.round(power * mult)), false);
      break;
    case 'pierce':
      strike(Math.max(1, Math.round(power * mult)), true);
      break;
    case 'draw':
      strike(Math.max(1, Math.round(power * mult)), false);
      drawCards(side.deck, side.discard, side.hand, 1, match.random);
      events.push({ type: EVENT_DRAW, side: sideIndex });
      break;
    case 'guard':
      side.shield += power;
      events.push({ type: EVENT_SHIELD, side: sideIndex, amount: power });
      log(match, `${who} raised ${power} shield with ${card.name}.`);
      break;
    case 'mend': {
      // Bedrock shields as well as healing; every other mend just heals.
      if (card.id === 'stone-6') {
        side.shield += 5;
        events.push({ type: EVENT_SHIELD, side: sideIndex, amount: 5 });
      }
      const healed = Math.min(MATCH.maxHp - side.hp, power);
      side.hp += healed;
      events.push({ type: EVENT_HEAL, side: sideIndex, amount: healed });
      log(match, `${who} healed ${healed} with ${card.name}.`);
      if (card.id === 'tide-5') {
        drawCards(side.deck, side.discard, side.hand, 1, match.random);
        events.push({ type: EVENT_DRAW, side: sideIndex });
      }
      break;
    }
    case 'siphon': {
      strike(Math.max(1, Math.round(power * mult)), false);
      const healed = Math.min(MATCH.maxHp - side.hp, 2);
      side.hp += healed;
      events.push({ type: EVENT_HEAL, side: sideIndex, amount: healed });
      break;
    }
    case 'feast':
      strike(Math.max(1, Math.round(power * mult)), false);
      if (side.hand.length > 0) {
        const lost = side.hand.splice(Math.floor(match.random() * side.hand.length), 1)[0];
        side.discard.push(lost);
      }
      break;
    case 'tailwind':
      drawCards(side.deck, side.discard, side.hand, 2, match.random);
      events.push({ type: EVENT_DRAW, side: sideIndex });
      log(match, `${who} drew 2 cards with ${card.name}.`);
      break;
    case 'ward':
      side.shield += power;
      side.ward = card.element;
      side.wardShifted = true;
      events.push({ type: EVENT_SHIELD, side: sideIndex, amount: power });
      events.push({ type: EVENT_WARD, side: sideIndex, element: card.element });
      log(match, `${who} took Mountain Stance — ward is now Stone.`);
      break;
    default:
      break;
  }

  if (other.hp <= 0) endDuel(match, sideIndex, events);
  return events;
}

function endDuel(match, winnerSide, events) {
  const winner = match.sides[winnerSide];
  winner.duelsWon += 1;
  match.lastDuelWinner = winnerSide;
  events.push({ type: EVENT_DUEL_END, winner: winnerSide, duel: match.duel });
  log(match, winnerSide === SIDE_PLAYER ? 'You won the duel!' : 'The rival won the duel.');
  if (winner.duelsWon >= MATCH.duelsToWin) {
    match.winner = winnerSide;
    match.phase = 'matchover';
    events.push({ type: EVENT_MATCH_END, winner: winnerSide });
  } else {
    match.duel += 1;
    match.phase = 'duelover';
  }
}

/** End the current side's turn and hand over to the other side. */
export function endTurn(match) {
  if (match.winner !== null || match.phase === 'duelover') return [];
  const nextSide = match.phase === 'player' ? SIDE_AI : SIDE_PLAYER;
  if (nextSide === SIDE_PLAYER) {
    match.turn += 1;
    match.windIndex += 1;
  }
  match.phase = nextSide === SIDE_AI ? 'ai' : 'player';
  beginTurn(match, nextSide);
  const events = [{ type: EVENT_TURN, side: nextSide, wind: windElement(match) }];
  log(match, nextSide === SIDE_PLAYER ? 'Your turn.' : 'Rival’s turn.');
  return events;
}

/** Start the next duel after one ended, keeping the match score. */
export function nextDuel(match) {
  if (match.phase !== 'duelover') return;
  startDuel(match);
}

/** Cards in hand the side can afford right now, as hand indexes. */
export function affordableIndexes(match, sideIndex) {
  const side = match.sides[sideIndex];
  const indexes = [];
  side.hand.forEach((cardId, index) => {
    if (cardCost(match, CARD_BY_ID.get(cardId)) <= side.mana) indexes.push(index);
  });
  return indexes;
}

export { beats };
