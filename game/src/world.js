// Neon Harbor — the world: a seeded 400x400 m sunset city, its traffic, pedestrians
// and police, and one fixed-step simulation of all of them. Rendering lives in
// render.js; this file owns only data and rules.
import { CITY, ROAD_STEP, ROAD_HALF, BLOCK, PLAYER, CAR, TRAFFIC_CARS, PEDESTRIANS, WANTED } from './config.js';
import { makeRng, nearestRoad, clamp, dist2, angleLerp } from './random.js';

const HALF = CITY / 2;
export const PALETTE = [0x2e4a7a, 0x7a2e4a, 0x2e7a6a, 0x6a5a2e, 0x4a2e7a, 0x8a5a2e, 0x3a3a4e];
export const CAR_COLORS = [0xd8384f, 0x38b6d8, 0xe8c838, 0x38d878, 0xd8d8d8, 0x30343e, 0xb678d8, 0xe87838];

/** Build the static city from a seed: buildings, lamps, pier, landmarks. */
export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  // Buildings sit at block centres (roads run on multiples of 40, blocks on the
  // +20 offset), so no building ever stands on a road.
  for (let gx = -HALF + ROAD_STEP / 2; gx < HALF; gx += ROAD_STEP) {
    for (let gz = -HALF + ROAD_STEP / 2; gz < HALF; gz += ROAD_STEP) {
      // Leave the central plaza and the pier road clear.
      if (Math.abs(gx) < 45 && Math.abs(gz) < 45) continue;
      if (gz > HALF - ROAD_STEP - 1) continue;
      const n = rng.chance(0.3) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const w = rng.range(12, 24), d = rng.range(12, 24);
        // Keep every building inside its block: clamp the offset so no wall
        // ever pokes into a road (that used to trap cars on the road edge).
        const base = n === 1 ? 0 : (i === 0 ? -7 : 7);
        const ox = clamp(base + rng.range(-3, 3), -(BLOCK / 2 - 1 - w / 2), BLOCK / 2 - 1 - w / 2);
        const oz = clamp(rng.range(-3, 3), -(BLOCK / 2 - 1 - d / 2), BLOCK / 2 - 1 - d / 2);
        const x = gx + ox;
        const z = gz + oz;
        const h = rng.range(10, 58) * (Math.abs(gx) < 90 && Math.abs(gz) < 90 ? 1.5 : 1);
        buildings.push({ x, z, w, d, h: Math.min(h, 72), color: rng.pick(PALETTE), roof: rng.chance(0.4) });
      }
    }
  }
  const lamps = [];
  for (let v = -HALF + ROAD_STEP; v <= HALF - ROAD_STEP; v += ROAD_STEP) {
    lamps.push({ x: v + ROAD_HALF + 1, z: -HALF + 12 }, { x: v - ROAD_HALF - 1, z: HALF - 12 });
    lamps.push({ x: -HALF + 12, z: v + ROAD_HALF + 1 }, { x: HALF - 12, z: v - ROAD_HALF - 1 });
  }
  return {
    buildings, lamps,
    plaza: { x: 0, z: 0 },
    pier: { x: 0, z: HALF + 22 },          // boardwalk over the water, south edge
    bank: { x: -80, z: -80 }, hotel: { x: 80, z: 80 }, garage: { x: -120, z: 120 },
    marina: { x: 120, z: -120 },
  };
}

/** A rectangular loop of road waypoints around one city block. */
function loopWaypoints(rng, cx, cz) {
  const r = ROAD_STEP / 2;
  const corners = [[cx - r, cz - r], [cx + r, cz - r], [cx + r, cz + r], [cx - r, cz + r]];
  const start = rng.int(0, 3);
  const pts = [];
  for (let i = 0; i < 4; i++) pts.push(corners[(start + i) % 4]);
  return pts;
}

function makeTrafficCar(rng, id) {
  // Loop around a block centre (the +20 offset), so its corners run along roads.
  const cx = nearestRoad(rng.range(-160, 160)) + ROAD_STEP / 2;
  const cz = nearestRoad(rng.range(-160, 160)) + ROAD_STEP / 2;
  const pts = loopWaypoints(rng, cx, cz);
  return {
    id, kind: 'traffic', x: pts[0][0], z: pts[0][1], angle: 0, speed: rng.range(7, 11),
    color: rng.pick(CAR_COLORS), waypoints: pts, wp: 1, health: CAR.maxHealth, police: false, ramCd: 0,
  };
}

