// Reward sounds made in the browser with Web Audio: no audio files, nothing to license.
// Call SFX.unlock() inside a tap first (iPhone and Chrome only allow sound after a tap).
;(function () {
  let ctx, out, verb

  function setup() {
    if (ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    out = ctx.createGain()
    out.gain.value = 0.9
    const comp = ctx.createDynamicsCompressor()
    out.connect(comp).connect(ctx.destination)
    // A short room so the chimes ring instead of stopping dead.
    verb = ctx.createConvolver()
    const len = Math.floor(ctx.sampleRate * 1.3)
    const ir = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2)
    }
    verb.buffer = ir
    const wet = ctx.createGain()
    wet.gain.value = 0.22
    verb.connect(wet).connect(out)
  }

  function unlock() {
    setup()
    if (ctx && ctx.state !== 'running') ctx.resume()
  }

  /** One struck note. partials: [ratio, level] pairs, higher ones die faster like a real bell. */
  function note(f, at, dur, { type = 'sine', gain = 0.25, partials = [[1, 1]], attack = 0.004 } = {}) {
    const t = ctx.currentTime + at
    partials.forEach(([r, a]) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = type
      o.frequency.value = f * r
      const d = dur / Math.sqrt(r)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(gain * a, t + attack)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d)
      o.connect(g)
      g.connect(out)
      g.connect(verb)
      o.start(t)
      o.stop(t + d + 0.05)
    })
  }

  function noise(at, dur, { freq = 4000, q = 1.2, gain = 0.3 } = {}) {
    const t = ctx.currentTime + at
    const len = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4)
    const s = ctx.createBufferSource()
    s.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = q
    const g = ctx.createGain()
    g.gain.value = gain
    s.connect(bp).connect(g).connect(out)
    s.start(t)
  }

  const BELL = [[1, 1], [2.76, 0.32], [5.4, 0.1]]

  const CHIMES = {
    // Two quick notes going up, like picking up a coin.
    coin: () => { note(988, 0, 0.14, { type: 'triangle', gain: 0.28 }); note(1319, 0.075, 0.7, { type: 'triangle', gain: 0.28, partials: [[1, 1], [2, 0.15]] }) },
    // Three bell notes, a major chord climbing.
    bell: () => [1047, 1319, 1568].forEach((f, i) => note(f, i * 0.075, 1.5, { gain: 0.2, partials: BELL })),
    // Soft wooden "ding ding".
    marimba: () => { note(784, 0, 0.4, { gain: 0.32, partials: [[1, 1], [4, 0.18], [10, 0.04]] }); note(1175, 0.11, 0.7, { gain: 0.32, partials: [[1, 1], [4, 0.18], [10, 0.04]] }) },
    // Quick glassy run up four notes.
    sparkle: () => [1319, 1661, 1976, 2637].forEach((f, i) => note(f, i * 0.045, 0.55 + i * 0.1, { gain: 0.14, partials: [[1, 1], [3, 0.08]] })),
    // Two clean tones that overlap, like a payment going through.
    pay: () => { note(1175, 0, 1.0, { gain: 0.22, partials: [[1, 1], [2, 0.1]] }); note(1568, 0.14, 1.3, { gain: 0.22, partials: [[1, 1], [2, 0.1]] }) },
  }

  const TICKS = {
    click: () => noise(0, 0.018, { freq: 4200, q: 1.4, gain: 0.35 }),
    rise: (step = 0) => note(880 * Math.pow(2, (step * 2) / 12), 0, 0.07, { gain: 0.11, partials: [[1, 1], [2, 0.2]] }),
    wood: () => {
      const t = ctx.currentTime
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.setValueAtTime(1900, t)
      o.frequency.exponentialRampToValueAtTime(1100, t + 0.03)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.22, t + 0.002)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + 0.06)
    },
  }

  /** A soft rising glide, for a ring being drawn. */
  function sweep(dur = 0.52) {
    const t = ctx.currentTime
    ;[1, 1.5].forEach((r, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = i ? 'triangle' : 'sine'
      o.frequency.setValueAtTime(330 * r, t)
      o.frequency.exponentialRampToValueAtTime(990 * r, t + dur)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(i ? 0.03 : 0.07, t + dur * 0.6)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08)
      o.connect(g)
      g.connect(out)
      g.connect(verb)
      o.start(t)
      o.stop(t + dur + 0.1)
    })
  }

  const ok = () => ctx && ctx.state === 'running'
  window.SFX = {
    unlock,
    chimes: Object.keys(CHIMES),
    ticks: Object.keys(TICKS),
    chime: (k) => ok() && CHIMES[k] && CHIMES[k](),
    tick: (k, step) => ok() && TICKS[k] && TICKS[k](step),
    sweep: (d) => ok() && sweep(d),
  }
})()
