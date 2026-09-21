/**
 * Fully synthesized audio: no files. An AudioContext is created lazily on the
 * first user gesture (browser autoplay policy), every voice disconnects itself
 * when it ends, and mute state persists in localStorage.
 */

const MUTE_KEY = "bugblaster.muted";
const MASTER_GAIN = 0.6;
const FLOOR = 0.0001; // exponential ramps can never reach 0

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* private mode or storage disabled: mute just won't persist */
  }
}

type Osc = OscillatorType;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuffer!: AudioBuffer;
  muted = loadMuted();
  readonly music: Music;

  constructor() {
    this.music = new Music(this);
    for (const ev of ["pointerdown", "touchend", "keydown"] as const) {
      window.addEventListener(ev, () => this.unlock(), { passive: true });
    }
    document.addEventListener("visibilitychange", () => {
      if (!this.ctx) return;
      if (document.visibilityState === "visible") {
        if (this.ctx.state !== "running") void this.ctx.resume();
        this.music.resume();
      } else {
        this.music.pause();
      }
    });
  }

  /** Idempotent. Must be reachable from inside a user-gesture call stack for iOS. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.55;
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state !== "running") void this.ctx.resume();
  }

  get ready(): boolean {
    return this.ctx !== null;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    saveMuted(this.muted);
    if (this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  // ---- internals shared with Music --------------------------------------

  /** @internal */
  get context(): AudioContext | null {
    return this.ctx;
  }

  /** @internal */
  get musicOut(): GainNode {
    return this.musicBus;
  }

  /** @internal */
  get noise(): AudioBuffer {
    return this.noiseBuffer;
  }

  /**
   * Connects src -> ...nodes -> bus, schedules start/stop and tears the whole
   * chain down when the source ends so nothing leaks.
   * @internal
   */
  play(
    src: AudioScheduledSourceNode,
    nodes: AudioNode[],
    bus: AudioNode,
    start: number,
    stop: number,
    extraSources: AudioScheduledSourceNode[] = [],
  ): void {
    let prev: AudioNode = src;
    for (const n of nodes) {
      prev.connect(n);
      prev = n;
    }
    prev.connect(bus);
    src.start(start);
    src.stop(stop);
    for (const s of extraSources) {
      s.start(start);
      s.stop(stop);
    }
    src.onended = () => {
      src.disconnect();
      for (const n of nodes) n.disconnect();
      for (const s of extraSources) s.disconnect();
    };
  }

  /** Attack/decay envelope on a gain param. @internal */
  env(param: AudioParam, t: number, peak: number, attack: number, decay: number): void {
    param.setValueAtTime(FLOOR, t);
    param.exponentialRampToValueAtTime(Math.max(FLOOR, peak), t + attack);
    param.exponentialRampToValueAtTime(FLOOR, t + attack + decay);
  }

  /** @internal */
  osc(type: Osc, freq: number): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  /** @internal */
  gain(v = 1): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = v;
    return g;
  }

  /** @internal */
  noiseSource(): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuffer;
    s.loop = true;
    return s;
  }

  /** @internal */
  filter(type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
    const f = this.ctx!.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  private tone(type: Osc, f0: number, f1: number, dur: number, peak: number, attack = 0.005, at = 0): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at;
    const o = this.osc(type, f0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.gain();
    this.env(g.gain, t, peak, attack, dur - attack);
    this.play(o, [g], this.sfxBus, t, t + dur + 0.05);
  }

  private noiseHit(filterType: BiquadFilterType, freq: number, q: number, dur: number, peak: number, at = 0): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + at;
    const n = this.noiseSource();
    const f = this.filter(filterType, freq, q);
    const g = this.gain();
    this.env(g.gain, t, peak, 0.004, dur);
    this.play(n, [f, g], this.sfxBus, t, t + dur + 0.05);
  }

  // ---- sound effects ------------------------------------------------------

  shoot(): void {
    const jitter = 1 + (Math.random() - 0.5) * 0.2;
    this.tone("square", 880 * jitter, 220 * jitter, 0.09, 0.11);
  }

  /** Kind-specific squish: a noise pop and a pitched thud. Low pitch = fat thud. */
  squish(pitch: number): void {
    this.noiseHit("bandpass", 800, 1, 0.1, 0.25);
    this.tone("sine", pitch, pitch * 0.35, 0.16, 0.35);
  }

  damage(): void {
    this.tone("sine", 300, 300, 0.05, 0.15, 0.002);
  }

  /** Two-note "meh". */
  shrug(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.osc("triangle", 330);
    o.frequency.setValueAtTime(330, t);
    o.frequency.setValueAtTime(262, t + 0.09);
    const f = this.filter("lowpass", 1200);
    const g = this.gain();
    g.gain.setValueAtTime(FLOOR, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
    g.gain.setValueAtTime(0.2, t + 0.09);
    g.gain.exponentialRampToValueAtTime(FLOOR, t + 0.24);
    this.play(o, [f, g], this.sfxBus, t, t + 0.3);
  }

  /** Error buzz with tremolo. */
  miss(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = 0.32;
    const o = this.osc("square", 110);
    o.frequency.linearRampToValueAtTime(82, t + dur);
    const trem = this.gain(0.5);
    const lfo = this.osc("sine", 28);
    const lfoGain = this.gain(0.5);
    lfo.connect(lfoGain).connect(trem.gain);
    const f = this.filter("lowpass", 900);
    const g = this.gain();
    this.env(g.gain, t, 0.28, 0.01, dur);
    this.play(o, [trem, f, g], this.sfxBus, t, t + dur + 0.05, [lfo]);
    lfo.onended = () => {
      lfoGain.disconnect();
    };
  }

  /** Rising arpeggio with vibrato on the last note. */
  rageReady(): void {
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const last = i === notes.length - 1;
      this.tone("triangle", f, f, last ? 0.4 : 0.09, 0.18, 0.005, i * 0.08);
    });
    const t = this.ctx.currentTime + notes.length * 0.08;
    const o = this.osc("triangle", 1046.5);
    const lfo = this.osc("sine", 6);
    const depth = this.gain(8);
    lfo.connect(depth).connect(o.frequency);
    const g = this.gain();
    this.env(g.gain, t, 0.14, 0.01, 0.4);
    this.play(o, [g], this.sfxBus, t, t + 0.45, [lfo]);
    lfo.onended = () => depth.disconnect();
  }

  /** Noise sweep, keyboard mash, sub thump and an "Enter" thunk. */
  ultimate(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // (a) sweep
    const n = this.noiseSource();
    const f = this.filter("lowpass", 200, 0.8);
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(8000, t + 0.5);
    f.frequency.exponentialRampToValueAtTime(300, t + 1.0);
    const g = this.gain();
    this.env(g.gain, t, 0.45, 0.03, 1.0);
    this.play(n, [f, g], this.sfxBus, t, t + 1.1);
    // (b) keyboard mash
    for (let i = 0; i < 18; i++) {
      this.noiseHit("highpass", 3000, 0.7, 0.02, 0.2, Math.random() * 0.55);
    }
    // (c) sub
    this.tone("sine", 55, 50, 0.9, 0.4, 0.02);
    // (d) Enter key
    this.tone("sine", 90, 40, 0.2, 0.5, 0.005, 0.6);
    this.noiseHit("lowpass", 600, 1, 0.08, 0.35, 0.6);
  }

  /** Sad trombone. */
  gameOver(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [392, 369.99, 349.23, 329.63];
    const step = 0.38;
    const o = this.osc("sawtooth", notes[0]);
    notes.forEach((f, i) => {
      const at = t + i * step;
      if (i > 0) {
        o.frequency.setValueAtTime(notes[i - 1], at);
        o.frequency.exponentialRampToValueAtTime(f, at + 0.09);
      }
    });
    const lfo = this.osc("sine", 5.5);
    const depth = this.gain(0);
    depth.gain.setValueAtTime(0, t);
    depth.gain.setValueAtTime(10, t + notes.length * step);
    lfo.connect(depth).connect(o.frequency);
    const f = this.filter("lowpass", 900);
    const g = this.gain();
    g.gain.setValueAtTime(FLOOR, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
    g.gain.setValueAtTime(0.25, t + notes.length * step);
    g.gain.exponentialRampToValueAtTime(FLOOR, t + notes.length * step + 0.9);
    this.play(o, [f, g], this.sfxBus, t, t + 2.5, [lfo]);
    lfo.onended = () => depth.disconnect();
  }

  streak(): void {
    this.tone("sine", 880, 880, 0.07, 0.15);
    this.tone("sine", 1320, 1320, 0.1, 0.15, 0.005, 0.07);
  }

  uiClick(): void {
    this.tone("sine", 600, 600, 0.03, 0.12, 0.002);
  }

  levelUp(): void {
    this.tone("square", 440, 440, 0.06, 0.1);
    this.tone("square", 660, 660, 0.06, 0.1, 0.005, 0.07);
    this.tone("square", 880, 880, 0.12, 0.1, 0.005, 0.14);
  }
}