function makePed(rng, id) {
  const onXRoad = rng.chance(0.5);
  const road = nearestRoad(rng.range(-160, 160));
  const along = rng.range(-180, 180);
  return {
    id, kind: 'ped',
    x: onXRoad ? road + ROAD_HALF + 1.5 : along,
    z: onXRoad ? along : road + ROAD_HALF + 1.5,
    angle: rng.range(0, Math.PI * 2), speed: rng.range(1.1, 1.9),
    walkPhase: rng.range(0, 6), down: false, downTimer: 0, flee: 0,
    color: rng.pick([0xe8e8e8, 0x38b6d8, 0xd8384f, 0xe8c838, 0x7dff9a, 0xb678d8]),
    roadAxis: onXRoad ? 'x' : 'z', roadLine: road, dir: rng.chance(0.5) ? 1 : -1,
  };
}

/** Fresh game state. `save` restores cash / mission progress from localStorage. */
export function createState(seed, save) {
  const rng = makeRng(seed * 7919 + 13);
  const city = buildCity(seed);
  const cars = [];
  for (let i = 0; i < TRAFFIC_CARS; i++) cars.push(makeTrafficCar(rng, i));
  const peds = [];
  for (let i = 0; i < PEDESTRIANS; i++) peds.push(makePed(rng, i));
  return {
    seed, rng, city, cars, peds,
    police: [], policeTimer: 0, nextCarId: 1000,
    time: 0, cash: save?.cash ?? 40, health: PLAYER.maxHealth,
    wanted: 0, wantedTimer: 0, lastSeen: 0,
    missionIndex: save?.missionIndex ?? 0, missionsDone: save?.missionsDone ?? 0,
    player: {
      x: 6, z: 24, angle: Math.PI, speed: 0, onFoot: true, car: null,
      punchCd: 0, carHealth: CAR.maxHealth, sprinting: false,
    },
    camYaw: Math.PI, camPitch: 0.32,
    events: [], // {type, ...} drained by main.js each frame (sounds, toasts, game over)
    stats: { carsStolen: 0, pedsHit: 0, punches: 0, distance: 0 },
    over: null, // 'busted' | 'wasted' | null
    won: false, freeRoam: false,
  };
}

function pushEvent(state, e) { state.events.push(e); }

export function addWanted(state, n, reason) {
  if (state.wanted >= WANTED.maxStars) return;
  state.wanted = Math.min(WANTED.maxStars, state.wanted + n);
  state.wantedTimer = 0;
  pushEvent(state, { type: 'wanted', stars: state.wanted, reason });
}

/** Circle vs building AABB push-out; returns true on hit. */
function collideBuildings(state, x, z, r) {
  for (const b of state.city.buildings) {
    const nx = clamp(x, b.x - b.w / 2, b.x + b.w / 2);
    const nz = clamp(z, b.z - b.d / 2, b.z + b.d / 2);
    if (dist2(x, z, nx, nz) < r * r) return b;
  }
  return null;
}

function resolveCollision(state, ent, r) {
  const b = collideBuildings(state, ent.x, ent.z, r);
  if (!b) return false;
  // Push out along the smallest penetration axis.
  const dx = ent.x - b.x, dz = ent.z - b.z;
  const px = b.w / 2 + r - Math.abs(dx), pz = b.d / 2 + r - Math.abs(dz);
  if (px < pz) ent.x = b.x + Math.sign(dx || 1) * (b.w / 2 + r);
  else ent.z = b.z + Math.sign(dz || 1) * (b.d / 2 + r);
  ent.x = clamp(ent.x, -HALF, HALF); ent.z = clamp(ent.z, -HALF, HALF);
  return true;
}

