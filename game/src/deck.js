// Decks, hands and discard piles. A deck is an array of card ids; the draw
// pile is the end of the array. When the draw pile runs out mid-duel the
// discard pile is shuffled back in, so a duel never ends on an empty deck.
import { CARDS } from './cards.js';
import { MATCH } from './config.js';
import { shuffleInPlace } from './random.js';

/** A fresh shuffled deck: two copies of every card in the pool. */
export function buildDeck(random) {
  const deck = [];
  for (const card of CARDS) {
    for (let copy = 0; copy < MATCH.deckCopies; copy += 1) deck.push(card.id);
  }
  return shuffleInPlace(deck, random);
}

/**
 * Draw up to `count` cards from `pile` into `hand`. When the pile runs dry
 * the discard pile is shuffled back in first, so a duel never ends on an
 * empty deck. When both are empty it draws fewer and returns the count.
 */
export function drawCards(pile, discard, hand, count, random) {
  let drawn = 0;
  for (let n = 0; n < count; n += 1) {
    if (pile.length === 0) {
      if (discard.length === 0) break;
      while (discard.length > 0) pile.push(discard.pop());
      shuffleInPlace(pile, random);
    }
    hand.push(pile.pop());
    drawn += 1;
  }
  return drawn;
}
