// The card pool of Four Winds Duel: 24 original cards, six per element.
// Every card has a cost in embers, a power, an element and one effect.
// Effect kinds: strike (damage), guard (shield), mend (heal), draw (damage
// and draw), pierce (damage that ignores shield), ward (damage and set your
// own ward to this card's element), siphon (damage and heal half of it),
// feast (damage, then discard a card from your hand).
//
// Card ids are stable: 'ember-1' .. 'stone-6'. The deck builder takes two
// copies of each, so a match deck holds 48 cards.
import { ELEMENTS } from './config.js';

const RAW = [
  // Ember — the aggressive element: big numbers, greedy costs.
  ['ember-1', 'Cinder Sprite', 'ember', 1, 2, 'strike', 'Deal 2 damage.'],
  ['ember-2', 'Flame Lash', 'ember', 2, 4, 'strike', 'Deal 4 damage.'],
  ['ember-3', 'Wildfire', 'ember', 3, 6, 'strike', 'Deal 6 damage.'],
  ['ember-4', 'Ember Feast', 'ember', 2, 3, 'draw', 'Deal 3 damage. Draw a card.'],
  ['ember-5', 'Pyre Pact', 'ember', 4, 8, 'feast', 'Deal 8 damage. Discard a card.'],
  ['ember-6', 'Phoenix Rise', 'ember', 5, 5, 'siphon', 'Deal 5 damage. Heal 2.'],
  // Gale — the quick element: cheap plays and card flow.
  ['gale-1', 'Breeze Dart', 'gale', 1, 2, 'strike', 'Deal 2 damage.'],
  ['gale-2', 'Gust Step', 'gale', 1, 1, 'draw', 'Deal 1 damage. Draw a card.'],
  ['gale-3', 'Zephyr Blade', 'gale', 2, 4, 'strike', 'Deal 4 damage.'],
  ['gale-4', 'Cyclone', 'gale', 3, 5, 'pierce', 'Deal 5 damage through shields.'],
  ['gale-5', 'Tailwind', 'gale', 2, 0, 'tailwind', 'Draw 2 cards.'],
  ['gale-6', 'Storm Call', 'gale', 4, 7, 'draw', 'Deal 7 damage. Draw a card.'],
  // Tide — the flowing element: healing and steady pressure.
  ['tide-1', 'Dewdrop', 'tide', 1, 2, 'strike', 'Deal 2 damage.'],
  ['tide-2', 'Ripple Cut', 'tide', 2, 3, 'draw', 'Deal 3 damage. Draw a card.'],
  ['tide-3', 'Undertow', 'tide', 3, 5, 'siphon', 'Deal 5 damage. Heal 2.'],
  ['tide-4', 'Still Pool', 'tide', 2, 6, 'guard', 'Gain 6 shield.'],
  ['tide-5', 'Spring Rain', 'tide', 3, 6, 'mend', 'Heal 6. Draw a card.'],
  ['tide-6', 'Tidal Surge', 'tide', 5, 9, 'strike', 'Deal 9 damage.'],
  // Stone — the patient element: shields and ward play.
  ['stone-1', 'Pebble Toss', 'stone', 1, 2, 'strike', 'Deal 2 damage.'],
  ['stone-2', 'Granite Wall', 'stone', 2, 7, 'guard', 'Gain 7 shield.'],
  ['stone-3', 'Boulder Roll', 'stone', 3, 5, 'strike', 'Deal 5 damage.'],
  ['stone-4', 'Mountain Stance', 'stone', 1, 4, 'ward', 'Gain 4 shield. Set your ward to Stone.'],
  ['stone-5', 'Quake', 'stone', 4, 6, 'pierce', 'Deal 6 damage through shields.'],
  ['stone-6', 'Bedrock', 'stone', 3, 4, 'mend', 'Gain 5 shield. Heal 4.'],
];

export const CARDS = RAW.map(([id, name, element, cost, power, effect, text]) => ({
  id, name, element, cost, power, effect, text,
}));

export const CARD_BY_ID = new Map(CARDS.map((card) => [card.id, card]));

/** Index of an element in the advantage cycle. */
export function elementIndex(element) {
  return ELEMENTS.indexOf(element);
}

/** True when attackElement beats wardElement in the cycle. */
export function beats(attackElement, wardElement) {
  return ELEMENTS[(elementIndex(attackElement) + 1) % ELEMENTS.length] === wardElement;
}

/** Damage multiplier of an attack against a ward: 2, 1, or 0.5. */
export function wardMultiplier(attackElement, wardElement) {
  if (beats(attackElement, wardElement)) return 2;
  if (beats(wardElement, attackElement)) return 0.5;
  return 1;
}

/** The element that beats the given one — the counter to play against it. */
export function counterElement(element) {
  return ELEMENTS[(elementIndex(element) + ELEMENTS.length - 1) % ELEMENTS.length];
}