function nearestCar(state, x, z, maxD, filter) {
  let best = null, bestD = maxD * maxD;
  for (const c of state.cars) {
    if (filter && !filter(c)) continue;
    const d = dist2(x, z, c.x, c.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

/** Steal (or enter) the nearest drivable car; E again exits the car. */
export function tryEnterCar(state) {
  const p = state.player;
  if (!p.onFoot) {
    // Exit the car: leave it parked where it is.
    const car = p.car;
    car.speed = 0; car.traffic = true; car.waypoints = loopWaypoints(state.rng, nearestRoad(car.x) + ROAD_STEP / 2, nearestRoad(car.z) + ROAD_STEP / 2); car.wp = 0;
    p.x = car.x + Math.sin(car.angle + Math.PI / 2) * 3;
    p.z = car.z + Math.cos(car.angle + Math.PI / 2) * 3;
    p.angle = car.angle; p.onFoot = true; p.car = null; p.carHealth = CAR.maxHealth;
    pushEvent(state, { type: 'exit-car' });
    return;
  }
  const car = nearestCar(state, p.x, p.z, 4.5, (c) => !c.police);
  if (!car) return;
  car.traffic = false;
  p.car = car; p.onFoot = false; p.carHealth = car.health;
  p.angle = car.angle;
  state.stats.carsStolen += 1;
  addWanted(state, WANTED.steal, 'car stolen');
  pushEvent(state, { type: 'steal', carId: car.id });
}

/** Punch: knock down the nearest pedestrian (or cop on foot) in front of the player. */
export function tryPunch(state) {
  const p = state.player;
  if (!p.onFoot || p.punchCd > 0) return;
  p.punchCd = PLAYER.punchCooldown;
  const fx = p.x + Math.sin(p.angle) * 1.4, fz = p.z + Math.cos(p.angle) * 1.4;
  for (const ped of state.peds) {
    if (ped.down) continue;
    if (dist2(fx, fz, ped.x, ped.z) < PLAYER.punchRange * PLAYER.punchRange) {
      ped.down = true; ped.downTimer = 6;
      state.stats.punches += 1;
      addWanted(state, WANTED.punch, 'assault');
      pushEvent(state, { type: 'punch' });
      return;
    }
  }
  pushEvent(state, { type: 'punch-miss' });
}

function stepPlayerOnFoot(state, dt, input) {
  const p = state.player;
  p.punchCd = Math.max(0, p.punchCd - dt);
  const fwd = (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0)
    - (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? 1 : 0);
  const strafe = (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0)
    - (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0);
  p.sprinting = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const speed = p.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  if (fwd || strafe) {
    const yaw = state.camYaw;
    const mx = Math.sin(yaw) * fwd + Math.cos(yaw) * strafe;
    const mz = Math.cos(yaw) * fwd - Math.sin(yaw) * strafe;
    const len = Math.hypot(mx, mz) || 1;
    p.x += (mx / len) * speed * dt;
    p.z += (mz / len) * speed * dt;
    p.angle = angleLerp(p.angle, Math.atan2(mx / len, mz / len), Math.min(1, dt * 12));
    p.speed = speed;
    state.stats.distance += speed * dt;
  } else p.speed = 0;
  p.x = clamp(p.x, -HALF, HALF); p.z = clamp(p.z, -HALF, HALF);
  if (resolveCollision(state, p, PLAYER.radius)) p.speed *= 0.4;
}

function stepPlayerCar(state, dt, input) {
  const p = state.player, car = p.car;
  const throttle = (input.keys.has('KeyW') || input.keys.has('ArrowUp') ? 1 : 0)
    - (input.keys.has('KeyS') || input.keys.has('ArrowDown') ? 1 : 0);
  const steer = (input.keys.has('KeyA') || input.keys.has('ArrowLeft') ? 1 : 0)
    - (input.keys.has('KeyD') || input.keys.has('ArrowRight') ? 1 : 0);
  const braking = input.keys.has('Space');
  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  if (braking) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.brake * dt);
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const turn = steer * CAR.turnRate * dt * clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed >= 0 ? 1 : -1);
  car.angle += turn;
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  car.x = clamp(car.x, -HALF - 30, HALF + 30); car.z = clamp(car.z, -HALF, HALF + 30);
  if (resolveCollision(state, car, CAR.radius)) {
    if (Math.abs(car.speed) > 12) damageCar(state, Math.abs(car.speed) * 0.9);
    car.speed *= -0.25;
  }
  p.x = car.x; p.z = car.z; p.angle = car.angle; p.speed = Math.abs(car.speed);
  state.stats.distance += Math.abs(car.speed) * dt;
  // Running over pedestrians is a crime, and it hurts.
  for (const ped of state.peds) {
    if (ped.down) continue;
    if (dist2(car.x, car.z, ped.x, ped.z) < 2.6 * 2.6 && Math.abs(car.speed) > 3) {
      ped.down = true; ped.downTimer = 8; ped.flee = 0;
      state.stats.pedsHit += 1;
      addWanted(state, WANTED.hitPed, 'pedestrian struck');
      pushEvent(state, { type: 'hit-ped' });
      car.speed *= 0.7;
    }
  }
  // Ramming a police car raises the heat — but a ram is one impulse with a
  // cooldown, not a per-frame penalty that would pin the player forever.
  for (const pc of state.police) {
    if (pc === car) continue;
    if (dist2(car.x, car.z, pc.x, pc.z) < 3.4 * 3.4 && pc.ramCd <= 0) {
      if (Math.abs(car.speed) > 6) { addWanted(state, WANTED.ramPolice, 'police rammed'); damageCar(state, 6); }
      car.speed *= 0.5; pc.speed *= 0.5;
      pc.ramCd = 0.8;
    }
  }
}

function damageCar(state, n) {
  const p = state.player;
  p.carHealth = Math.max(0, p.carHealth - n);
  if (p.car) p.car.health = p.carHealth;
  if (p.carHealth <= 0 && !p.onFoot) {
    pushEvent(state, { type: 'car-wrecked' });
    const car = p.car;
    car.speed = 0; car.traffic = false;
    p.onFoot = true; p.car = null; p.carHealth = CAR.maxHealth;
    p.x = car.x + 3; p.z = car.z + 3;
  }
}

function damagePlayer(state, n) {
  state.health = Math.max(0, state.health - n);
  if (state.health <= 0 && !state.over) {
    state.over = 'wasted';
    pushEvent(state, { type: 'game-over', reason: 'wasted' });
  }
}

function stepTraffic(state, dt) {
  for (const car of state.cars) {
    if (!car.traffic) continue;
    car.ramCd = Math.max(0, (car.ramCd || 0) - dt);
    const target = car.waypoints[car.wp];
    const dx = target[0] - car.x, dz = target[1] - car.z;
    const want = Math.atan2(dx, dz);
    car.angle = angleLerp(car.angle, want, Math.min(1, dt * 3));
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    if (dist2(car.x, car.z, target[0], target[1]) < 9) car.wp = (car.wp + 1) % car.waypoints.length;
    // Keep traffic on the roads: nudge back if it drifts into a block.
    if (collideBuildings(state, car.x, car.z, 1.2)) { car.wp = (car.wp + 1) % car.waypoints.length; car.angle += Math.PI / 2; }
  }
}

function stepPeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.down) { ped.downTimer -= dt; if (ped.downTimer <= 0) { ped.down = false; ped.flee = 6; } continue; }
    ped.walkPhase += dt * 6;
    const p = state.player;
    const dPlayer = dist2(ped.x, ped.z, p.x, p.z);
    if (ped.flee > 0) {
      ped.flee -= dt;
      const away = Math.atan2(ped.x - p.x, ped.z - p.z);
      ped.x += Math.sin(away) * 4 * dt; ped.z += Math.cos(away) * 4 * dt;
      ped.angle = away;
    } else if (!p.onFoot && Math.abs(p.speed) > 10 && dPlayer < 100) {
      ped.flee = 2; // run from a speeding car
    } else {
      const along = ped.roadAxis === 'x' ? ped.x : ped.z;
      const next = along + ped.dir * ped.speed * dt;
      if (next > HALF - 8 || next < -HALF + 8) ped.dir *= -1;
      if (ped.roadAxis === 'x') { ped.x = next; ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { ped.z = next; ped.angle = ped.dir > 0 ? 0 : Math.PI; }
    }
    ped.x = clamp(ped.x, -HALF, HALF); ped.z = clamp(ped.z, -HALF, HALF);
  }
}

