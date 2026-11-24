[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/guosongyi427-creator/neon-harbor/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/guosongyi427-creator/neon-harbor/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Harbor

An original open-world crime game in the spirit of GTA 6, built for the
[make.fun bounty **gta6-01 "Make GTA 6"**](https://make.fun/c/gta6-01).
Everything — city, characters, vehicles, names, story, art and sound — is
original. Nothing from Rockstar Games or any other commercial game.

You are **Jax Marlow**, a wheelman fresh out of lockup, back in Neon Harbor
with $40 and a debt to the Harbor Crew. Steal cars, outrun the Harbor PD, and
run six story jobs — from a first joyride to **The Big Score** — to buy your
freedom.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request: `game/index.html` runs offline from static
files in a desktop browser. three.js 0.160.0 is vendored under
`game/vendor/three.module.js` (MIT).

## What's in the game

- **A 400 × 400 m sunset city** — procedural buildings with lit windows,
  streetlights, a central plaza, a pier and a moored boat over the water.
- **On foot and by car** — third-person chase camera, mouse-drag look,
  sprinting, arcade driving with braking and collisions.
- **Traffic and pedestrians** — 14 traffic cars looping the street grid and
  26 pedestrians who walk the sidewalks and flee speeding cars.
- **Car stealing** — walk up to any car and press **E** to take it (the
  Harbor PD notices). Press **E** again to get out.
- **5-star wanted system** — stealing, punching and hitting pedestrians raise
  the heat; Harbor PD cars spawn, chase and ram you. Lose them and the stars
  cool down; get caught on foot and you're **Busted**.
- **6 story missions with cash payouts** — First Wheels ($500), Hot Courier
  ($800), Night Taxi ($1,200), Heat Run ($1,500), Dead Drops ($2,000) and
  The Big Score ($10,000) — then free roam.
- **Combat** — punch with **F**; cars can be wrecked, health regenerates
  out of trouble.
- **HUD with live 2D minimap** — cash, health, wanted stars, speed, mission
  brief with distance to the objective beacon, and a top-down map showing
  traffic, police, pedestrians and objectives.
- **Sound, all synthesized** — WebAudio engine hum, two-tone police sirens,
  cash blips and mission jingles. No audio files. **M** mutes.
- **Start / pause / game-over / win screens** and a **localStorage save** —
  cash and mission progress carry on between sessions.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse drag | Look |
| E | Steal / enter / exit car |
| F | Punch |
| Space | Brake |
| Shift | Sprint |
| P / Esc | Pause |
| M | Mute |

## Screenshots

Deterministic scenes (`game/src/shots.js`, `shots.json`):

| File | Scene |
| --- | --- |
| `screenshots/1-start.jpg` | `?shot=start` — title screen over the living city |
| `screenshots/2-play.jpg` | `?shot=play` — mid-chase: 3 stars, PD on your tail, Heat Run live |
| `screenshots/3-end.jpg` | `?shot=end` — busted after a chase |

## Layout

```
main.ts                  entry program: copies game/ + screenshots/ to /output,
                         writes /output/dossier.json (Node 22 stdlib only)
serve.ts                 static dev server (node serve.ts -> :8080)
shots.json               screenshot scenes
vendor/makefun-game.ts   make.fun dossier library (kit copy, unchanged)
game/index.html          page, HUD, screens, import map
game/src/config.js       tuning constants
game/src/random.js       seeded RNG (deterministic city)
game/src/world.js        city gen, traffic, pedestrians, police, wanted, driving
game/src/missions.js     six story missions
game/src/render.js       three.js scene, HUD, minimap
game/src/input.js        keyboard + mouse-drag look
game/src/audio.js        WebAudio synth sound
game/src/shots.js        deterministic ?shot= scenes
game/src/main.js         game loop, screens, save/load
game/vendor/three.module.js  three.js 0.160.0 (MIT)
```

## License

MIT — see [LICENSE](LICENSE). three.js is MIT-licensed; its license header is
in `game/vendor/three.module.js`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=q706rq75&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
