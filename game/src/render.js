// Drawing only: the match state and the current screen in, pixels out.
// The 1280x800 playfield is scaled to fit the window and centred. Cards are
// drawn as rounded rectangles with a cost gem, an element glyph (drawn in
// code, one shape per element), a big power number, a name and the effect
// text, so a card stays legible at thumbnail size. Hits, shields and heals
// spawn particles and floating numbers; played cards fly to the centre
// stage. The renderer also publishes the layout (hand rectangles, buttons)
// the main loop hit-tests clicks against.
import { CARD_BY_ID } from './cards.js';
import { ELEMENT_INFO, ELEMENTS, FIELD, FONT, MATCH, PALETTE } from './config.js';
import { cardCost, windElement } from './rules.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_DUELOVER = 'duelover';
export const SCREEN_MATCHOVER = 'matchover';
export const SCREEN_PAUSED = 'paused';

const CARD_W = 150;
const CARD_H = 210;
const HAND_Y = 566;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const particles = [];
  const floaters = [];
  const flights = [];
  let shake = 0;
  let layout = { hand: [], buttons: {} };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    view.x = (canvas.width - FIELD.width * view.scale) / 2;
    view.y = (canvas.height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function bar(x, y, w, h, frac, fill, back) {
    ctx.fillStyle = back;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    if (frac > 0) {
      ctx.fillStyle = fill;
      roundRect(ctx, x, y, Math.max(h, w * frac), h, h / 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.stroke();
  }

  /** One element glyph, drawn in code: flame, swirl, drop, gem. */
  function glyph(element, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.14;
    ctx.lineCap = 'round';
    const s = size / 2;
    if (element === 'ember') {
      ctx.beginPath();
      ctx.moveTo(x, y + s);
      ctx.quadraticCurveTo(x - s, y, x - s * 0.3, y - s * 0.6);
      ctx.quadraticCurveTo(x, y - s * 1.2, x + s * 0.2, y - s * 0.5);
      ctx.quadraticCurveTo(x + s * 0.9, y - s * 0.2, x + s * 0.7, y + s * 0.5);
      ctx.quadraticCurveTo(x + s * 0.4, y + s, x, y + s);
      ctx.fill();
    } else if (element === 'tide') {
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.quadraticCurveTo(x + s, y + s * 0.2, x, y + s);
      ctx.quadraticCurveTo(x - s, y + s * 0.2, x, y - s);
      ctx.fill();
    } else if (element === 'gale') {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.85, 0.6, 4.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, s * 0.45, 2.2, 5.6);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.8, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.8, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCardBack(x, y, w, h) {
    ctx.fillStyle = PALETTE.cardBack;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    roundRect(ctx, x + 5, y + 5, w - 10, h - 10, 7);
    ctx.stroke();
    glyph('ember', x + w / 2, y + h / 2, 26, PALETTE.gold);
  }

  function drawCard(card, x, y, w, h, opts = {}) {
    const info = ELEMENT_INFO[card.element];
    const scale = w / CARD_W;
    ctx.save();
    if (opts.lift) ctx.translate(0, -18);
    ctx.fillStyle = opts.dim ? '#8d8570' : PALETTE.cardFace;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.lineWidth = opts.selected ? 4 : 2;
    ctx.strokeStyle = opts.selected ? PALETTE.gold : info.dark;
    roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();
    // Element band.
    ctx.fillStyle = info.color;
    roundRect(ctx, x + 3, y + 3, w - 6, 34 * scale + 10, 9);
    ctx.fill();
    ctx.fillStyle = '#fff';
    text(info.name.toUpperCase(), x + w / 2, y + 26 * scale + 4, Math.round(15 * scale), '#fff', 'center', '700 ');
    // Cost gem, top left.
    ctx.fillStyle = '#2b3a6e';
    ctx.beginPath();
    ctx.arc(x + 20, y + 20, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    text(String(opts.cost ?? card.cost), x + 20, y + 26, 18, PALETTE.gold, 'center', '700 ');
    // Element glyph, top right.
    glyph(card.element, x + w - 24, y + 20, 22, '#fff');
    // Power number, big and centred. Tailwind draws cards instead of
    // dealing damage, so its big number is the 2 cards it draws.
    const displayPower = card.effect === 'tailwind' ? 2 : (opts.power ?? card.power);
    const displayLabel = card.effect === 'tailwind' ? 'DRAW'
      : card.effect === 'guard' || card.effect === 'mend' || card.effect === 'ward' ? 'SHIELD / HEAL' : 'DAMAGE';
    ctx.fillStyle = PALETTE.cardInk;
    text(String(displayPower), x + w / 2, y + h * 0.46, Math.round(52 * scale), PALETTE.cardInk, 'center', '800 ');
    if (!opts.compact) {
      text(displayLabel, x + w / 2, y + h * 0.46 + 22, 11, PALETTE.muted, 'center', '700 ');
    }
    // Name and effect text. In a fanned hand the name is left-aligned so it
    // stays inside the visible strip of its card instead of running under
    // the next one; on its own (the stage) it stays centred.
    if (opts.fan) text(card.name, x + 12, y + h - 62, 12, PALETTE.cardInk, 'left', '700 ');
    else text(card.name, x + w / 2, y + h - 62, Math.round(16 * scale), PALETTE.cardInk, 'center', '700 ');
    if (!opts.compact) {
      ctx.fillStyle = '#5a5470';
      ctx.font = `${Math.round(12.5 * scale)}px ${FONT}`;
      ctx.textAlign = 'center';
      wrapText(card.text, x + w / 2, y + h - 42, w - 44, 15);
    }
    if (opts.resonance) {
      ctx.fillStyle = PALETTE.gold;
      roundRect(ctx, x + 10, y + h - 24, w - 20, 18, 9);
      ctx.fill();
      text('RESONANCE +2', x + w / 2, y + h - 11, 11, '#23233a', 'center', '800 ');
    }
    ctx.restore();
  }

  function wrapText(value, x, y, maxWidth, lineHeight) {
    const words = value.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  function drawSidePanel(match, sideIndex, x, y, name, isPlayer) {
    const side = match.sides[sideIndex];
    const info = ELEMENT_INFO[side.ward];
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, 276, 118, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, 276, 118, 12);
    ctx.stroke();
    text(name, x + 14, y + 26, 17, PALETTE.text, 'left', '700 ');
    // Duel pips: first to two.
    for (let i = 0; i < MATCH.duelsToWin; i += 1) {
      ctx.fillStyle = i < side.duelsWon ? PALETTE.gold : '#39447a';
      ctx.beginPath();
      ctx.arc(x + 252 - i * 22, y + 20, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    bar(x + 14, y + 38, 180, 20, side.hp / MATCH.maxHp, '#e5534b', '#3a2030');
    text(`${side.hp} / ${MATCH.maxHp}`, x + 202, y + 54, 16, PALETTE.text, 'left', '700 ');
    text('LIFE', x + 14, y + 80, 11, PALETTE.muted, 'left', '700 ');
    if (side.shield > 0) {
      ctx.fillStyle = '#6f9fd8';
      roundRect(ctx, x + 60, y + 66, 62, 20, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(x + 70, y + 71);
      ctx.lineTo(x + 78, y + 71);
      ctx.lineTo(x + 78, y + 78);
      ctx.quadraticCurveTo(x + 74, y + 83, x + 70, y + 78);
      ctx.closePath();
      ctx.fill();
      text(`${side.shield}`, x + 84, y + 81, 13, '#fff', 'left', '700 ');
    }
    // Ward badge: colour + shape, never text alone.
    ctx.fillStyle = info.color;
    roundRect(ctx, x + 128, y + 66, 92, 20, 10);
    ctx.fill();
    glyph(side.ward, x + 142, y + 76, 13, '#fff');
    text(`Ward ${info.name}`, x + 152, y + 81, 12, '#fff', 'left', '700 ');
    if (isPlayer) {
      // Mana embers.
      text('EMBERS', x + 14, y + 108, 11, PALETTE.muted, 'left', '700 ');
      for (let i = 0; i < MATCH.manaMax; i += 1) {
        ctx.fillStyle = i < side.mana ? PALETTE.gold : '#39447a';
        ctx.beginPath();
        ctx.arc(x + 74 + i * 20, y + 103, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      text(`Hand ${side.hand.length}  •  Deck ${side.deck.length}`, x + 14, y + 108, 12, PALETTE.muted, 'left');
    }
  }

  function drawButton(id, x, y, w, h, label, enabled, accent) {
    ctx.fillStyle = enabled ? (accent ? '#7a5a1d' : PALETTE.button) : '#2a3040';
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = enabled ? PALETTE.buttonEdge : '#39447a';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 10);
    ctx.stroke();
    text(label, x + w / 2, y + h / 2 + 7, 18, enabled ? PALETTE.text : PALETTE.muted, 'center', '700 ');
    layout.buttons[id] = { x, y, w, h, enabled };
  }

  function drawLog(match) {
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, 1024, 72, 232, 468, 12);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    roundRect(ctx, 1024, 72, 232, 468, 12);
    ctx.stroke();
    text('BATTLE LOG', 1040, 98, 14, PALETTE.gold, 'left', '700 ');
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = 'left';
    // Wrap each entry to the panel width and advance one line at a time, so
    // a long entry never prints over the next one.
    const lines = [];
    for (const entry of match.log.slice(-10)) {
      const words = entry.split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > 200 && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      lines.push('');
    }
    let yy = 122;
    for (const line of lines.slice(-24)) {
      if (line) ctx.fillText(line, 1040, yy);
      yy += 16;
      if (yy > 524) break;
    }
  }

  function drawHand(match, ui) {
    const hand = match.sides[0].hand;
    const total = hand.length;
    // A big hand shrinks to the compact card so names stay readable under
    // the fan; a small hand gets the full-size card with its effect text.
    const compact = total > 4;
    const cw = compact ? 120 : CARD_W;
    const ch = compact ? 168 : CARD_H;
    const rowWidth = 660;
    const step = total > 1 ? Math.min(cw, (rowWidth - cw) / (total - 1)) : 0;
    const span = cw + (total - 1) * step;
    const x0 = 340 + (rowWidth - span) / 2;
    layout.hand = [];
    hand.forEach((cardId, index) => {
      const card = CARD_BY_ID.get(cardId);
      const x = x0 + index * step;
      const y = HAND_Y + (ui.selected === index ? -26 : ui.hover === index ? -12 : 0) + (compact ? CARD_H - ch : 0);
      const affordable = cardCost(match, card) <= match.sides[0].mana;
      const resonance = match.sides[0].playedElements.includes(card.element);
      drawCard(card, x, y, cw, ch, {
        cost: cardCost(match, card), power: card.power + (resonance ? 2 : 0),
        selected: ui.selected === index, dim: !affordable, resonance, compact, fan: compact,
      });
      layout.hand.push({ x, y, w: cw, h: ch, index });
    });
  }

  function drawStage(match, ui, screen) {
    // Centre stage: the last card each side played, facing off.
    ctx.fillStyle = PALETTE.felt;
    roundRect(ctx, 24, 200, 976, 340, 16);
    ctx.fill();
    ctx.strokeStyle = PALETTE.tableEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, 24, 200, 976, 340, 16);
    ctx.stroke();
    text('THE TABLE', 512, 232, 13, PALETTE.muted, 'center', '700 ');
    const stage = ui.stage || {};
    if (stage.ai) {
      drawCard(CARD_BY_ID.get(stage.ai), 300, 262, 120, 168, { compact: true });
      text('RIVAL PLAYED', 360, 252, 12, PALETTE.muted, 'center', '700 ');
    }
    if (stage.player) {
      drawCard(CARD_BY_ID.get(stage.player), 580, 262, 120, 168, { compact: true });
      text('YOU PLAYED', 640, 252, 12, PALETTE.muted, 'center', '700 ');
    }
    // The hint only belongs on the bare play screen: under a duel/match
    // panel its ends would stick out past the panel's edges.
    if (!stage.ai && !stage.player && screen === SCREEN_PLAY) {
      text('Play a card — it lands here.', 512, 360, 18, PALETTE.muted, 'center');
      text('Match the Wind, break their ward, chain one element for Resonance.', 512, 392, 15, PALETTE.muted, 'center');
    }
    if (ui.banner) {
      ctx.fillStyle = 'rgba(13,16,32,0.82)';
      roundRect(ctx, 212, 440, 600, 52, 12);
      ctx.fill();
      text(ui.banner, 512, 474, 20, PALETTE.gold, 'center', '700 ');
    }
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = floaters.length - 1; i >= 0; i -= 1) {
      const f = floaters[i];
      f.life -= dt;
      if (f.life <= 0) {
        floaters.splice(i, 1);
        continue;
      }
      f.y -= 40 * dt;
      ctx.globalAlpha = Math.min(1, f.life);
      text(f.text, f.x, f.y, f.size, f.color, 'center', '800 ');
    }
    ctx.globalAlpha = 1;
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 260;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        life: 0.5 + Math.random() * 0.4,
        size: 2 + Math.random() * 4,
        color,
      });
    }
  }

  function drawTitle(match, best) {
    ctx.fillStyle = PALETTE.table;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Decorative fanned cards behind the title.
    const demo = ['ember-3', 'gale-4', 'tide-6', 'stone-2'];
    demo.forEach((id, i) => {
      ctx.save();
      ctx.translate(400 + i * 170, 470);
      ctx.rotate((i - 1.5) * 0.1);
      drawCard(CARD_BY_ID.get(id), -75, -105, 150, 210, {});
      ctx.restore();
    });
    text('FOUR WINDS DUEL', FIELD.width / 2, 190, 64, PALETTE.gold, 'center', '800 ');
    text('A duel of ember, gale, tide and stone — break their ward, ride the Wind.', FIELD.width / 2, 232, 20, PALETTE.text, 'center');
    text('Best of 3 duels  •  30 life  •  First to 2 duel wins takes the match', FIELD.width / 2, 264, 16, PALETTE.muted, 'center');
    text('Click a card to play it  •  1–7 keys play from hand  •  E ends turn  •  W shifts ward  •  H help', FIELD.width / 2, 700, 16, PALETTE.muted, 'center');
    text('Press SPACE or click to begin', FIELD.width / 2, 740, 22, PALETTE.text, 'center', '700 ');
    if (best) text(`Best match: ${best}`, FIELD.width / 2, 300, 16, PALETTE.gold, 'center');
    layout.buttons.start = { x: 0, y: 0, w: FIELD.width, h: FIELD.height, enabled: true };
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 34;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    ctx.fillStyle = 'rgba(10,12,26,0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, width, height, 16);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.panelEdge;
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, width, height, 16);
    ctx.stroke();
    text(title, FIELD.width / 2, y + 72, 44, accent === PALETTE.gold ? PALETTE.gold : PALETTE.text, 'center', '800 ');
    lines.forEach((line, i) => text(line, FIELD.width / 2, y + 118 + i * 34, 19, PALETTE.muted, 'center'));
    text(prompt, FIELD.width / 2, y + height - 36, 20, PALETTE.gold, 'center', '700 ');
    layout.buttons.start = { x: 0, y: 0, w: FIELD.width, h: FIELD.height, enabled: true };
  }

  function drawHelp() {
    const lines = [
      'Each turn you gain embers (1, then 2 … up to 8) and draw a card.',
      'Cards cost embers. Cards of the Wind’s element cost 1 less.',
      'Attacks deal DOUBLE against a ward their element beats, HALF against',
      'a ward that beats them. Ember > Gale > Tide > Stone > Ember.',
      'Play two cards of one element in a turn: the second gets Resonance +2.',
      'Shift your ward once per turn (W) to blunt what the rival plays.',
      'Win a duel by taking the rival to 0 life. Win 2 duels to take the match.',
    ];
    drawPanel('HOW TO PLAY', lines, 'Press H or click to close', null);
  }

  /** Spawn effects for a batch of rule events. */
  function notify(events, match) {
    for (const event of events) {
      if (event.type === 'damage') {
        const target = event.side === 0 ? { x: 162, y: 620 } : { x: 162, y: 130 };
        burst(target.x, target.y, event.doubled ? '#ffd24d' : '#ff5d5d', event.doubled ? 26 : 14);
        floaters.push({
          x: target.x, y: target.y - 20,
          text: `-${event.amount}${event.doubled ? '  WARD BROKEN!' : ''}`,
          color: event.doubled ? PALETTE.gold : '#ff8a8a',
          size: event.doubled ? 30 : 24, life: 1.1,
        });
        shake = Math.max(shake, event.doubled ? 10 : 5);
      } else if (event.type === 'shield') {
        const target = event.side === 0 ? { x: 162, y: 620 } : { x: 162, y: 130 };
        burst(target.x, target.y, '#6f9fd8', 10);
        floaters.push({ x: target.x, y: target.y - 20, text: `+${event.amount} shield`, color: '#9cc3ff', size: 20, life: 1 });
      } else if (event.type === 'heal') {
        const target = event.side === 0 ? { x: 162, y: 620 } : { x: 162, y: 130 };
        burst(target.x, target.y, '#7ee0a3', 10);
        floaters.push({ x: target.x, y: target.y - 20, text: `+${event.amount} life`, color: '#7ee0a3', size: 20, life: 1 });
      } else if (event.type === 'play') {
        flights.push({ card: event.card, side: event.side, t: 0 });
      }
    }
  }

  function draw(match, screen, ui, dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (shake > 0.3) shake *= Math.pow(0.02, dt);
    else shake = 0;
    const sx = (Math.random() - 0.5) * shake;
    const sy = (Math.random() - 0.5) * shake;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    layout = { hand: [], buttons: {} };

    if (screen === SCREEN_TITLE) {
      drawTitle(match, ui.best);
      return;
    }

    // Table backdrop.
    ctx.fillStyle = PALETTE.table;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Top bar.
    text('FOUR WINDS DUEL', 24, 40, 22, PALETTE.gold, 'left', '800 ');
    text(`Duel ${match.duel}  •  First to ${MATCH.duelsToWin}`, 24, 62, 14, PALETTE.muted, 'left');
    const wind = ELEMENT_INFO[windElement(match)];
    ctx.fillStyle = wind.color;
    roundRect(ctx, 540, 14, 200, 40, 20);
    ctx.fill();
    glyph(windElement(match), 566, 34, 20, '#fff');
    text(`Wind: ${wind.name} −1 cost`, 580, 41, 15, '#fff', 'left', '700 ');
    drawButton('help', 1096, 14, 52, 40, '?', true, false);
    drawButton('mute', 1156, 14, 100, 40, ui.muted ? 'MUTED' : 'SOUND', true, false);

    // Opponent hand: face-down fan.
    const oppCount = match.sides[1].hand.length;
    for (let i = 0; i < oppCount; i += 1) {
      drawCardBack(620 + i * 46, 78, 58, 84);
    }
    text(`Rival hand: ${oppCount}`, 620, 190, 13, PALETTE.muted, 'left');

    drawSidePanel(match, 1, 24, 72, 'THE LANTERN KEEPER', false);
    drawSidePanel(match, 0, 24, 560, 'YOU', true);
    drawStage(match, ui, screen);
    drawLog(match);
    drawHand(match, ui);

    // Buttons.
    const turnActive = match.phase === 'player';
    drawButton('endTurn', 1040, 600, 216, 56, turnActive ? 'END TURN  (E)' : 'RIVAL’S TURN…', turnActive, true);
    drawButton('ward', 1040, 668, 216, 48, 'SHIFT WARD  (W)', turnActive && !match.sides[0].wardShifted, false);
    text(turnActive ? 'Your turn — play cards, then end turn.' : 'The rival is thinking…', 1148, 748, 13, PALETTE.muted, 'center');
    text(`You dealt ${match.sides[0].damageDealt}  •  Rival dealt ${match.sides[1].damageDealt}`, 1148, 772, 13, PALETTE.muted, 'center');

    // Card flights (played cards sliding to the stage).
    for (let i = flights.length - 1; i >= 0; i -= 1) {
      const f = flights[i];
      f.t += dt * 2.2;
      if (f.t >= 1) {
        flights.splice(i, 1);
        continue;
      }
      const fromX = f.side === 0 ? 640 : 640;
      const fromY = f.side === 0 ? 660 : 120;
      const toX = f.side === 0 ? 580 : 300;
      const toY = 262;
      const x = fromX + (toX - fromX) * f.t;
      const y = fromY + (toY - fromY) * f.t - Math.sin(f.t * Math.PI) * 60;
      ctx.globalAlpha = 0.9;
      drawCard(f.card, x, y, 120, 168, { compact: true });
      ctx.globalAlpha = 1;
    }

    drawParticles(dt);

    if (screen === SCREEN_DUELOVER) {
      const won = match.sides[0].duelsWon > match.sides[1].duelsWon || match.log.join(' ').includes('You won');
      const lastDuelWon = match.sides[0].hp > 0;
      drawPanel(
        lastDuelWon ? 'DUEL WON' : 'DUEL LOST',
        [`Duels — You ${match.sides[0].duelsWon}  •  Rival ${match.sides[1].duelsWon}`, won ? 'One more duel takes the match.' : 'The rival needs one more duel.'],
        'Press SPACE for the next duel',
        lastDuelWon ? PALETTE.gold : null,
      );
    } else if (screen === SCREEN_MATCHOVER) {
      const won = match.winner === 0;
      drawPanel(
        won ? 'VICTORY' : 'DEFEAT',
        [
          `Duels — You ${match.sides[0].duelsWon}  •  Rival ${match.sides[1].duelsWon}`,
          `Damage dealt — You ${match.sides[0].damageDealt}  •  Rival ${match.sides[1].damageDealt}`,
          `Duels played: ${match.duel}  •  Turns: ${match.turn}`,
        ],
        'Press SPACE to play again',
        won ? PALETTE.gold : null,
      );
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The lanterns wait for you.'], 'Press P to resume', null);
    }
    if (ui.helpOpen) drawHelp();
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    draw,
    notify,
    /** Convert canvas pixels to logical playfield coordinates. */
    toLogical(px, py) {
      return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
    },
    getLayout() {
      return layout;
    },
  };
}