function spawnPolice(state) {
  const p = state.player;
  const angle = state.rng.range(0, Math.PI * 2);
  const d = 55;
  const car = {
    id: state.nextCarId++, kind: 'police',
    x: clamp(p.x + Math.sin(angle) * d, -HALF, HALF),
    z: clamp(p.z + Math.cos(angle) * d, -HALF, HALF),
    angle: 0, speed: 0, color: 0xf2f2f2, police: true, traffic: false, health: CAR.maxHealth, ramCd: 0,
  };
  state.cars.push(car);
  state.police.push(car);
  pushEvent(state, { type: 'police-spawn' });
}

function stepPolice(state, dt) {
  const p = state.player;
  const want = Math.min(WANTED.maxPolice, Math.ceil(state.wanted / 1));
  state.policeTimer -= dt;
  if (state.wanted > 0 && state.police.length < want && state.policeTimer <= 0) {
    state.policeTimer = WANTED.spawnInterval;
    spawnPolice(state);
  }
  if (state.wanted === 0 && state.police.length > 0) {
    // Cops give up and drive off when the heat dies.
    for (const pc of state.police) { pc.traffic = true; pc.police = false; pc.waypoints = loopWaypoints(state.rng, nearestRoad(pc.x) + ROAD_STEP / 2, nearestRoad(pc.z) + ROAD_STEP / 2); pc.wp = 0; }
    state.police = [];
  }
  for (const pc of state.police) {
    pc.ramCd = Math.max(0, (pc.ramCd || 0) - dt);
    const dx = p.x - pc.x, dz = p.z - pc.z;
    const d = Math.hypot(dx, dz) || 1;
    const wantAngle = Math.atan2(dx, dz);
    const targetSpeed = d > 6 ? 34 : 12;
    pc.speed += clamp(targetSpeed - pc.speed, -30 * dt, 18 * dt);
    pc.angle = angleLerp(pc.angle, wantAngle, Math.min(1, dt * 2.2));
    pc.x += Math.sin(pc.angle) * pc.speed * dt;
    pc.z += Math.cos(pc.angle) * pc.speed * dt;
    if (!resolveCollision(state, pc, CAR.radius)) { /* keep moving */ }
    // Ram the player: damage the car, or bust them on foot.
    if (d < 3.2) {
      if (p.onFoot) {
        state.over = 'busted';
        pushEvent(state, { type: 'game-over', reason: 'busted' });
      } else {
        damageCar(state, 10 * dt);
        if (Math.abs(p.speed) < 2 && state.wanted >= 4) {
          state.over = 'busted';
          pushEvent(state, { type: 'game-over', reason: 'busted' });
        }
      }
    }
  }
}

