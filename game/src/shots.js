// Neon Harbor — deterministic screenshot scenes behind ?shot=start|play|end.
// Each scene plays the real simulation forward from a fresh seeded world with a
// simple autopilot, so the frame is what the game really looks like and the same
// seed always gives the same frame. Sets window.__shotReady when the frame is drawn.
import { STEP } from './config.js';
import { startMission, currentObjective } from './missions.js';
import { addWanted } from './world.js';

/** True when the point `ahead` metres in front of (x,z) along `angle` is inside a building. */
function blockedAhead(state, x, z, angle, ahead) {
  const px = x + Math.sin(angle) * ahead, pz = z + Math.cos(angle) * ahead;
  for (const b of state.city.buildings) {
    if (Math.abs(px - b.x) < b.w / 2 + 2.5 && Math.abs(pz - b.z) < b.d / 2 + 2.5) return true;
  }
  return false;
}

/** Drive toward the objective: throttle, steer to the marker, brake near it. */
function autopilot(state, input) {
  const obj = currentObjective(state);
  const p = state.player;
  input.keys.clear();
  if (!obj) { input.keys.add('KeyW'); return; }
  if (p.onFoot) {
    // On foot: walk toward the nearest car to steal it (mission 1).
    const dx = obj.x - p.x, dz = obj.z - p.z;
    const want = Math.atan2(dx, dz);
    let d = want - state.camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    state.camYaw = want;
    input.keys.add('KeyW');
    if (Math.hypot(dx, dz) < 3) input.keys.add('KeyE');
    return;
  }
  const dx = obj.x - p.x, dz = obj.z - p.z;
  const want = Math.atan2(dx, dz);
  let d = want - p.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) > 0.5) input.keys.add(d > 0 ? 'KeyA' : 'KeyD');
  // Steer around a building straight ahead instead of ramming it.
  if (blockedAhead(state, p.x, p.z, p.angle, 10)) {
    const leftClear = !blockedAhead(state, p.x, p.z, p.angle + 0.9, 10);
    input.keys.add(leftClear ? 'KeyA' : 'KeyD');
  }
  input.keys.add('KeyW');
  if (Math.hypot(dx, dz) < 12) input.keys.add('Space');
}

/**
 * Stage a scene on a live game object (see main.js). Returns the screen to show:
 * 'title' | 'play' | 'over'. `game` exposes state, step(dt, input), input, applyShotPose.
 */
export function stageShot(name, game) {
  const state = game.state;
  if (name === 'play') {
    // Mid-chase: player in a stolen car, 3 stars, police on the tail, mission 4 live.
    state.missionIndex = 3;
    game.startGame(); // starts HEAT RUN, which adds 3 wanted stars
    state.cash = 2450;
    // Put the player in a stolen car on the x=-120 road, facing straight down it
    // toward the hideout at (-120, 120): a clean run with the PD on the tail.
    const car = state.cars.find((c) => !c.police);
    car.traffic = false;
    car.x = -120; car.z = -40; car.angle = 0; car.speed = 0;
    state.player.car = car; state.player.onFoot = false;
    state.player.x = car.x; state.player.z = car.z; state.player.angle = car.angle;
    state.camYaw = car.angle;
    for (let i = 0; i < 5 / STEP; i++) {
      autopilot(state, game.input);
      game.step(STEP);
      if (state.over) break;
    }
    return 'play';
  }
  if (name === 'end') {
    // Busted after a chase: drive 6 s, then let the cops close in.
    state.missionIndex = 4;
    game.startGame(); // starts DEAD DROPS
    state.cash = 3120;
    addWanted(state, 4, 'bank job');
    const car = state.cars.find((c) => !c.police);
    car.traffic = false;
    state.player.car = car; state.player.onFoot = false;
    state.player.x = car.x; state.player.z = car.z; state.player.angle = car.angle;
    state.camYaw = car.angle;
    for (let i = 0; i < 6 / STEP; i++) { autopilot(state, game.input); game.step(STEP); }
    // Stop the car so the police catch the player on foot: drop them beside the nearest cop.
    if (state.player.car) { state.player.car.speed = 0; }
    state.player.onFoot = true; state.player.car = null;
    const cop = state.police[0];
    if (cop) { state.player.x = cop.x + 1; state.player.z = cop.z + 1; }
    for (let i = 0; i < 3 / STEP && !state.over; i++) game.step(STEP);
    if (!state.over) { state.over = 'busted'; state.events.push({ type: 'game-over', reason: 'busted' }); }
    return 'over';
  }
  // start: title screen over a living city vista — traffic and pedestrians moving.
  game.state.time = 0;
  for (let i = 0; i < 5 / STEP; i++) game.stepAmbient(STEP);
  state.camYaw = Math.PI * 0.78;
  state.camPitch = 0.22;
  state.player.x = -6; state.player.z = 40;
  return 'title';
}
