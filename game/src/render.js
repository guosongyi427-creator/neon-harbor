// Neon Harbor — rendering: the three.js sunset city, its cars and people, the HUD
// (cash, health, wanted stars, speed, mission brief) and the live 2D minimap.
import * as THREE from 'three';
import { CITY } from './config.js';
import { clamp } from './random.js';

const HALF = CITY / 2;
const SUNSET = 0xff9a5c;

/** Painted ground: asphalt roads, sidewalks, plaza, pier and water, one canvas texture. */
function makeGroundTexture() {
  const S = 1024, cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  const toPx = (v) => ((v + HALF) / CITY) * S;
  g.fillStyle = '#232030'; g.fillRect(0, 0, S, S);           // blocks
  g.fillStyle = '#1d5a8a'; g.fillRect(0, toPx(HALF - 6), S, S - toPx(HALF - 6)); // water, south
  g.fillStyle = '#3a2f28'; g.fillRect(toPx(-30), toPx(HALF - 6), toPx(30) - toPx(-30), S - toPx(HALF - 6)); // pier deck
  for (let v = -HALF; v <= HALF; v += 40) {                    // roads
    g.fillStyle = '#2e2c38';
    g.fillRect(toPx(v - 5), 0, toPx(v + 5) - toPx(v - 5), S);
    g.fillRect(0, toPx(v - 5), S, toPx(v + 5) - toPx(v - 5));
    g.fillStyle = '#8a7a3a';                                   // centre dashes
    for (let u = -HALF; u < HALF; u += 16) {
      g.fillRect(toPx(u), toPx(v - 0.4), toPx(u + 7) - toPx(u), 2);
      g.fillRect(toPx(v - 0.4), toPx(u), 2, toPx(u + 7) - toPx(u));
    }
  }
  g.fillStyle = '#4a4458'; g.fillRect(toPx(-20), toPx(-20), toPx(20) - toPx(-20), toPx(20) - toPx(-20)); // plaza
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

/** Building faces with lit windows, one shared canvas texture. */
function makeWindowTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#ffd98a';
  for (let y = 12; y < 244; y += 22) for (let x = 10; x < 118; x += 20) {
    if ((x * 7 + y * 13) % 5 < 3) g.fillRect(x, y, 12, 14);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeCarMesh(color, police) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.2), bodyMat);
  body.position.y = 0.55; body.castShadow = true; group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x18202e, roughness: 0.15, metalness: 0.8 }),
  );
  cabin.position.set(0, 1.1, -0.2); cabin.castShadow = true; group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z); group.add(w);
  }
  if (police) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff2244, emissiveIntensity: 1.6 }),
    );
    bar.position.set(0, 1.45, -0.2); bar.name = 'lightbar'; group.add(bar);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.5 }));
    badge.position.set(0, 0.62, 0); group.add(badge);
  }
  return group;
}

function makePedMesh(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.95, 0.32),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  body.position.y = 0.95; body.castShadow = true; group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.7 }));
  head.position.y = 1.62; head.castShadow = true; group.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x22222e, roughness: 0.9 }));
  legs.position.y = 0.25; group.add(legs);
  return group;
}