/** Push overlapping cars apart so police and traffic never interpenetrate. */
function separateCars(state) {
  const all = state.cars;
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 3.4) {
        const push = (3.4 - d) / 2;
        const nx = dx / d, nz = dz / d;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
      }
    }
  }
}

function stepWanted(state, dt) {
  if (state.wanted === 0) return;
  const p = state.player;
  const nearestCop = state.police.reduce((m, pc) => Math.min(m, Math.hypot(pc.x - p.x, pc.z - p.z)), Infinity);
  if (nearestCop > 70) state.lastSeen += dt; else state.lastSeen = 0;
  if (state.lastSeen > WANTED.decayDelay) {
    state.wantedTimer += dt;
    if (state.wantedTimer >= WANTED.decayRate * 9) {
      state.wanted -= 1; state.wantedTimer = 0;
      pushEvent(state, { type: 'wanted', stars: state.wanted, reason: 'heat cooling' });
      if (state.wanted === 0) state.lastSeen = 0;
    }
  }
}

/** Advance the world one fixed step. `input` is the live input state. */
export function stepWorld(state, dt, input) {
  if (state.over) return;
  state.time += dt;
  if (state.player.onFoot) stepPlayerOnFoot(state, dt, input);
  else stepPlayerCar(state, dt, input);
  stepTraffic(state, dt);
  stepPeds(state, dt);
  stepPolice(state, dt);
  separateCars(state);
  stepWanted(state, dt);
  // Slow health regen out of trouble.
  if (state.wanted === 0 && state.health < PLAYER.maxHealth) state.health = Math.min(PLAYER.maxHealth, state.health + 1.2 * dt);
  // Falling in the water at the pier edge hurts.
  if (state.player.z > HALF + 18) damagePlayer(state, 30 * dt);
}
