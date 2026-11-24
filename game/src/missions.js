// Neon Harbor — six story missions for Jax Marlow. Each mission is a small state
// machine: an objective marker on the map, a completion test, and a cash payout.
// The manager is pure logic; render.js draws the marker, main.js shows the brief.
import { MISSIONS } from './config.js';
import { dist2 } from './random.js';
import { addWanted } from './world.js';

function at(state, x, z, r) {
  return dist2(state.player.x, state.player.z, x, z) < r * r;
}

export function missionDefs(state) {
  const c = state.city;
  return [
    {
      ...MISSIONS[0],
      brief: 'You need wheels. Find a parked or passing car, walk up to it and press E to take it. The Harbor PD will notice — that is the job.',
      objective: null, // any car; the marker follows the nearest car
      start(s) { s.m = { phase: 'steal' }; },
      update(s) { if (!s.player.onFoot) return complete(s, 'Nice. First wheels — the Crew is watching.'); return null; },
    },
    {
      ...MISSIONS[1],
      brief: 'A hot package is waiting at the Marina. Grab a car, pick it up, and run it to the Pier before the timer dies. Cops hate couriers.',
      objective: { x: c.marina.x, z: c.marina.z, label: 'PICK UP THE PACKAGE' },
      start(s) { s.m = { phase: 'pickup', timer: 90 }; },
      update(s) {
        const m = s.m; m.timer -= 1 / 60;
        if (m.timer <= 0) return fail(s, 'Too slow — the buyer walked. The Crew still pays for the next job.');
        if (m.phase === 'pickup' && at(s, c.marina.x, c.marina.z, 6)) {
          m.phase = 'deliver';
          return { toast: 'PACKAGE SECURED — RUN IT TO THE PIER' };
        }
        if (m.phase === 'deliver' && at(s, c.pier.x, c.pier.z - 18, 8)) return complete(s, 'Delivered clean. The Harbor Crew pays on time.');
        return null;
      },
    },
    {
      ...MISSIONS[2],
      brief: 'A fare is waiting at the Plaza — a nervous guy in a grey coat. Pick him up, then drive him to the Hotel. No cops, no crashes, no questions.',
      objective: { x: c.plaza.x, z: c.plaza.z, label: 'PICK UP THE FARE' },
      start(s) { s.m = { phase: 'pickup' }; },
      update(s) {
        const m = s.m;
        if (m.phase === 'pickup' && at(s, c.plaza.x, c.plaza.z, 6)) {
          m.phase = 'dropoff';
          return { toast: 'FARE ABOARD — TAKE HIM TO THE HOTEL' };
        }
        if (m.phase === 'dropoff' && at(s, c.hotel.x, c.hotel.z, 7)) return complete(s, 'Five stars. The fare tipped, and so did the Crew.');
        return null;
      },
    },
    {
      ...MISSIONS[3],
      brief: 'You are hot — three stars and the whole Harbor PD on your tail. Survive 60 seconds, then shake them and let the heat die to zero.',
      objective: { x: c.garage.x, z: c.garage.z, label: 'LOSE THE COPS' },
      start(s) { s.m = { phase: 'survive', timer: 60 }; addWanted(s, 3, 'heat run'); },
      update(s) {
        const m = s.m;
        if (m.phase === 'survive') {
          m.timer -= 1 / 60;
          if (s.wanted >= 3 && m.timer <= 0) { m.phase = 'escape'; return { toast: 'NOW SHAKE THEM — GET THE HEAT TO ZERO' }; }
          if (s.wanted < 3 && m.timer > 0) { /* heat fell early: still counts */ m.phase = 'escape'; }
        }
        if (m.phase === 'escape' && s.wanted === 0) return complete(s, 'Clean getaway. The PD is still looking for a ghost.');
        return null;
      },
    },
    {
      ...MISSIONS[4],
      brief: 'Three dead drops are hidden around the city — glowing packages on the sidewalks. Collect all three. The last one is watched. Probably.',
      objective: { x: -160, z: -40, label: 'DEAD DROP 1 OF 3' },
      start(s) {
        s.m = { phase: 'collect', found: 0 };
        s.drops = [{ x: -160, z: -40 }, { x: 120, z: 160 }, { x: 40, z: -160 }];
      },
      update(s) {
        const m = s.m;
        for (const d of s.drops) {
          if (!d.taken && at(s, d.x, d.z, 4)) {
            d.taken = true; m.found += 1;
            if (m.found >= 3) return complete(s, 'All three drops. The Crew owes you — big.');
            return { toast: `DROP ${m.found} OF 3 SECURED` };
          }
        }
        return null;
      },
    },
    {
      ...MISSIONS[5],
      brief: 'THE BIG SCORE. Hit the Bank on Harbor Row, hold the vault for 5 seconds, then run four stars of heat all the way to the Pier boat. This is the one, Jax.',
      objective: { x: c.bank.x, z: c.bank.z, label: 'HIT THE BANK' },
      start(s) { s.m = { phase: 'bank', hold: 0 }; },
      update(s) {
        const m = s.m;
        if (m.phase === 'bank' && at(s, c.bank.x, c.bank.z, 7)) {
          m.hold += 1 / 60;
          if (m.hold >= 5) {
            m.phase = 'escape'; addWanted(s, 4, 'bank job');
            return { toast: 'VAULT CRACKED — RUN TO THE PIER BOAT!' };
          }
        } else if (m.phase === 'bank') m.hold = 0;
        if (m.phase === 'escape' && at(s, c.pier.x, c.pier.z - 18, 8)) return complete(s, 'THE BIG SCORE IS YOURS. Neon Harbor belongs to Jax Marlow now.', true);
        return null;
      },
    },
  ];
}

