// Four Winds Duel — every tuning number and colour in one place.
// The playfield is a fixed 1280x800 logical area; the renderer scales it to
// fit the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 800 };

export const STEP = 1 / 60;

export const MATCH = {
  maxHp: 30,
  duelsToWin: 2,
  handStart: 5,
  handMax: 7,
  manaMax: 8,
  deckCopies: 2,
};

export const ELEMENTS = ['ember', 'gale', 'tide', 'stone'];

// The advantage cycle follows this order: each element beats the next one
// (ember > gale > tide > stone > ember). Keep the list and the cycle in
// sync — cards.js reads the order to work out ward multipliers.

// The advantage cycle: ember > gale > tide > stone > ember.
// An attack whose element beats the defender's ward deals double;
// one whose element the ward beats deals half (at least 1).
export const ELEMENT_INFO = {
  ember: { name: 'Ember', color: '#ff6b4a', dark: '#c73e22', glyph: 'flame' },
  gale: { name: 'Gale', color: '#7ee0a3', dark: '#2f9e5f', glyph: 'swirl' },
  tide: { name: 'Tide', color: '#4aa8ff', dark: '#1f6fd0', glyph: 'drop' },
  stone: { name: 'Stone', color: '#e0a44f', dark: '#9a6a24', glyph: 'gem' },
};

export const PALETTE = {
  backdrop: '#0d1020',
  table: '#141a33',
  tableEdge: '#232c52',
  felt: '#1b2447',
  panel: '#1e2648',
  panelEdge: '#39447a',
  text: '#f2ead8',
  muted: '#9aa3c7',
  gold: '#f2c94c',
  red: '#ff5d5d',
  green: '#7ee0a3',
  cardBack: '#2a335e',
  cardFace: '#f7f1de',
  cardInk: '#23233a',
  button: '#3a5a8c',
  buttonEdge: '#6f9fd8',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best match result is kept between visits (this browser only). */
export const BEST_KEY = 'four-winds-duel.best';
