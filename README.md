# Bug Blaster

An HTML5 canvas game written in TypeScript: you are a developer defending your codebase by shooting down computer bugs before they reach you.

## Gameplay

- Move the dev with **A/D** or **←/→**
- Aim with the mouse, shoot with **click** or **Space**
- Bugs (syntax errors, logic bugs, memory leaks) crawl down the screen — squash them before they slip past, or you lose a life

## Development

```sh
npm install
npm run dev        # start dev server
npm run build      # typecheck + production build
npm run typecheck  # typecheck only
```

## Project structure

```
index.html            # canvas + entry point
src/
  main.ts             # bootstraps the game
  engine/             # game loop, input, scene interface
  entities/           # player, bug, bullet
  scenes/             # game scenes (play scene for now)
public/assets/        # sprites and audio (placeholders for now)
```

## Roadmap

- [ ] Sprite art and sound effects
- [ ] Bug variety: different speeds, hit points, and movement patterns
- [ ] Waves / difficulty ramp
- [ ] Title and game-over scenes
- [ ] Power-ups (coffee, rubber duck, linter beam)