function complete(state, text, win = false) {
  const def = missionDefs(state)[state.missionIndex];
  state.cash += def.payout;
  state.missionsDone += 1;
  state.missionIndex += 1;
  if (win) state.won = true;
  return { toast: `MISSION COMPLETE — +$${def.payout}`, text, done: true, win };
}

function fail(state, text) {
  state.missionIndex += 1;
  return { toast: 'MISSION FAILED', text, done: false };
}

/** Start (or restart) the current mission. Returns its definition. */
export function startMission(state) {
  const defs = missionDefs(state);
  if (state.missionIndex >= defs.length) return null;
  const def = defs[state.missionIndex];
  state.m = null; state.drops = [];
  def.start(state);
  return def;
}

/** Current objective marker position for the HUD / minimap / beacon. */
export function currentObjective(state) {
  const defs = missionDefs(state);
  if (state.missionIndex >= defs.length) return null;
  const def = defs[state.missionIndex];
  if (def.id === 'first-wheels') {
    // Point at the nearest stealable car.
    let best = null, bestD = Infinity;
    for (const car of state.cars) {
      if (car.police) continue;
      const d = dist2(state.player.x, state.player.z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best ? { x: best.x, z: best.z, label: 'STEAL A CAR — PRESS E' } : null;
  }
  if (def.id === 'hot-courier' && state.m?.phase === 'deliver') return { x: state.city.pier.x, z: state.city.pier.z - 18, label: 'DELIVER TO THE PIER' };
  if (def.id === 'night-taxi' && state.m?.phase === 'dropoff') return { x: state.city.hotel.x, z: state.city.hotel.z, label: 'DROP THE FARE AT THE HOTEL' };
  if (def.id === 'dead-drops') {
    const next = (state.drops || []).find((d) => !d.taken);
    if (next) return { x: next.x, z: next.z, label: `DEAD DROP ${state.m ? state.m.found + 1 : 1} OF 3` };
    return null;
  }
  if (def.id === 'big-score' && state.m?.phase === 'escape') return { x: state.city.pier.x, z: state.city.pier.z - 18, label: 'ESCAPE TO THE PIER BOAT' };
  if (def.id === 'heat-run' && state.m?.phase === 'escape') return { x: state.city.garage.x, z: state.city.garage.z, label: 'HIDE OUT — LOSE THE HEAT' };
  return def.objective;
}

/** Advance the active mission one step; returns a result object or null. */
export function stepMission(state) {
  const defs = missionDefs(state);
  if (state.missionIndex >= defs.length || state.over) return null;
  const def = defs[state.missionIndex];
  const result = def.update(state);
  if (result && result.done) {
    if (state.missionIndex < defs.length) startMission(state);
    else { state.m = null; }
  }
  return result;
}

export function missionBrief(state) {
  const defs = missionDefs(state);
  if (state.missionIndex >= defs.length) return { title: 'FREE ROAM', brief: 'All six jobs done. Neon Harbor is yours — cruise, steal, and stay out of trouble.', payout: 0 };
  return defs[state.missionIndex];
}