export function createRenderer(canvas, state) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SUNSET);
  scene.fog = new THREE.Fog(0xe88a5a, 120, 520);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);

  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x2a1a3a, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 2.0);
  sun.position.set(-120, 90, -160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  scene.add(sun);

  // Ground, water and sky glow.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY + 120, CITY + 120),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(26, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8, fog: false }),
  );
  glow.position.set(-180, 42, -260); scene.add(glow);

  // Buildings.
  const winTex = makeWindowTexture();
  const buildingMeshes = [];
  for (const b of state.city.buildings) {
    // Repeat the window texture so windows stay window-sized on any building.
    const tex = winTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.round(b.w / 12)), Math.max(1, Math.round(b.h / 12)));
    const mat = new THREE.MeshStandardMaterial({
      color: b.color, roughness: 0.85,
      emissive: 0xffc46b, emissiveMap: tex, emissiveIntensity: 0.55, map: tex,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh); buildingMeshes.push(mesh);
    if (b.roof) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.4, 2.5, b.d * 0.4),
        new THREE.MeshStandardMaterial({ color: 0x22222e, roughness: 0.9 }));
      roof.position.set(b.x, b.h + 1.2, b.z); scene.add(roof);
    }
  }

  // Street lamps: pole + glowing head (no per-lamp light: the sunset does the work).
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const l of state.city.lamps) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2a34, roughness: 0.6, metalness: 0.5 }));
    pole.position.set(l.x, 3, l.z); scene.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), lampHeadMat);
    head.position.set(l.x, 6.1, l.z); scene.add(head);
  }

  // Pier posts + a moored boat.
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.2, 9),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 }));
  hull.position.y = 0.4; boat.add(hull);
  const cabinB = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, 3),
    new THREE.MeshStandardMaterial({ color: 0xd8384f, roughness: 0.5 }));
  cabinB.position.set(0, 1.6, -1); boat.add(cabinB);
  boat.position.set(14, -0.4, HALF + 22);
  scene.add(boat);

  // Entities.
  const carMeshes = new Map();
  for (const car of state.cars) {
    const mesh = makeCarMesh(car.color, car.police);
    scene.add(mesh); carMeshes.set(car.id, mesh);
  }
  const pedMeshes = new Map();
  for (const ped of state.peds) {
    const mesh = makePedMesh(ped.color);
    scene.add(mesh); pedMeshes.set(ped.id, mesh);
  }
  const playerMesh = makePedMesh(0xff5e8a);
  playerMesh.scale.set(1.05, 1.05, 1.05);
  scene.add(playerMesh);

  // Objective beacon: a glowing column + a floating diamond.
  const beacon = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  column.position.y = 30; beacon.add(column);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23f }));
  diamond.position.y = 8; diamond.name = 'diamond'; beacon.add(diamond);
  scene.add(beacon);

  // Drop packages.
  const dropMeshes = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x7dff9a, emissive: 0x19c37d, emissiveIntensity: 0.9 }));
    m.position.y = 0.6; m.visible = false; scene.add(m); dropMeshes.push(m);
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /** Sync every mesh from the simulation state and draw one frame. */
  function render(state, objective, time) {
    const p = state.player;
    for (const car of state.cars) {
      let mesh = carMeshes.get(car.id);
      if (!mesh) { mesh = makeCarMesh(car.color, car.police); scene.add(mesh); carMeshes.set(car.id, mesh); }
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.angle;
      const bar = mesh.getObjectByName('lightbar');
      if (bar) bar.material.emissive.setHex(Math.floor(time * 2) % 2 === 0 ? 0xff2244 : 0x2244ff);
    }
    for (const ped of state.peds) {
      const mesh = pedMeshes.get(ped.id);
      mesh.position.set(ped.x, ped.down ? 0.15 : Math.abs(Math.sin(ped.walkPhase)) * 0.08, ped.z);
      mesh.rotation.y = ped.angle;
      mesh.rotation.z = ped.down ? Math.PI / 2 : 0;
    }
    if (p.onFoot) {
      playerMesh.visible = true;
      playerMesh.position.set(p.x, Math.abs(Math.sin(time * 8)) * (p.speed > 0.5 ? 0.08 : 0), p.z);
      playerMesh.rotation.y = p.angle;
    } else playerMesh.visible = false;

    beacon.visible = !!objective;
    if (objective) {
      beacon.position.set(objective.x, 0, objective.z);
      beacon.getObjectByName('diamond').rotation.y = time * 1.5;
      beacon.getObjectByName('diamond').position.y = 8 + Math.sin(time * 2) * 0.5;
    }
    const drops = state.drops || [];
    dropMeshes.forEach((m, i) => {
      const d = drops[i];
      m.visible = !!d && !d.taken;
      if (d) { m.position.x = d.x; m.position.z = d.z; m.rotation.y = time; }
    });

    // Third-person chase camera.
    const yaw = state.camYaw, pitch = state.camPitch;
    const dist = p.onFoot ? 9 : 13;
    const cx = p.x - Math.sin(yaw) * Math.cos(pitch) * dist;
    const cz = p.z - Math.cos(yaw) * Math.cos(pitch) * dist;
    const cy = 3.2 + Math.sin(pitch) * dist;
    camera.position.set(cx, cy, cz);
    camera.lookAt(p.x, 2.2, p.z);
    renderer.render(scene, camera);
  }

  return { render, resize, scene, camera, renderer };
}

