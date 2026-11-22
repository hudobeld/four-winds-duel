# Four Winds Duel

[![make.fun](https://make.fun/badge/best-card-game-20261122-1826.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![rank](https://make.fun/badge/best-card-game-20261122-1826/hudobeld/four-winds-duel/rank.svg)](https://make.fun/bounty/best-card-game-20261122-1826)
[![reward](https://make.fun/badge/best-card-game-20261122-1826/hudobeld/four-winds-duel/reward.svg)](https://make.fun/bounty/best-card-game-20261122-1826)

A turn-based elemental card duel for the [make.fun best card game bounty](https://make.fun/bounty/best-card-game-20261122-1826). Best of three duels, 30 life each, against a rival who actually thinks: it reads your favourite element and shifts its ward to counter it, saves shields for when it is hurt, and always takes lethal when it sees it.

## How it plays

- Each turn you gain embers (1, then 2 … up to 8) and draw a card. Cards cost embers.
- Four elements in a cycle — **Ember > Gale > Tide > Stone > Ember** — each told apart by colour *and* shape. Attacks deal **double** against a ward their element beats and **half** against a ward that beats them.
- The **Wind** changes every turn: cards of the Wind's element cost 1 less.
- **Resonance**: play two cards of one element in a turn and the second gets +2.
- Shift your own ward once per turn (W) to blunt what the rival is playing.
- Win a duel by taking the rival to 0 life. Win 2 duels to take the match.

## Controls

Click a card to select it, click again (or press its number key 1–7) to play it. **E** ends the turn, **W** shifts ward, **H** shows the rules, **M** mutes, **P** pauses, **Space** starts / continues.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Static files only — `game/index.html` and its ES modules, no network requests, no build step. All art is drawn in code and all sound is synthesised WebAudio.

## Verification

- `node ../work/test-logic.mjs` — 21 logic checks: the element cycle, ward
  multipliers, Resonance, Wind discounts, shields, AI lethal-taking, full
  matches terminating for 30 seeds (autopilot wins 18/30 — a fair fight),
  determinism (same seed, same event log), and the screenshot scenes.
- `node ../work/shots.mjs` — headless Chromium: the four staged shots,
  byte-identical re-renders, a full autoplay win and loss, one real
  interactive turn by mouse and keyboard, zero console errors, zero failed
  requests, zero non-local requests.
- See `../work/VERIFICATION.md` for the full checklist and results.

- `game/src/cards.js` — the 24-card pool, the element cycle, ward maths
- `game/src/deck.js` — decks, drawing, reshuffling the discard pile
- `game/src/rules.js` — the match state machine (duels, turns, Resonance, Wind)
- `game/src/ai.js` — the rival's heuristic brain, and the autopilot used by playtests
- `game/src/render.js` — canvas drawing, card art, particles, floating numbers
- `game/src/input.js` — keyboard and pointer input
- `game/src/audio.js` — synthesised sound effects
- `game/src/shots.js` — the staged screenshot scenes
- `game/src/main.js` — boot, screens, the game loop
- `work/` — verification: logic tests, headless playtests, screenshot runs (see `work/VERIFICATION.md`)
