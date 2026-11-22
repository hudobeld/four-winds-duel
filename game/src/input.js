// Keyboard and pointer input. Held keys are not needed here — this is a
// turn-based game, so every press is a one-shot action queued as a bit flag
// and taken once by the loop. Pointer clicks report their coordinates in
// canvas pixels; the main loop converts them to playfield coordinates with
// the renderer's toLogical before hit-testing the layout.
export const ACTION_CONFIRM = 1;
export const ACTION_END_TURN = 2;
export const ACTION_WARD = 4;
export const ACTION_HELP = 8;
export const ACTION_MUTE = 16;

const CONFIRM = new Set(['Space', 'Enter']);
const END_TURN = new Set(['KeyE']);
const WARD = new Set(['KeyW']);
const HELP = new Set(['KeyH']);
const MUTE = new Set(['KeyM']);
const CARD_KEYS = new Set(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7']);

export function createInput(canvas) {
  let actions = 0;
  let cardKey = -1;
  const clicks = [];

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (END_TURN.has(event.code)) {
      if (!event.repeat) actions |= ACTION_END_TURN;
    } else if (WARD.has(event.code)) {
      if (!event.repeat) actions |= ACTION_WARD;
    } else if (HELP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_HELP;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (CARD_KEYS.has(event.code)) {
      if (!event.repeat) cardKey = Number(event.code.slice(-1)) - 1;
    } else {
      return;
    }
    event.preventDefault();
  });

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    clicks.push({
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    });
  });

  return {
    /** One-shot action flags since the last call. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Index (0-based) of a number key pressed since the last call, or -1. */
    takeCardKey() {
      const taken = cardKey;
      cardKey = -1;
      return taken;
    },
    /** Click positions (canvas pixels) since the last call. */
    takeClicks() {
      return clicks.splice(0, clicks.length);
    },
  };
}