// ---- HUD -------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

export function updateHud(state, brief, objective, muted) {
  $('cash').textContent = `$${state.cash.toLocaleString('en-US')}`;
  const stars = $('stars');
  let html = '';
  for (let i = 0; i < 5; i++) html += `<span class="${i < state.wanted ? '' : 'off'}">★</span>`;
  stars.innerHTML = html;
  $('health').style.width = `${clamp(state.health, 0, 100)}%`;
  const mph = Math.round(Math.abs(state.player.speed || 0) * 2.237);
  $('speed').innerHTML = `${mph}<small> MPH${state.player.onFoot ? ' · ON FOOT' : ''}${muted ? ' · MUTED' : ''}</small>`;
  $('missionTitle').textContent = `${brief.title}${brief.payout ? ` — $${brief.payout.toLocaleString('en-US')}` : ''}`;
  $('missionBrief').textContent = brief.brief;
  $('missionDist').textContent = objective
    ? `▸ ${objective.label} — ${Math.round(Math.hypot(objective.x - state.player.x, objective.z - state.player.z))} m`
    : '';
}

let toastTimer = null;
export function showToast(text, ms = 2600) {
  const el = $('toast');
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, ms);
}

/** Live top-down minimap: roads, buildings, player, traffic, police, objective. */
export function drawMinimap(state, objective) {
  const cv = $('minimap');
  const g = cv.getContext('2d');
  const S = cv.width;
  const toPx = (v) => ((v + HALF) / CITY) * S;
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#14142a'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#3a3a55'; g.lineWidth = 3;
  for (let v = -HALF; v <= HALF; v += 40) {
    g.beginPath(); g.moveTo(toPx(v), 0); g.lineTo(toPx(v), S); g.stroke();
    g.beginPath(); g.moveTo(0, toPx(v)); g.lineTo(S, toPx(v)); g.stroke();
  }
  g.fillStyle = '#6a6a9a';
  for (const b of state.city.buildings) g.fillRect(toPx(b.x - b.w / 2), toPx(b.z - b.d / 2), Math.max(2, (b.w / CITY) * S), Math.max(2, (b.d / CITY) * S));
  if (objective) {
    g.fillStyle = '#ffd23f';
    g.beginPath(); g.arc(toPx(objective.x), toPx(objective.z), 6, 0, Math.PI * 2); g.fill();
  }
  for (const d of state.drops || []) {
    if (d.taken) continue;
    g.fillStyle = '#7dff9a'; g.fillRect(toPx(d.x) - 3, toPx(d.z) - 3, 6, 6);
  }
  for (const car of state.cars) {
    g.fillStyle = car.police ? '#ff3344' : '#d8d8d8';
    g.fillRect(toPx(car.x) - 2, toPx(car.z) - 2, 4, 4);
  }
  for (const ped of state.peds) {
    g.fillStyle = '#9be7ff';
    g.fillRect(toPx(ped.x) - 1, toPx(ped.z) - 1, 2, 2);
  }
  // Player arrow.
  const px = toPx(state.player.x), pz = toPx(state.player.z);
  g.save();
  g.translate(px, pz); g.rotate(Math.PI - state.player.angle);
  g.fillStyle = '#ff5e8a';
  g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill();
  g.restore();
}
