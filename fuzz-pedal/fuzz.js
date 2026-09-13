/**
 * VOLT — asymmetric germanium-style fuzz engine (Web Audio).
 */

export class VoltFuzz {
  constructor() {
    this.ctx = null;
    this.engaged = false;
    this.fuzz = 0.72;
    this.tone = 0.48;
    this.level = 0.55;

    this.inputGain = null;
    this.preFilter = null;
    this.shaper = null;
    this.toneFilter = null;
    this.presence = null;
    this.outputGain = null;
    this.dryGain = null;
    this.wetGain = null;
    this.master = null;
    this.analyser = null;

    this._source = null;
    this._demoNodes = [];
    this._demoTimer = null;
    this._fileBuffer = null;
  }

  async ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this._buildGraph();
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  _buildGraph() {
    const ctx = this.ctx;

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1.4;

    this.preFilter = ctx.createBiquadFilter();
    this.preFilter.type = "highpass";
    this.preFilter.frequency.value = 80;
    this.preFilter.Q.value = 0.7;

    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = "4x";
    this._updateCurve();

    this.toneFilter = ctx.createBiquadFilter();
    this.toneFilter.type = "lowpass";
    this.toneFilter.Q.value = 0.85;

    this.presence = ctx.createBiquadFilter();
    this.presence.type = "peaking";
    this.presence.frequency.value = 2200;
    this.presence.Q.value = 0.9;
    this.presence.gain.value = 3;

    this.outputGain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;

    this.inputGain.connect(this.preFilter);
    this.preFilter.connect(this.shaper);
    this.shaper.connect(this.toneFilter);
    this.toneFilter.connect(this.presence);
    this.presence.connect(this.outputGain);
    this.outputGain.connect(this.wetGain);

    this.inputGain.connect(this.dryGain);

    this.dryGain.connect(this.master);
    this.wetGain.connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(ctx.destination);

    this._applyTone();
    this._applyLevel();
    this._applyBypass();
  }

  _makeCurve(amount) {
    const n = 2048;
    const curve = new Float32Array(n);
    const drive = 1 + amount * 48;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      // Asymmetric soft clip (germanium-ish): harder on positive half
      const pos = Math.tanh(x * drive);
      const neg = Math.tanh(x * drive * 0.72) * 0.92;
      let y = x >= 0 ? pos : neg;
      // Slight even-harmonic squish
      y = y + 0.08 * y * y * Math.sign(y);
      // Gate the quiet bits a hair for classic fuzz cleanup
      const gate = Math.abs(x) < 0.02 * (1 - amount * 0.5) ? 0.35 : 1;
      curve[i] = Math.max(-1, Math.min(1, y * gate));
    }
    return curve;
  }

  _updateCurve() {
    if (!this.shaper) return;
    this.shaper.curve = this._makeCurve(this.fuzz);
  }

  _applyTone() {
    if (!this.toneFilter) return;
    // 400 Hz muddy → 6200 Hz open
    const freq = 400 + this.tone * 5800;
    this.toneFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.03);
    this.presence.gain.setTargetAtTime(
      -2 + this.tone * 8,
      this.ctx.currentTime,
      0.03
    );
  }

  _applyLevel() {
    if (!this.outputGain) return;
    const g = this.level * this.level * 1.35;
    this.outputGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.02);
  }

  _applyBypass() {
    if (!this.wetGain || !this.dryGain) return;
    const t = this.ctx.currentTime;
    if (this.engaged) {
      this.wetGain.gain.setTargetAtTime(1, t, 0.02);
      this.dryGain.gain.setTargetAtTime(0, t, 0.02);
    } else {
      this.wetGain.gain.setTargetAtTime(0, t, 0.02);
      this.dryGain.gain.setTargetAtTime(0.9, t, 0.02);
    }
  }

  setFuzz(v01) {
    this.fuzz = Math.max(0, Math.min(1, v01));
    this._updateCurve();
  }

  setTone(v01) {
    this.tone = Math.max(0, Math.min(1, v01));
    this._applyTone();
  }

  setLevel(v01) {
    this.level = Math.max(0, Math.min(1, v01));
    this._applyLevel();
  }

  setEngaged(on) {
    this.engaged = Boolean(on);
    this._applyBypass();
  }

  async _disconnectSource() {
    this.stopDemo();
    if (this._source) {
      try {
        this._source.disconnect();
      } catch {
        /* already disconnected */
      }
      if (typeof this._source.stop === "function") {
        try {
          this._source.stop();
        } catch {
          /* already stopped */
        }
      }
      this._source = null;
    }
  }

  async useMicrophone() {
    await this.ensureContext();
    await this._disconnectSource();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const src = this.ctx.createMediaStreamSource(stream);
    src.connect(this.inputGain);
    this._source = src;
    return true;
  }

  async loadFile(file) {
    await this.ensureContext();
    await this._disconnectSource();
    const arrayBuf = await file.arrayBuffer();
    this._fileBuffer = await this.ctx.decodeAudioData(arrayBuf);
    const src = this.ctx.createBufferSource();
    src.buffer = this._fileBuffer;
    src.loop = true;
    src.connect(this.inputGain);
    src.start();
    this._source = src;
    return true;
  }

  stopDemo() {
    if (this._demoTimer) {
      clearTimeout(this._demoTimer);
      this._demoTimer = null;
    }
    for (const n of this._demoNodes) {
      try {
        n.stop?.();
      } catch {
        /* ignore */
      }
      try {
        n.disconnect?.();
      } catch {
        /* ignore */
      }
    }
    this._demoNodes = [];
  }

  /**
   * Plays a short power-chord-ish demo riff through the fuzz chain.
   */
  async playDemoRiff() {
    await this.ensureContext();
    await this._disconnectSource();

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const notes = [
      { f: 82.41, t: 0, dur: 0.42 }, // E2
      { f: 82.41, t: 0.45, dur: 0.28 },
      { f: 110.0, t: 0.8, dur: 0.4 }, // A2
      { f: 123.47, t: 1.25, dur: 0.55 }, // B2
      { f: 82.41, t: 1.95, dur: 0.7 },
      { f: 98.0, t: 2.75, dur: 0.35 }, // G2
      { f: 82.41, t: 3.2, dur: 0.9 },
    ];

    const mix = ctx.createGain();
    mix.gain.value = 0.35;
    mix.connect(this.inputGain);
    this._demoNodes.push(mix);

    for (const note of notes) {
      this._scheduleString(note.f, now + note.t, note.dur, mix);
      // fifth for chord body
      this._scheduleString(note.f * 1.5, now + note.t, note.dur * 0.95, mix, 0.55);
    }

    const totalMs = 4300;
    this._demoTimer = setTimeout(() => {
      this.stopDemo();
      this._demoTimer = null;
    }, totalMs + 200);

    return totalMs;
  }

  _scheduleString(freq, start, dur, dest, level = 1) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sawtooth";
    osc2.type = "square";
    osc.frequency.value = freq;
    osc2.frequency.value = freq * 2.002;

    filter.type = "lowpass";
    filter.frequency.value = 900 + Math.min(freq, 200);
    filter.Q.value = 1.2;

    const peak = 0.28 * level;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(peak * 0.55, start + dur * 0.35);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(start);
    osc2.start(start);
    osc.stop(start + dur + 0.05);
    osc2.stop(start + dur + 0.05);

    this._demoNodes.push(osc, osc2, gain, filter);
  }
}
