# Bug Blaster

An HTML5 canvas game written in TypeScript. You are a frustrated developer at your desk, blasting code bugs as they rush down a neon corridor toward production. Pseudo-3D rendering, synthesized audio, and a RAGE meter, all in Canvas 2D with zero runtime dependencies and no asset files.

## Gameplay

- Move the dev with **A/D** or **←/→**; on touch, drag to move (auto-fires while touching)
- Aim with the mouse, shoot with **click** or **Space**
- Bugs spawn tiny at the horizon and grow as they approach. Squash them before they reach your desk, or they ship to production and you lose a coffee
- Six bug kinds with their own behavior: `missing ;`, `undefined is not a function`, `off-by-one` (fixing it spawns another), `memory leak` (grows and takes 3 hits), `race condition` (jitters and teleports), `works on my machine` (shrugs off the first hit)
- Missed bugs fill the **RAGE** meter. When it's full, press **Shift** / **E** (or tap the RAGE button, or two-finger tap) to unleash an ultimate like `git push --force` or `rm -rf node_modules`
- Every 100 points is a new sprint: faster spawns, faster bugs, nastier kinds unlock
- Run out of coffee and you get a Production Incident Postmortem
- **M** toggles sound (persists between visits)

## Development

```sh
npm install
npm run dev        # start dev server
npm run build      # typecheck + production build
npm run typecheck  # typecheck only
```

## Project structure

```
index.html              # canvas + control hints
src/
  main.ts               # bootstraps the game into the title scene
  engine/               # game loop, input (keys/mouse/touch), scene interface, Web Audio synth
  render/               # projection math, background corridor, sprite cache, bug/dev art, HUD, camera shake
  fx/                   # particle pool, floating text, effects facade
  content/              # bug kind table + difficulty, quips, ultimates
  systems/              # rage meter, run stats
  entities/             # player, bug, bullet (world-space lane/depth coordinates)
  scenes/               # title, play, game over (postmortem)
public/assets/          # intentionally empty: everything is drawn and synthesized at runtime
```

### How the pseudo-3D works

Entities live in world coordinates: `lane` in [-1, 1] across the corridor and `z` in [0, 1] from the horizon to the player's desk. `src/render/projection.ts` maps those to screen position and scale with a true perspective ratio, so bugs accelerate toward the camera and bullets shrink into the vanishing point. Collision runs in screen space using the projected radii, with a depth tolerance so a near bullet can't hit a far bug it merely overlaps.

## Roadmap

- [x] Pseudo-3D corridor, shaded sprites, particles, screen shake
- [x] Synthesized sound effects and music
- [x] Bug variety: different speeds, hit points, and movement patterns
- [x] Sprints / difficulty ramp
- [x] Title and game-over scenes
- [x] RAGE meter and ultimates
- [ ] Power-ups (coffee refill, rubber duck, linter beam)
- [ ] Boss bug: "the legacy monolith"
- [ ] High score table