// ---- music ------------------------------------------------------------------

const A2 = 110, C3 = 130.81, G2 = 98, E2 = 82.41;
const BASS: (number | null)[] = [A2, A2, null, A2, C3, null, A2, null, G2, G2, null, G2, E2, null, G2, null];
const ARP_A = [440, 523.25, 659.25, 880];
const ARP_G = [392, 493.88, 587.33, 783.99];

/** Look-ahead scheduler ("two clocks") for a small synthwave loop. */
class Music {
  private bpm = 128;
  private pendingBpm: number | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private playing = false;

  constructor(private readonly engine: AudioEngine) {}

  start(): void {
    const ctx = this.engine.context;
    if (!ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.tick(), 50);
  }

  stop(): void {
    this.playing = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  pause(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  resume(): void {
    const ctx = this.engine.context;
    if (!this.playing || this.timer || !ctx) return;
    this.nextTime = Math.max(this.nextTime, ctx.currentTime + 0.05);
    this.timer = setInterval(() => this.tick(), 50);
  }

  setTempo(bpm: number): void {
    this.pendingBpm = Math.max(60, Math.min(220, bpm));
  }

  private tick(): void {
    const ctx = this.engine.context;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + 0.2) {
      if (this.step % 4 === 0 && this.pendingBpm !== null) {
        this.bpm = this.pendingBpm;
        this.pendingBpm = null;
      }
      const stepDur = 60 / this.bpm / 4;
      this.scheduleStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  private scheduleStep(step: number, t: number, stepDur: number): void {
    const e = this.engine;
    const bus = e.musicOut;
    const bass = BASS[step % 16];
    if (bass !== null) {
      const o = e.osc("triangle", bass);
      const g = e.gain();
      e.env(g.gain, t, 0.09, 0.01, stepDur * 0.9);
      e.play(o, [g], bus, t, t + stepDur + 0.05);
    }
    const arp = step < 32 ? ARP_A : ARP_G;
    const o = e.osc("square", arp[step % 4]);
    const f = e.filter("lowpass", 2200);
    const g = e.gain();
    e.env(g.gain, t, 0.035, 0.005, stepDur * 0.6);
    e.play(o, [f, g], bus, t, t + stepDur + 0.05);
    if (step % 2 === 0) {
      const n = e.noiseSource();
      const hf = e.filter("highpass", 6000);
      const hg = e.gain();
      e.env(hg.gain, t, step % 4 === 2 ? 0.05 : 0.03, 0.002, 0.03);
      e.play(n, [hf, hg], bus, t, t + 0.06);
    }
  }
}

export const audio = new AudioEngine();
