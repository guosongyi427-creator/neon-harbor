// Neon Harbor — all sound is synthesized with WebAudio: no audio files, nothing to
// download. Engine hum, two-tone police siren, cash blips, punch thuds and jingles.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      // Siren: alternating square wave, started/stopped by setSiren().
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 660;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
    } catch { return false; }
    return true;
  }

  function blip(freq, dur, type = 'sine', vol = 0.5) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.35;
    },
    isMuted() { return muted; },
    setEngine(speed01, on) {
      if (!ensure()) return;
      const target = on ? 0.05 + speed01 * 0.11 : 0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.1);
    },
    setSiren(on) {
      if (!ensure()) return;
      if (on && !sirenTimer) {
        sirenGain.gain.setTargetAtTime(muted ? 0 : 0.045, ctx.currentTime, 0.2);
        let high = true;
        sirenTimer = setInterval(() => {
          high = !high;
          sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, ctx.currentTime, 0.05);
        }, 420);
      } else if (!on && sirenTimer) {
        clearInterval(sirenTimer); sirenTimer = null;
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      }
    },
    cash() { blip(880, 0.12); setTimeout(() => blip(1318, 0.18), 90); },
    punch() { blip(120, 0.12, 'square', 0.6); },
    steal() { blip(220, 0.1, 'triangle', 0.5); setTimeout(() => blip(330, 0.12, 'triangle', 0.5), 80); },
    mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16), i * 100)); },
    busted() { [392, 311, 233].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.4), i * 180)); },
    click() { blip(660, 0.06, 'triangle', 0.4); },
  };
}
