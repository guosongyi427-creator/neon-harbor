// Neon Harbor — keyboard + mouse-drag look. No pointer lock: dragging orbits the
// camera, and the game reads a plain key set each frame.
export function createInput(canvas) {
  const keys = new Set();
  const state = { keys, lookDX: 0, lookDY: 0, dragging: false };
  let lastX = 0, lastY = 0;

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (e) => { state.dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('pointerup', () => { state.dragging = false; });
  window.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    state.lookDX += e.clientX - lastX;
    state.lookDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  });

  return state;
}

/** Drain this frame's accumulated mouse-drag deltas. */
export function consumeLook(input) {
  const dx = input.lookDX, dy = input.lookDY;
  input.lookDX = 0; input.lookDY = 0;
  return { dx, dy };
}

export function axis(input, neg, pos) {
  return (input.keys.has(pos) ? 1 : 0) - (input.keys.has(neg) ? 1 : 0);
}
