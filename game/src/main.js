// Neon Harbor — entry point: game loop, screens (title / pause / game over / win),
// saving, and the ?shot= screenshot scenes. Simulation lives in world.js, missions
// in missions.js, rendering in render.js.
import { STEP, SAVE_KEY } from './config.js';
import { createState, stepWorld, tryEnterCar, tryPunch } from './world.js';
import { startMission, stepMission, currentObjective, missionBrief } from './missions.js';
import { createRenderer, updateHud, drawMinimap, showToast } from './render.js';
import { createInput, consumeLook, axis } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1) || 1;
const shot = params.get('shot');
const canvas = document.getElementById('game');
const hud = document.getElementById('hud');

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveGame(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash, missionIndex: state.missionIndex, missionsDone: state.missionsDone,
    }));
  } catch { /* private mode: the game still plays */ }
}

const audio = createAudio();
const input = createInput(canvas);
const save = loadSave();
const state = createState(seed, save);
const view = createRenderer(canvas, state);

let mode = 'title'; // title | play | pause | over | win
let lastTime = performance.now();
let saveTimer = 0;
let shotReadyFrames = 0;

const game = {
  state, input,
  startGame,
  step(dt) { stepWorld(state, dt, input); drainMission(); },
  stepAmbient(dt) {
    // City life behind the title screen: traffic + pedestrians only.
    state.time += dt;
    const fake = { keys: new Set() };
    stepWorld(state, 0, fake); // no-op guard: stepWorld with dt 0 advances nothing
    stepAmbientOnly(state, dt);
  },
};

function stepAmbientOnly(st, dt) {
  // Move traffic and pedestrians without the player (title-screen backdrop).
  for (const car of st.cars) {
    if (!car.traffic) continue;
    const t = car.waypoints[car.wp];
    const dx = t[0] - car.x, dz = t[1] - car.z;
    car.angle = Math.atan2(dx, dz);
    car.x += Math.sin(car.angle) * car.speed * dt;
    car.z += Math.cos(car.angle) * car.speed * dt;
    if (Math.hypot(dx, dz) < 9) car.wp = (car.wp + 1) % car.waypoints.length;
  }
  for (const ped of st.peds) {
    ped.walkPhase += dt * 6;
    const along = ped.roadAxis === 'x' ? ped.x : ped.z;
    const next = along + ped.dir * ped.speed * dt;
    if (next > 192 || next < -192) ped.dir *= -1;
    if (ped.roadAxis === 'x') ped.x = next; else ped.z = next;
  }
}

function drainMission() {
  const result = stepMission(state);
  if (result) {
    if (result.toast) showToast(result.toast);
    if (result.text) showToast(result.text, 4200);
    if (result.done) {
      audio.cash(); audio.mission(); saveGame(state);
      if (result.win) { mode = 'win'; showScreen('screen-win'); }
    }
  }
}

function drainEvents() {
  for (const e of state.events.splice(0)) {
    if (e.type === 'steal') { audio.steal(); showToast('CAR STOLEN — THE PD IS COMING'); }
    if (e.type === 'punch') audio.punch();
    if (e.type === 'hit-ped') { audio.punch(); showToast('PEDESTRIAN DOWN — HEAT RISING'); }
    if (e.type === 'wanted' && e.stars > 0) showToast(`WANTED LEVEL ${e.stars} ${'★'.repeat(e.stars)}`);
    if (e.type === 'car-wrecked') { showToast('CAR WRECKED — GET OUT AND RUN'); audio.busted(); }
    if (e.type === 'police-spawn') showToast('HARBOR PD IN PURSUIT');
    if (e.type === 'game-over') {
      audio.busted();
      mode = 'over';
      document.getElementById('over-title').textContent = e.reason === 'busted' ? 'BUSTED' : 'WASTED';
      document.getElementById('over-sub').textContent = e.reason === 'busted'
        ? 'THE HARBOR PD CAUGHT UP WITH YOU' : 'NEON HARBOR GOT THE BETTER OF YOU';
      document.getElementById('over-stats').textContent =
        `Cash $${state.cash.toLocaleString('en-US')} · Missions done ${state.missionsDone} of 6 · ` +
        `Cars stolen ${state.stats.carsStolen} · Distance ${Math.round(state.stats.distance)} m`;
      showScreen('screen-over');
      saveGame(state);
    }
  }
}

