// Neon Harbor — tuning constants. One place for every number the game balances on.
export const CITY = 400;                 // city is CITY x CITY metres, centred on (0,0)
export const ROAD_STEP = 40;             // street grid spacing
export const ROAD_HALF = 5;              // half-width of a road
export const BLOCK = ROAD_STEP - 2 * ROAD_HALF;
export const PLAYER = {
  walkSpeed: 7, sprintSpeed: 11, accel: 26, turnRate: 2.6, radius: 0.7,
  maxHealth: 100, punchRange: 2.2, punchDamage: 34, punchCooldown: 0.45,
};
export const CAR = {
  accel: 22, brake: 34, reverseAccel: 12, maxSpeed: 42, maxReverse: 12,
  turnRate: 2.1, grip: 6, radius: 1.6, maxHealth: 100,
};
export const TRAFFIC_CARS = 14;
export const PEDESTRIANS = 26;
export const WANTED = {
  steal: 1, punch: 1, hitPed: 2, ramPolice: 1, maxStars: 5,
  decayDelay: 14, decayRate: 1 / 9,       // stars fall after 14 s unseen, one per 9 s
  spawnInterval: 4.5, maxPolice: 6,
};
export const MISSIONS = [
  { id: 'first-wheels', title: 'FIRST WHEELS', payout: 500 },
  { id: 'hot-courier', title: 'HOT COURIER', payout: 800 },
  { id: 'night-taxi', title: 'NIGHT TAXI', payout: 1200 },
  { id: 'heat-run', title: 'HEAT RUN', payout: 1500 },
  { id: 'dead-drops', title: 'DEAD DROPS', payout: 2000 },
  { id: 'big-score', title: 'THE BIG SCORE', payout: 10000 },
];
export const SAVE_KEY = 'neon-harbor-save-v1';
export const STEP = 1 / 60;