function showScreen(id) {
  for (const s of ['screen-title', 'screen-pause', 'screen-over', 'screen-win']) {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  }
  hud.classList.toggle('hidden', id !== null);
  if (id) hud.classList.add('hidden'); else hud.classList.remove('hidden');
}

function startGame() {
  mode = 'play';
  showScreen(null);
  if (!state.m && state.missionIndex < 6) {
    const def = startMission(state);
    if (def) showToast(`${def.title} — $${def.payout.toLocaleString('en-US')}`, 3400);
  }
  audio.unlock();
  document.getElementById('status').textContent = 'Neon Harbor started. Mission: ' + missionBrief(state).title;
}

function restartStory() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  location.search = shot ? `?shot=${shot}&seed=${seed}` : '';
  location.reload();
}

document.getElementById('btn-start').addEventListener('click', () => { audio.unlock(); audio.click(); startGame(); });
document.getElementById('btn-resume').addEventListener('click', () => { audio.click(); mode = 'play'; showScreen(null); });
document.getElementById('btn-restart').addEventListener('click', restartStory);
document.getElementById('btn-retry').addEventListener('click', () => { audio.click(); location.reload(); });
document.getElementById('btn-again').addEventListener('click', () => {
  audio.click(); state.freeRoam = true; mode = 'play'; showScreen(null);
  showToast('FREE ROAM — NEON HARBOR IS YOURS');
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') { audio.setMuted(!audio.isMuted()); return; }
  if (mode !== 'play') return;
  if (e.code === 'KeyP' || e.code === 'Escape') { mode = 'pause'; showScreen('screen-pause'); return; }
  if (e.code === 'KeyE') tryEnterCar(state);
  if (e.code === 'KeyF') tryPunch(state);
});

function resize() {
  view.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();

if (save) document.getElementById('continue-line').classList.remove('hidden');

// Screenshot scenes run before the first frame.
let shotScreen = null;
if (shot) {
  shotScreen = stageShot(shot, game);
  if (shotScreen === 'title') { mode = 'title'; showScreen('screen-title'); }
  else if (shotScreen === 'play') { mode = 'play'; showScreen(null); }
  else if (shotScreen === 'over') {
    mode = 'over';
    document.getElementById('over-title').textContent = 'BUSTED';
    document.getElementById('over-sub').textContent = 'THE HARBOR PD CAUGHT UP WITH YOU';
    document.getElementById('over-stats').textContent =
      `Cash $${state.cash.toLocaleString('en-US')} · Missions done ${state.missionsDone} of 6 · ` +
      `Cars stolen ${state.stats.carsStolen} · Distance ${Math.round(state.stats.distance)} m`;
    showScreen('screen-over');
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const look = consumeLook(input);
  if (look.dx || look.dy) {
    state.camYaw -= look.dx * 0.005;
    state.camPitch = Math.max(0.05, Math.min(1.1, state.camPitch + look.dy * 0.003));
  }
  if (mode === 'play' && !shot) {
    let acc = dt;
    while (acc > 0) { const h = Math.min(STEP, acc); stepWorld(state, h, input); acc -= h; }
    drainMission();
    drainEvents();
    saveTimer += dt;
    if (saveTimer > 5) { saveTimer = 0; saveGame(state); }
    audio.setEngine(state.player.onFoot ? 0 : Math.abs(state.player.speed || 0) / 42, !state.player.onFoot);
    audio.setSiren(state.wanted > 0);
  } else if (mode === 'title' && !shot) {
    stepAmbientOnly(state, dt);
  }
  if (mode === 'play' || mode === 'title' || mode === 'over' || mode === 'win') {
    const objective = currentObjective(state);
    view.render(state, objective, state.time + performance.now() / 1000);
    if (mode === 'play') {
      updateHud(state, missionBrief(state), objective, audio.isMuted());
      drawMinimap(state, objective);
    }
  }
  if (shot) {
    shotReadyFrames += 1;
    if (shotReadyFrames >= 3) window.__shotReady = true;
  }
}

requestAnimationFrame(frame);
