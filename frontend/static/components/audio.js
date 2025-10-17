(function(){
  const Engine = {
    ctx: null,
    masterGain: null,
    musicGain: null,
    sfxGain: null,
    _music: new Map(),
    _musicBuffers: new Map(),
    _sfxBuffers: new Map(),
    _currentRoute: null,
    _muted: false,
    _masterVolume: 0.75,
    _toggleButton: null,
    _musicPresets: {
      cultivation: {
        key: 'cultivation-v3',
        seed: 54101,
        tempo: 54,
        scale: 'pentatonic',
        root: 174,
        bars: 16,
        pad: true,
        sparkle: true,
        warmth: 0.4,
        volume: 0.62,
        progression: [0, 3, 5, 2],
        chordStyle: 'sustain',
        chordOctave: -1,
        arpeggio: { amp: 0.22, subdivision: 2, span: 3, swing: 0.14, randomness: 0.25, pan: 0.15 },
        melody: { density: 0.48, resolution: 2, range: [-1, 4], legato: 1.4, vibrato: 0.03, detune: 0.006, accent: 0.38, spread: 0.32, randomness: 0.28 },
        drone: { amp: 0.22, octave: -2, fifth: 0.35, shimmer: 0.18 },
        pulse: { intervalBeats: 4, width: 1.5, amp: 0.26, freq: 46, shape: 'heartbeat', noise: 0.08, spread: 0.32 },
        atmosphere: { type: 'wind', amp: 0.08, motion: 0.28, swayFreq: 0.018 },
        percussion: {
          amp: 0.14,
          hat: { rate: 1, randomness: 0.22, cutoff: 0.45, pan: -0.1 }
        }
      },
      gacha: {
        key: 'gacha-v3',
        seed: 9012,
        tempo: 132,
        scale: 'mystic',
        root: 196,
        bars: 8,
        pad: false,
        sparkle: true,
        swing: false,
        warmth: 0.46,
        volume: 0.66,
        progression: [0, 4, 1, 5],
        chordStyle: 'stabs',
        chordOctave: -1,
        arpeggio: { amp: 0.34, subdivision: 4, span: 5, randomness: 0.35, pan: 0.18 },
        melody: { density: 0.64, resolution: 4, range: [-2, 5], legato: 0.9, vibrato: 0.02, detune: 0.014, accent: 0.82, spread: 0.42, randomness: 0.42, leaps: 0.28 },
        percussion: {
          amp: 0.42,
          resolution: 4,
          kick: { pattern: [1, 0, 0.8, 0, 1, 0, 0, 0], decay: 3.5 },
          snare: { pattern: [0, 0, 1, 0], tone: 820, noise: 0.6 },
          hat: { rate: 2, shuffle: 0.22, randomness: 0.3, cutoff: 0.6 }
        },
        pulse: { intervalBeats: 0.5, width: 0.6, amp: 0.26, freq: 102, shape: 'gate', curve: 1.8, spread: 0.4 },
        bass: { subdivision: 2, length: 0.85, amp: 0.46, notes: [-12, -12, -10, -17], glide: 0.28, decay: 2.2, spread: 0.28 },
        riser: { lengthBeats: 4, amp: 0.32, freqStart: 220, freqEnd: 1880, shimmer: 0.26, curve: 1.12, spread: 0.55 }
      },
      cookie: {
        key: 'cookie-v3',
        seed: 20241,
        tempo: 118,
        scale: 'lydian',
        root: 262,
        bars: 12,
        pad: true,
        sparkle: true,
        swing: true,
        warmth: 0.52,
        volume: 0.63,
        progression: [0, 4, 5, 3],
        chordStyle: 'airy',
        chordOctave: -1,
        arpeggio: { amp: 0.28, subdivision: 2, span: 4, randomness: 0.38, swing: 0.2, pan: 0.22 },
        melody: { density: 0.72, resolution: 2, range: [0, 6], legato: 1.1, vibrato: 0.015, detune: 0.004, accent: 0.52, spread: 0.5, randomness: 0.32 },
        percussion: {
          amp: 0.26,
          resolution: 4,
          kick: { pattern: [1, 0, 0, 0], decay: 3.2 },
          snare: { pattern: [0, 0, 1, 0], tone: 680, noise: 0.4 },
          hat: { rate: 2, randomness: 0.4, swing: 0.22, cutoff: 0.52, pan: 0.18 }
        },
        pulse: { intervalBeats: 1, width: 0.55, amp: 0.2, freq: 176, shape: 'pluck', noise: 0.05, spread: 0.35 }
      }
    },
    ensure() {
      if (this.ctx || this._disabled) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        this._disabled = true;
        return;
      }
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this._masterVolume;
      this.masterGain.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.7;
      this.musicGain.connect(this.masterGain);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.85;
      this.sfxGain.connect(this.masterGain);
      const resume = async () => {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') {
          try { await this.ctx.resume(); } catch (_) {}
        }
      };
      ['pointerdown','touchstart','keydown'].forEach(evt => {
        window.addEventListener(evt, resume, { passive: true });
      });
      const saved = localStorage.getItem('delta.audio.muted');
      if (saved === '1') {
        this.setMuted(true);
      }
      this._renderToggle();
    },
    _renderToggle() {
      if (this._toggleButton || !document || !document.body) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'audio-toggle';
      btn.className = 'audio-toggle';
      btn.innerHTML = '<span class="audio-toggle__icon">🔊</span>';
      btn.addEventListener('click', () => {
        this.toggleMute();
      });
      document.body.appendChild(btn);
      this._toggleButton = btn;
      this._updateToggleIcon();
    },
    toggleMute() {
      this.setMuted(!this._muted);
    },
    setMuted(muted) {
      this.ensure();
      this._muted = !!muted;
      if (!this.masterGain) return;
      const now = this.ctx ? this.ctx.currentTime : 0;
      if (this.ctx) {
        this.masterGain.gain.cancelScheduledValues(now);
        const target = this._muted ? 0.0001 : this._masterVolume;
        this.masterGain.gain.setValueAtTime(target, now);
      }
      try {
        localStorage.setItem('delta.audio.muted', this._muted ? '1' : '0');
      } catch (_) {}
      this._updateToggleIcon();
    },
    _updateToggleIcon() {
      if (!this._toggleButton) return;
      this._toggleButton.classList.toggle('is-muted', !!this._muted);
      this._toggleButton.innerHTML = `<span class="audio-toggle__icon">${this._muted ? '🔇' : '🔊'}</span>`;
    },
    setRoute(route) {
      this.ensure();
      if (!this.ctx) return;
      if (route === this._currentRoute) {
        const preset = this._musicPresets[route];
        if (preset) {
          this.playMusic(route, preset);
        }
        return;
      }
      this._currentRoute = route;
      const preset = this._musicPresets[route];
      Array.from(this._music.keys()).forEach(channel => {
        if (!preset || channel !== route) {
          this.fadeOut(channel, 0.9);
        }
      });
      if (preset) {
        this.playMusic(route, preset);
      }
    },
    fadeOut(channel, duration = 0.6) {
      if (!this.ctx) return;
      const entry = this._music.get(channel);
      if (!entry) return;
      const now = this.ctx.currentTime;
      try {
        entry.gain.gain.cancelScheduledValues(now);
        const current = entry.gain.gain.value;
        entry.gain.gain.setValueAtTime(current, now);
        entry.gain.gain.linearRampToValueAtTime(0.0001, now + duration);
        entry.source.stop(now + duration + 0.05);
      } catch (_) {
        try { entry.source.stop(); } catch (_) {}
      }
      this._music.delete(channel);
    },
    playMusic(channel, preset = {}) {
      this.ensure();
      if (!this.ctx) return;
      const existing = this._music.get(channel);
      const signature = preset.key || channel;
      if (existing && existing.signature === signature) {
        return;
      }
      if (existing) {
        this.fadeOut(channel, 0.4);
      }
      const buffer = this._getMusicBuffer(signature, preset);
      if (!buffer) return;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = typeof preset.volume === 'number' ? preset.volume : 0.55;
      source.connect(gain).connect(this.musicGain);
      try {
        source.start();
      } catch (_) {
        return;
      }
      this._music.set(channel, { source, gain, signature });
    },
    _getMusicBuffer(key, preset) {
      if (this._musicBuffers.has(key)) {
        return this._musicBuffers.get(key);
      }
      const buffer = this._generateMusic(preset);
      if (buffer) {
        this._musicBuffers.set(key, buffer);
      }
      return buffer;
    },
    _rng(seed) {
      let s = seed % 2147483647;
      if (s <= 0) s += 2147483646;
      return () => {
        s = s * 16807 % 2147483647;
        return (s - 1) / 2147483646;
      };
    },
    _scale(name) {
      switch ((name || '').toLowerCase()) {
        case 'pentatonic': return [0, 2, 4, 7, 9];
        case 'lydian': return [0, 2, 4, 6, 7, 9, 11];
        case 'mystic': return [0, 3, 5, 6, 10];
        case 'major':
        default: return [0, 2, 4, 5, 7, 9, 11];
      }
    },
    _generateMusic(preset = {}) {
      if (!this.ctx) return null;
      const tempo = preset.tempo || 96;
      const beatsPerBar = preset.beats || 4;
      const bars = preset.bars || 8;
      const totalBeats = beatsPerBar * bars;
      const secondsPerBeat = 60 / tempo;
      const duration = totalBeats * secondsPerBeat;
      const sampleRate = this.ctx.sampleRate;
      const length = Math.max(1, Math.floor(duration * sampleRate));
      const buffer = this.ctx.createBuffer(2, length, sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      const rng = this._rng(preset.seed || 1337);
      const scale = this._scale(preset.scale);
      const root = preset.root || 220;
      const melodyGain = typeof preset.warmth === 'number' ? preset.warmth : 0.5;
      const padGain = preset.pad ? 0.25 : 0.12;
      const sparkleGain = preset.sparkle ? 0.14 : 0.05;
      const swing = !!preset.swing;

      const writeTone = (startBeat, beatLength, freq, amp, pan, opts = {}) => {
        if (!Number.isFinite(freq) || freq <= 0 || amp <= 0 || beatLength <= 0) return;
        const startSample = Math.floor(startBeat * secondsPerBeat * sampleRate);
        if (startSample >= length) return;
        const toneSamples = Math.min(length - startSample, Math.floor(Math.max(beatLength, 0.02) * secondsPerBeat * sampleRate));
        if (toneSamples <= 0) return;
        const spread = typeof opts.spread === 'number' ? opts.spread : 0.6;
        const panLeft = pan <= 0 ? 1 : 1 - pan * spread;
        const panRight = pan >= 0 ? 1 : 1 + pan * spread;
        const attackPortion = Math.min(Math.max(opts.attackPortion ?? 0.18, 0.01), 0.7);
        const attackCurve = opts.attackCurve ?? 1.6;
        const releaseCurve = opts.releaseCurve ?? 2.0;
        const sustain = Math.min(Math.max(opts.sustain ?? 0, 0), 0.95);
        const vibrato = opts.vibrato ?? 0;
        const vibratoFreq = opts.vibratoFreq ?? 5.2;
        const detune = opts.detune ?? 0;
        const noise = opts.noise ?? 0;
        const wave = (opts.wave || 'sine').toLowerCase();
        let phase = Number.isFinite(opts.phase) ? opts.phase : rng() * Math.PI * 2;
        let cycle = phase / (2 * Math.PI);
        for (let i = 0; i < toneSamples; i++) {
          const idx = startSample + i;
          if (idx >= length) break;
          const progress = toneSamples <= 1 ? 0 : i / toneSamples;
          let envelope;
          if (sustain > 0 && progress > sustain) {
            const sustainNorm = (progress - sustain) / Math.max(1e-6, 1 - sustain);
            envelope = Math.pow(Math.max(0, 1 - sustainNorm), releaseCurve);
          } else if (progress < attackPortion) {
            const attackNorm = progress / Math.max(attackPortion, 1e-6);
            envelope = Math.pow(Math.min(1, attackNorm), attackCurve);
          } else {
            const releaseNorm = (progress - attackPortion) / Math.max(1e-6, 1 - attackPortion);
            envelope = Math.pow(Math.max(0, 1 - releaseNorm), releaseCurve);
          }
          const t = i / sampleRate;
          const vib = vibrato ? Math.sin(2 * Math.PI * vibratoFreq * t) * vibrato : 0;
          const freqNow = freq * Math.pow(2, (detune + vib) / 12);
          cycle += freqNow / sampleRate;
          let osc;
          const cyclePhase = cycle % 1;
          switch (wave) {
            case 'triangle':
              osc = 1 - 4 * Math.abs(0.5 - cyclePhase);
              break;
            case 'square':
              osc = cyclePhase < 0.5 ? 1 : -1;
              break;
            case 'saw':
              osc = 2 * (cyclePhase - 0.5);
              break;
            default:
              osc = Math.sin(2 * Math.PI * cyclePhase);
          }
          if (noise) {
            osc = osc * (1 - noise) + (rng() * 2 - 1) * noise;
          }
          const value = osc * amp * envelope;
          left[idx] += value * panLeft;
          right[idx] += value * panRight;
        }
      };

      const writeStereo = (idx, value, pan = 0, spread = 0.6) => {
        const panLeft = pan <= 0 ? 1 : 1 - pan * spread;
        const panRight = pan >= 0 ? 1 : 1 + pan * spread;
        left[idx] += value * panLeft;
        right[idx] += value * panRight;
      };

      const resolveDegree = (degree, octaveShift = 0) => {
        const len = scale.length || 1;
        const normal = ((degree % len) + len) % len;
        const base = scale[normal];
        const octave = Math.floor(degree / len) + octaveShift;
        return base + 12 * octave;
      };
      const toFreq = (semi) => root * Math.pow(2, semi / 12);

      const chordStyle = String(preset.chordStyle || 'triad').toLowerCase();
      let chordSteps;
      switch (chordStyle) {
        case 'sustain':
          chordSteps = [0, 2, 4, 6];
          break;
        case 'airy':
          chordSteps = [0, 2, 5];
          break;
        case 'stabs':
          chordSteps = [0, 2, 4];
          break;
        default:
          chordSteps = [0, 2, 4];
      }
      if (!Array.isArray(chordSteps) || !chordSteps.length) chordSteps = [0, 2, 4];

      const progressionDegrees = Array.isArray(preset.progression) && preset.progression.length ? preset.progression : [0];
      const chordOctave = Number.isFinite(preset.chordOctave) ? preset.chordOctave : 0;
      const progression = [];
      for (let bar = 0; bar < bars; bar++) {
        progression.push(progressionDegrees[bar % progressionDegrees.length]);
      }

      const chordFreqs = progression.map(degree => {
        return chordSteps.map((step, idx) => {
          const offset = Array.isArray(preset.chordOffsets) && Number.isFinite(preset.chordOffsets[idx]) ? preset.chordOffsets[idx] : 0;
          return toFreq(resolveDegree(degree + step, chordOctave + offset));
        });
      });

      const droneCfg = preset.drone || null;
      if (droneCfg && droneCfg.amp > 0) {
        const droneOctave = Number.isFinite(droneCfg.octave) ? droneCfg.octave : -2;
        const baseFreq = toFreq(resolveDegree(0, droneOctave));
        const droneLength = totalBeats + beatsPerBar;
        writeTone(0, droneLength, baseFreq, droneCfg.amp, 0, {
          attackPortion: 0.55,
          releaseCurve: 3.6,
          vibrato: droneCfg.vibrato ?? 0.012,
          detune: (rng() * 2 - 1) * 0.004,
          noise: 0.015,
          spread: 0.4,
          sustain: 0.82
        });
        if (droneCfg.fifth) {
          const fifthSemi = scale.length >= 4 ? resolveDegree(3, droneOctave - 1) : resolveDegree(2, droneOctave - 1);
          const fifthAmp = droneCfg.amp * Math.max(0, Math.min(1, droneCfg.fifth));
          writeTone(0, droneLength, toFreq(fifthSemi), fifthAmp, 0.24, {
            attackPortion: 0.5,
            releaseCurve: 3.0,
            vibrato: 0.01,
            detune: (rng() * 2 - 1) * 0.003,
            noise: 0.01,
            spread: 0.45
          });
        }
        if (droneCfg.shimmer) {
          for (let bar = 1; bar < bars; bar += 2) {
            const shimmerFreq = baseFreq * 2;
            const shimmerStart = bar * beatsPerBar + beatsPerBar * 0.6;
            writeTone(shimmerStart, beatsPerBar * 0.9, shimmerFreq, droneCfg.amp * droneCfg.shimmer, 0.3, {
              attackPortion: 0.25,
              releaseCurve: 3.2,
              vibrato: 0.02,
              detune: (rng() * 2 - 1) * 0.006,
              noise: 0.02,
              spread: 0.6
            });
          }
        }
      }

      if (padGain > 0 && chordFreqs.length) {
        chordFreqs.forEach((voices, bar) => {
          const denom = Math.max(1, voices.length - 1);
          voices.forEach((freq, idx) => {
            const pan = voices.length === 1 ? 0 : (idx / denom) * 0.9 - 0.45;
            const voiceAmp = padGain * (1 - idx * 0.18);
            const attack = chordStyle === 'sustain' ? 0.45 : 0.3;
            const vibratoAmt = chordStyle === 'sustain' ? 0.018 : 0.01;
            writeTone(bar * beatsPerBar, beatsPerBar * 1.08, freq, voiceAmp, pan, {
              attackPortion: attack,
              releaseCurve: 2.8,
              vibrato: vibratoAmt,
              detune: (rng() * 2 - 1) * 0.01,
              noise: 0.02,
              spread: 0.55,
              sustain: 0.68
            });
          });
        });
      }

      const arpeggioCfg = preset.arpeggio || null;
      if (arpeggioCfg && arpeggioCfg.amp > 0 && chordFreqs.length) {
        const subdivision = Math.max(1, Math.round(arpeggioCfg.subdivision || 2));
        const stepBeat = 1 / subdivision;
        const basePan = Math.max(-1, Math.min(1, arpeggioCfg.pan || 0));
        const randomness = arpeggioCfg.randomness || 0;
        const span = Math.max(chordFreqs[0]?.length || 1, Math.round(arpeggioCfg.span || chordFreqs[0]?.length || 1));
        let patternIndex = 0;
        for (let beatPos = 0; beatPos < totalBeats; beatPos += stepBeat) {
          const bar = Math.floor(beatPos / beatsPerBar) % chordFreqs.length;
          const voices = chordFreqs[bar] || [];
          if (!voices.length) continue;
          const pool = voices.slice();
          while (pool.length < span) {
            const octaveLayer = Math.floor(pool.length / voices.length) + 1;
            const source = voices[pool.length % voices.length];
            pool.push(source * Math.pow(2, Math.min(octaveLayer, 2)));
          }
          const voice = pool[patternIndex % pool.length];
          const swingOffset = swing && (Math.floor(beatPos / stepBeat) % 2 === 1) ? (arpeggioCfg.swing || 0.2) * stepBeat : 0;
          const startBeat = beatPos + swingOffset;
          const lengthBeats = stepBeat * (arpeggioCfg.length || 0.9);
          const pan = basePan + (rng() * 2 - 1) * randomness;
          const amp = Math.max(0.05, arpeggioCfg.amp * (0.85 + (rng() * 2 - 1) * 0.12));
          writeTone(startBeat, lengthBeats, voice, amp, Math.max(-1, Math.min(1, pan)), {
            attackPortion: 0.16,
            releaseCurve: 2.4,
            vibrato: 0.01 + randomness * 0.02,
            detune: (rng() * 2 - 1) * 0.012,
            noise: 0.03,
            spread: 0.55
          });
          patternIndex++;
        }
      }

      const melodyCfg = Object.assign({
        density: 0.6,
        resolution: 2,
        range: [-1, 4],
        legato: 1,
        vibrato: 0,
        detune: 0.005,
        accent: 0.6,
        spread: 0.4,
        randomness: 0.3,
        leaps: 0.2,
        octave: 1,
        lengthJitter: 0.35
      }, preset.melody || {});
      const melodyStep = 1 / Math.max(1, Math.round(melodyCfg.resolution || 2));
      const chordish = [0, 2, 4, 6];
      const motifLength = Math.max(2, Math.round(melodyCfg.motifLength || 4));
      const minRange = Math.floor(Array.isArray(melodyCfg.range) ? melodyCfg.range[0] : -1);
      const maxRange = Math.ceil(Array.isArray(melodyCfg.range) ? melodyCfg.range[1] : 4);
      const motif = [];
      for (let i = 0; i < motifLength; i++) {
        if (rng() < 0.6) {
          motif.push(chordish[i % chordish.length]);
        } else {
          motif.push(minRange + Math.round(rng() * (maxRange - minRange)));
        }
      }
      let motifIdx = 0;
      let lastDegree = null;
      for (let beatPos = 0; beatPos < totalBeats; beatPos += melodyStep) {
        const barIndex = Math.floor(beatPos / beatsPerBar);
        const chordDegree = progression[barIndex % progression.length];
        const stepInBar = Math.floor((beatPos % beatsPerBar) / melodyStep);
        const densityBoost = stepInBar === 0 ? 1.2 : 1;
        if (rng() > melodyCfg.density * densityBoost) {
          if (stepInBar === 0) motifIdx++;
          continue;
        }
        let degree = chordDegree + motif[(motifIdx + stepInBar) % motif.length];
        if (melodyCfg.randomness && rng() < melodyCfg.randomness) {
          degree += rng() < 0.5 ? -1 : 1;
        }
        if (melodyCfg.leaps && rng() < melodyCfg.leaps) {
          degree += (rng() < 0.5 ? -1 : 1) * scale.length;
        }
        if (lastDegree != null && Math.abs(degree - lastDegree) < 0.1 && rng() < 0.35) {
          if (stepInBar === 0) motifIdx++;
          continue;
        }
        lastDegree = degree;
        const semitone = resolveDegree(degree, Number.isFinite(melodyCfg.octave) ? melodyCfg.octave : 1);
        const freq = toFreq(semitone);
        const lengthBeats = Math.max(melodyStep * (melodyCfg.legato || 1), melodyStep * 0.6) * (1 + (rng() * 2 - 1) * (melodyCfg.lengthJitter || 0.3));
        const pan = (rng() * 2 - 1) * (melodyCfg.spread || 0.4);
        const accent = stepInBar === 0 ? (melodyCfg.accent || 0.6) : 0.3 * (melodyCfg.accent || 0.6);
        const amp = melodyGain * Math.max(0.25, Math.min(1.2, 0.82 + accent + (rng() * 2 - 1) * 0.1));
        writeTone(beatPos, lengthBeats, freq, amp, pan, {
          attackPortion: 0.22,
          releaseCurve: 2.6,
          vibrato: melodyCfg.vibrato || 0,
          detune: (rng() * 2 - 1) * (melodyCfg.detune || 0.006),
          noise: melodyCfg.noise || 0,
          spread: 0.5
        });
        if (rng() < 0.22) {
          const echoFreq = freq * 2;
          writeTone(beatPos + melodyStep * 0.5, lengthBeats * 0.6, echoFreq, amp * 0.35, -pan * 0.6, {
            attackPortion: 0.14,
            releaseCurve: 2.2,
            vibrato: melodyCfg.vibrato ? melodyCfg.vibrato * 1.1 : 0.01,
            detune: (rng() * 2 - 1) * (melodyCfg.detune || 0.006),
            noise: 0.02,
            spread: 0.6
          });
        }
        if (stepInBar === 0) motifIdx++;
      }

      const percussionCfg = preset.percussion || null;
      if (percussionCfg && percussionCfg.amp > 0) {
        const percussionAmp = percussionCfg.amp;
        const resolution = Math.max(1, Math.round(percussionCfg.resolution || 4));
        const stepBeat = 1 / resolution;
        const stepsPerBar = Math.max(1, Math.round(beatsPerBar * resolution));
        const totalSteps = Math.ceil(totalBeats * resolution);
        const kickPattern = percussionCfg.kick && Array.isArray(percussionCfg.kick.pattern) ? percussionCfg.kick.pattern : null;
        const snarePattern = percussionCfg.snare && Array.isArray(percussionCfg.snare.pattern) ? percussionCfg.snare.pattern : null;
        const kickDecay = percussionCfg.kick && Number.isFinite(percussionCfg.kick.decay) ? percussionCfg.kick.decay : 3.2;
        const snareTone = percussionCfg.snare && Number.isFinite(percussionCfg.snare.tone) ? percussionCfg.snare.tone : 720;
        const snareNoise = percussionCfg.snare && Number.isFinite(percussionCfg.snare.noise) ? percussionCfg.snare.noise : 0.5;
        const hatCfg = percussionCfg.hat || null;
        const hatRate = hatCfg && hatCfg.rate ? Math.max(0.25, hatCfg.rate) : 0;
        const hatSwing = hatCfg && Number.isFinite(hatCfg.swing) ? hatCfg.swing : 0;
        const hatPan = hatCfg && Number.isFinite(hatCfg.pan) ? hatCfg.pan : 0.18;
        const hatRandomness = hatCfg && Number.isFinite(hatCfg.randomness) ? hatCfg.randomness : 0;
        const hatCutoff = hatCfg && Number.isFinite(hatCfg.cutoff) ? Math.min(Math.max(hatCfg.cutoff, 0), 0.95) : 0.5;
        const baseShuffle = hatCfg && Number.isFinite(hatCfg.shuffle) ? hatCfg.shuffle : 0;
        const maybeHit = (pattern, idx) => {
          if (!Array.isArray(pattern) || !pattern.length) return 0;
          const raw = pattern[idx % pattern.length];
          if (!raw) return 0;
          const value = Number(raw);
          return Number.isFinite(value) ? value : 1;
        };
        const renderKick = (startBeat, velocity) => {
          const start = Math.floor(startBeat * secondsPerBeat * sampleRate);
          const len = Math.max(1, Math.floor(secondsPerBeat * sampleRate * 0.8));
          let phase = 0;
          for (let j = 0; j < len; j++) {
            const idx = start + j;
            if (idx >= length) break;
            const progress = len <= 1 ? 0 : j / len;
            const env = Math.pow(1 - progress, kickDecay);
            const freqEnv = 140 + 80 * Math.pow(1 - progress, 2.4);
            phase += freqEnv / sampleRate;
            const osc = Math.sin(2 * Math.PI * phase) + 0.2 * Math.sin(4 * Math.PI * phase);
            writeStereo(idx, osc * env * velocity * percussionAmp * 0.9, 0, 0.25);
          }
        };
        const renderSnare = (startBeat, velocity) => {
          const start = Math.floor(startBeat * secondsPerBeat * sampleRate);
          const len = Math.max(1, Math.floor(secondsPerBeat * sampleRate * 0.65));
          let phase = 0;
          for (let j = 0; j < len; j++) {
            const idx = start + j;
            if (idx >= length) break;
            const progress = len <= 1 ? 0 : j / len;
            const env = Math.pow(1 - progress, 3.2);
            const freq = snareTone * (1 + 0.25 * Math.pow(1 - progress, 2));
            phase += freq / sampleRate;
            const tone = Math.sin(2 * Math.PI * phase) * 0.55;
            const noise = (rng() * 2 - 1) * snareNoise;
            const value = (tone + noise) * env * velocity * percussionAmp * 0.75;
            writeStereo(idx, value, 0.05, 0.55);
          }
        };
        const renderHat = (startBeat, velocity) => {
          const start = Math.floor(startBeat * secondsPerBeat * sampleRate);
          const len = Math.max(1, Math.floor(secondsPerBeat * sampleRate * 0.35));
          let filter = 0;
          for (let j = 0; j < len; j++) {
            const idx = start + j;
            if (idx >= length) break;
            const progress = len <= 1 ? 0 : j / len;
            const env = Math.pow(1 - progress, 4.6);
            const raw = (rng() * 2 - 1);
            filter = filter * hatCutoff + raw * (1 - hatCutoff);
            const pan = Math.max(-1, Math.min(1, hatPan + (rng() * 2 - 1) * 0.25));
            writeStereo(idx, filter * env * velocity * percussionAmp * 0.5, pan, 0.7);
          }
        };
        let hatTimer = 0;
        const hatInterval = hatRate > 0 ? 1 / hatRate : 0;
        for (let step = 0; step < totalSteps; step++) {
          const beatPos = step * stepBeat;
          const barStep = step % stepsPerBar;
          const downbeat = barStep === 0;
          const grooveShift = swing && step % 2 === 1 ? 0.04 : 0;
          const shuffle = baseShuffle ? Math.sin(step / 2) * baseShuffle * 0.2 : 0;
          const kickValue = maybeHit(kickPattern, barStep);
          if (kickValue) {
            renderKick(beatPos + grooveShift, Math.max(0.6, kickValue));
          }
          const snareValue = maybeHit(snarePattern, barStep);
          if (snareValue) {
            renderSnare(beatPos + grooveShift + shuffle * stepBeat, Math.max(0.6, snareValue));
          }
          if (hatRate > 0) {
            hatTimer += stepBeat;
            while (hatTimer >= hatInterval - 1e-6) {
              hatTimer -= hatInterval;
              const jitter = (rng() * 2 - 1) * hatRandomness * stepBeat * 0.6;
              const swingOffset = hatSwing ? hatSwing * stepBeat * (step % 2 === 1 ? 1 : -0.5) : 0;
              const startBeat = beatPos + hatTimer + jitter + swingOffset;
              const velocity = downbeat ? 1 : 0.82 + (rng() * 2 - 1) * 0.12;
              if (startBeat >= 0) {
                renderHat(startBeat, velocity);
              }
            }
          }
        }
      }

      // structured percussion replaces the legacy beat-noise texture

      const pulseCfg = preset.pulse || null;
      if (pulseCfg && pulseCfg.amp > 0) {
        const interval = Math.max(pulseCfg.intervalBeats || 4, 0.25);
        const width = Math.max(pulseCfg.width || 0.8, 0.1);
        const baseFreq = pulseCfg.freq || 60;
        const pan = Math.max(-1, Math.min(1, typeof pulseCfg.pan === 'number' ? pulseCfg.pan : 0));
        const spread = pulseCfg.spread || 0.5;
        for (let beatPos = 0; beatPos < totalBeats + interval; beatPos += interval) {
          const start = Math.floor(beatPos * secondsPerBeat * sampleRate);
          const len = Math.max(1, Math.floor(secondsPerBeat * sampleRate * width));
          const phaseOffset = pulseCfg.randomPhase ? rng() * Math.PI * 2 : 0;
          for (let j = 0; j < len; j++) {
            const idx = start + j;
            if (idx >= length) break;
            const progress = len <= 1 ? 0 : j / len;
            let envelope;
            switch (pulseCfg.shape) {
              case 'heartbeat': {
                const tightness = pulseCfg.beatTightness || 11;
                const primary = Math.exp(-Math.pow((progress - 0.22) * tightness, 2));
                const secondary = 0.6 * Math.exp(-Math.pow((progress - 0.55) * tightness * 1.25, 2));
                envelope = (primary + secondary) * (1 - progress * 0.45);
                break;
              }
              case 'pluck':
                envelope = Math.pow(1 - progress, pulseCfg.decay || 4.2) * Math.pow(progress, pulseCfg.attack || 0.35);
                break;
              case 'gate':
                envelope = Math.pow(Math.max(0, 1 - Math.abs(progress - 0.5) * 2), pulseCfg.curve || 1.5);
                break;
              default:
                envelope = Math.pow(1 - progress, pulseCfg.decay || 3.2) * Math.pow(progress, pulseCfg.attack || 0.8);
            }
            const freqMod = baseFreq * (pulseCfg.glide ? (1 + pulseCfg.glide * progress) : 1);
            const t = j / sampleRate;
            let osc = Math.sin(phaseOffset + 2 * Math.PI * freqMod * t);
            if (pulseCfg.wave === 'triangle') {
              osc = 2 / Math.PI * Math.asin(Math.sin(phaseOffset + 2 * Math.PI * freqMod * t));
            } else if (pulseCfg.wave === 'square') {
              osc = Math.sign(Math.sin(phaseOffset + 2 * Math.PI * freqMod * t));
            }
            if (pulseCfg.noise) {
              osc += (rng() * 2 - 1) * pulseCfg.noise * envelope;
            }
            writeStereo(idx, osc * envelope * pulseCfg.amp, pan, spread);
          }
        }
      }

      const bassCfg = preset.bass || null;
      if (bassCfg && bassCfg.amp > 0) {
        const subdivision = Math.max(1, Math.floor(bassCfg.subdivision || 1));
        const width = Math.max(0.1, Math.min(2, bassCfg.length || 1));
        const notes = Array.isArray(bassCfg.notes) && bassCfg.notes.length ? bassCfg.notes : [0];
        const pattern = Array.isArray(bassCfg.pattern) && bassCfg.pattern.length ? bassCfg.pattern : null;
        const pan = Math.max(-1, Math.min(1, bassCfg.pan || 0));
        const spread = bassCfg.spread || 0.4;
        let step = 0;
        for (let beatPos = 0; beatPos < totalBeats; beatPos += 1 / subdivision) {
          if (pattern && !pattern[step % pattern.length]) {
            step++;
            continue;
          }
          const start = Math.floor(beatPos * secondsPerBeat * sampleRate);
          const len = Math.max(1, Math.floor(secondsPerBeat * sampleRate * width));
          const note = notes[step % notes.length] || 0;
          const baseFreq = bassCfg.baseFreq || root;
          const freq = baseFreq * Math.pow(2, note / 12);
          let phase = 0;
          for (let j = 0; j < len; j++) {
            const idx = start + j;
            if (idx >= length) break;
            const progress = len <= 1 ? 0 : j / len;
            const attack = typeof bassCfg.attack === 'number' ? bassCfg.attack : 0.25;
            const decay = typeof bassCfg.decay === 'number' ? bassCfg.decay : 2.4;
            const envelope = Math.pow(1 - progress, decay) * Math.pow(progress, attack);
            const glide = bassCfg.glide || 0;
            const currentFreq = freq * (1 + glide * progress);
            phase += currentFreq / sampleRate;
            let osc = Math.sin(phase * 2 * Math.PI);
            if (bassCfg.wave === 'saw') {
              const cycle = phase % 1;
              osc = 2 * (cycle - 0.5);
            }
            writeStereo(idx, osc * envelope * bassCfg.amp, pan, spread);
          }
          step++;
        }
      }

      const riserCfg = preset.riser || null;
      if (riserCfg && riserCfg.amp > 0) {
        const lengthBeats = Math.max(riserCfg.lengthBeats || bars, 1);
        const riserDuration = lengthBeats * secondsPerBeat;
        const startTime = Math.max(0, duration - riserDuration);
        const start = Math.floor(startTime * sampleRate);
        const len = length - start;
        if (len > 0) {
          let phase = 0;
          const spread = riserCfg.spread || 0.6;
          for (let j = 0; j < len; j++) {
            const idx = start + j;
            if (idx >= length) break;
            const progress = len <= 1 ? 0 : j / len;
            const freqStart = riserCfg.freqStart || root;
            const freqEnd = riserCfg.freqEnd || freqStart * 4;
            const curve = riserCfg.curve || 1;
            const freq = freqStart * Math.pow(freqEnd / freqStart, Math.pow(progress, curve));
            phase += freq / sampleRate;
            let osc = Math.sin(phase * 2 * Math.PI);
            if (riserCfg.shimmer) {
              osc += Math.sin(phase * 4 * Math.PI) * riserCfg.shimmer;
            }
            const envelope = Math.pow(progress, riserCfg.attack || 1.2);
            writeStereo(idx, osc * envelope * riserCfg.amp, riserCfg.pan || 0, spread);
          }
        }
      }

      const atmosphereCfg = preset.atmosphere || null;
      if (atmosphereCfg && atmosphereCfg.amp > 0) {
        const spread = atmosphereCfg.spread || 0.5;
        const motion = atmosphereCfg.motion || 0;
        const swayFreq = atmosphereCfg.swayFreq || 0.05;
        const basePan = Math.max(-1, Math.min(1, atmosphereCfg.pan || 0));
        let smooth = 0;
        for (let i = 0; i < length; i++) {
          const t = i / sampleRate;
          let value = (rng() * 2 - 1);
          if (atmosphereCfg.type === 'wind') {
            smooth = smooth * 0.92 + value * 0.08;
            value = smooth;
          } else if (atmosphereCfg.type === 'water') {
            value = Math.sin(2 * Math.PI * 0.4 * t) * 0.6 + Math.sin(2 * Math.PI * 0.55 * t + 1.1) * 0.4;
          } else if (atmosphereCfg.type === 'glimmer') {
            value = Math.sin(2 * Math.PI * (atmosphereCfg.freq || 7) * t) * 0.7 + (rng() * 2 - 1) * 0.2;
          }
          const pan = basePan + Math.sin(2 * Math.PI * swayFreq * t) * motion;
          writeStereo(i, value * atmosphereCfg.amp, pan, spread);
        }
      }

      if (sparkleGain > 0 && progression.length) {
        const sparkCount = Math.max(4, Math.floor(totalBeats / 1.5));
        for (let i = 0; i < sparkCount; i++) {
          const beatStart = rng() * totalBeats;
          const barIndex = Math.floor(beatStart / beatsPerBar);
          const chordDegree = progression[barIndex % progression.length];
          const noteStep = (i * 2 + barIndex) % scale.length;
          const semitone = resolveDegree(chordDegree + noteStep + scale.length, 2);
          const freq = toFreq(semitone);
          const pan = (rng() * 2 - 1) * 0.55;
          const lengthBeats = 0.45 + rng() * 0.25;
          writeTone(beatStart, lengthBeats, freq, sparkleGain * 0.75, pan, {
            attackPortion: 0.18,
            releaseCurve: 2.4,
            vibrato: 0.03,
            detune: (rng() * 2 - 1) * 0.02,
            noise: 0.02,
            spread: 0.65
          });
        }
      }

      this._denoiseStereo(left, right);
      this._smoothBuffer(left);
      this._smoothBuffer(right);
      this._normalizeStereo(left, right, 0.85);
      return buffer;
    },
    _denoiseStereo(left, right, cutoff = 0.995) {
      let prevOutL = 0;
      let prevInL = 0;
      let prevOutR = 0;
      let prevInR = 0;
      for (let i = 0; i < left.length; i++) {
        const inputL = left[i];
        const inputR = right[i];
        const outL = cutoff * (prevOutL + inputL - prevInL);
        const outR = cutoff * (prevOutR + inputR - prevInR);
        prevOutL = outL;
        prevInL = inputL;
        prevOutR = outR;
        prevInR = inputR;
        left[i] = outL;
        right[i] = outR;
      }
    },
    _smoothBuffer(channel) {
      for (let i = 1; i < channel.length; i++) {
        channel[i] = channel[i] * 0.8 + channel[i - 1] * 0.2;
      }
    },
    _normalizeStereo(left, right, target = 0.9) {
      let peak = 0;
      for (let i = 0; i < left.length; i++) {
        const l = Math.abs(left[i]);
        const r = Math.abs(right[i]);
        if (l > peak) peak = l;
        if (r > peak) peak = r;
      }
      if (peak === 0) return;
      const scale = target / peak;
      for (let i = 0; i < left.length; i++) {
        left[i] *= scale;
        right[i] *= scale;
      }
    },
    playSfx(name, opts = {}) {
      if (!name) return;
      this.ensure();
      if (!this.ctx || this._muted) return;
      const key = this._resolveSfxKey(name, opts);
      const buffer = this._getSfxBuffer(key, name, opts);
      if (!buffer) return;
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        if (opts.playbackRate) {
          source.playbackRate.value = opts.playbackRate;
        }
        const gain = this.ctx.createGain();
        const volume = typeof opts.volume === 'number' ? opts.volume : 1;
        gain.gain.value = volume;
        source.connect(gain).connect(this.sfxGain);
        source.start();
      } catch (_) {}
    },
    _resolveSfxKey(name, opts) {
      switch (name) {
        case 'rarity':
        case 'gacha-rarity': {
          const rarity = String(opts.rarity || 'common').toUpperCase();
          const flags = [rarity, opts.diamond ? 'D' : '', opts.exquisite ? 'E' : ''];
          return `rarity:${flags.join('')}`;
        }
        case 'trial-result': {
          const fortune = String(opts.fortune || '').toLowerCase();
          return `trial-result:${opts.passed ? 'pass' : 'fail'}:${fortune}`;
        }
        default:
          return name;
      }
    },
    _getSfxBuffer(key, name, opts) {
      if (this._sfxBuffers.has(key)) {
        return this._sfxBuffers.get(key);
      }
      const descriptor = this._buildSfxDescriptor(name, opts);
      if (!descriptor) return null;
      const buffer = this._renderSfx(descriptor);
      if (buffer) {
        this._sfxBuffers.set(key, buffer);
      }
      return buffer;
    },
    _buildSfxDescriptor(name, opts = {}) {
      const rngSeed = Math.floor(Math.abs((opts.seed || 0)) + 1) * 7919 + name.length * 997;
      const base = { duration: 1.2, steps: [], seed: rngSeed };
      switch (name) {
        case 'ui-tap':
          base.duration = 0.25;
          base.steps = [
            { offset: 0, length: 0.22, shape: 'triangle', freq: 640, freqEnd: 520, amp: 0.7, attack: 1.8, decay: 2.4 }
          ];
          break;
        case 'refresh':
          base.duration = 0.5;
          base.steps = [
            { offset: 0, length: 0.18, shape: 'triangle', freq: 520, freqEnd: 620, amp: 0.6, attack: 2.2, decay: 2.2 },
            { offset: 0.18, length: 0.24, shape: 'noise', amp: 0.25, decay: 3.6 }
          ];
          break;
        case 'refresh-complete':
          base.duration = 0.6;
          base.steps = [
            { offset: 0, length: 0.28, shape: 'triangle', freq: 720, freqEnd: 880, amp: 0.65, attack: 2.2, decay: 3.1 },
            { offset: 0.2, length: 0.28, shape: 'sine', freq: 990, freqEnd: 1240, amp: 0.55, attack: 1.5, decay: 2.4 }
          ];
          break;
        case 'talent-select': {
          const rarity = String(opts.rarity || '').toLowerCase();
          const baseFreq = rarity === 'gold' ? 980 : rarity === 'purple' ? 820 : rarity === 'blue' ? 700 : 560;
          const dir = opts.selected ? 1 : -1;
          base.duration = 0.4;
          base.steps = [
            { offset: 0, length: 0.24, shape: 'sine', freq: baseFreq, freqEnd: baseFreq + dir * 120, amp: 0.6, attack: 2.0, decay: 2.4 },
            { offset: 0.18, length: 0.18, shape: 'noise', amp: 0.18, decay: 3.0 }
          ];
          break;
        }
        case 'lineage':
          base.duration = 0.45;
          base.steps = [
            { offset: 0, length: 0.25, shape: 'triangle', freq: 520, freqEnd: 660, amp: 0.6, attack: 2.2, decay: 2.8 },
            { offset: 0.05, length: 0.25, shape: 'sine', freq: 390, freqEnd: 450, amp: 0.4, attack: 1.5, decay: 2.1 }
          ];
          break;
        case 'stat-adjust':
          base.duration = 0.3;
          base.steps = [
            { offset: 0, length: 0.18, shape: 'square', freq: 480, freqEnd: 520, amp: 0.55, attack: 2, decay: 2.6 }
          ];
          break;
        case 'run-start':
          base.duration = 0.9;
          base.steps = [
            { offset: 0, length: 0.5, shape: 'sine', freq: 420, freqEnd: 880, amp: 0.6, attack: 1.8, decay: 2.4 },
            { offset: 0.3, length: 0.45, shape: 'noise', amp: 0.22, decay: 3.3 }
          ];
          break;
        case 'event':
          base.duration = 0.8;
          base.steps = [
            { offset: 0, length: 0.5, shape: 'sine', freq: 460, freqEnd: 540, amp: 0.5, attack: 2.0, decay: 2.6 },
            { offset: 0.18, length: 0.4, shape: 'triangle', freq: 680, freqEnd: 760, amp: 0.42, attack: 1.7, decay: 2.8 }
          ];
          if (opts.trial) {
            base.steps.push({ offset: 0.4, length: 0.35, shape: 'noise', amp: 0.18, decay: 4.2 });
          }
          break;
        case 'choice':
          base.duration = 0.4;
          base.steps = [
            { offset: 0, length: 0.22, shape: 'triangle', freq: 540, freqEnd: 620, amp: 0.55, attack: 2, decay: 2.2 },
            { offset: 0.14, length: 0.2, shape: 'noise', amp: 0.16, decay: 3.5 }
          ];
          break;
        case 'trial-spin':
          base.duration = 1.2;
          base.steps = [
            { offset: 0, length: 1.2, shape: 'sine', freq: 420, freqEnd: 780, amp: 0.45, attack: 1.2, decay: 2.6 },
            { offset: 0, length: 1.1, shape: 'noise', amp: 0.2, decay: 4.4 }
          ];
          break;
        case 'trial-result': {
          const passed = !!opts.passed;
          const fortune = String(opts.fortune || '').toLowerCase();
          const freq = passed ? 760 : 320;
          base.duration = 0.9;
          base.steps = [
            { offset: 0, length: 0.5, shape: 'triangle', freq, freqEnd: freq + (passed ? 180 : -120), amp: 0.65, attack: 2.2, decay: 2.8 }
          ];
          if (fortune === '吉' || fortune === '大吉') {
            base.steps.push({ offset: 0.32, length: 0.36, shape: 'sine', freq: 960, freqEnd: 1200, amp: 0.5, attack: 1.4, decay: 2.2 });
          }
          if (!passed) {
            base.steps.push({ offset: 0.25, length: 0.45, shape: 'noise', amp: 0.22, decay: 3.6 });
          }
          break;
        }
        case 'ending':
          base.duration = 1.5;
          base.steps = [
            { offset: 0, length: 1.1, shape: 'sine', freq: 520, freqEnd: 960, amp: 0.55, attack: 1.2, decay: 3.2 },
            { offset: 0.4, length: 0.7, shape: 'triangle', freq: 780, freqEnd: 1040, amp: 0.4, attack: 1.5, decay: 2.6 }
          ];
          break;
        case 'ending-confirm':
          base.duration = 0.5;
          base.steps = [
            { offset: 0, length: 0.28, shape: 'triangle', freq: 660, freqEnd: 820, amp: 0.6, attack: 2.0, decay: 2.6 }
          ];
          break;
        case 'gacha-start':
          base.duration = 1.2;
          base.steps = [
            { offset: 0, length: 1.0, shape: 'noise', amp: 0.25, decay: 3.6 },
            { offset: 0, length: 0.8, shape: 'sine', freq: 360, freqEnd: 840, amp: 0.5, attack: 1.6, decay: 2.8 }
          ];
          break;
        case 'gacha-reveal': {
          const rarity = String(opts.rarity || '').toUpperCase();
          let baseFreq = 520;
          if (rarity === 'BRICK') baseFreq = 960;
          else if (rarity === 'PURPLE') baseFreq = 820;
          else if (rarity === 'BLUE') baseFreq = 680;
          base.duration = 0.7;
          base.steps = [
            { offset: 0, length: 0.5, shape: 'sine', freq: baseFreq, freqEnd: baseFreq + 160, amp: 0.6, attack: 1.6, decay: 2.4 }
          ];
          if (rarity === 'BRICK') {
            base.steps.push({ offset: 0.25, length: 0.45, shape: 'triangle', freq: baseFreq + 120, freqEnd: baseFreq + 260, amp: 0.55, attack: 1.4, decay: 2.8 });
          }
          break;
        }
        case 'rarity':
        case 'gacha-rarity': {
          const rarity = String(opts.rarity || '').toUpperCase();
          const diamond = !!opts.diamond;
          const exquisite = !!opts.exquisite;
          let baseFreq = 520;
          let extra = [];
          if (rarity === 'BRICK') {
            baseFreq = diamond ? 1260 : 980;
            extra = [{ offset: 0.2, length: 0.45, shape: 'sine', freq: baseFreq + 160, freqEnd: baseFreq + 320, amp: 0.55, attack: 1.4, decay: 2.4 }];
          } else if (rarity === 'PURPLE') {
            baseFreq = 880;
          } else if (rarity === 'BLUE') {
            baseFreq = 720;
          } else if (rarity === 'GREEN') {
            baseFreq = 600;
          } else {
            baseFreq = 520;
          }
          base.duration = 0.75;
          base.steps = [
            { offset: 0, length: 0.55, shape: 'triangle', freq: baseFreq, freqEnd: baseFreq + 120, amp: 0.62, attack: 1.8, decay: 2.6 },
            { offset: 0.1, length: 0.4, shape: 'noise', amp: 0.18, decay: 3.0 }
          ].concat(extra);
          if (exquisite) {
            base.steps.push({ offset: 0.32, length: 0.3, shape: 'sine', freq: baseFreq + 260, freqEnd: baseFreq + 420, amp: 0.5, attack: 1.3, decay: 2.2 });
          }
          if (diamond) {
            base.steps.push({ offset: 0.42, length: 0.32, shape: 'triangle', freq: baseFreq + 420, freqEnd: baseFreq + 520, amp: 0.45, attack: 1.6, decay: 2.4 });
          }
          break;
        }
        case 'diamond':
          base.duration = 1.1;
          base.steps = [
            { offset: 0, length: 0.6, shape: 'sine', freq: 1100, freqEnd: 1420, amp: 0.6, attack: 1.6, decay: 2.4 },
            { offset: 0.2, length: 0.5, shape: 'triangle', freq: 820, freqEnd: 1160, amp: 0.45, attack: 1.8, decay: 2.8 }
          ];
          break;
        case 'skip':
          base.duration = 0.3;
          base.steps = [
            { offset: 0, length: 0.2, shape: 'noise', amp: 0.18, decay: 3.8 }
          ];
          break;
        case 'purchase':
          base.duration = 0.6;
          base.steps = [
            { offset: 0, length: 0.3, shape: 'triangle', freq: 560, freqEnd: 720, amp: 0.6, attack: 2.0, decay: 2.8 },
            { offset: 0.18, length: 0.28, shape: 'sine', freq: 940, freqEnd: 1160, amp: 0.52, attack: 1.6, decay: 2.4 }
          ];
          break;
        case 'sell':
          base.duration = 0.5;
          base.steps = [
            { offset: 0, length: 0.28, shape: 'triangle', freq: 520, freqEnd: 460, amp: 0.55, attack: 1.8, decay: 2.4 }
          ];
          break;
        case 'error':
          base.duration = 0.5;
          base.steps = [
            { offset: 0, length: 0.35, shape: 'sine', freq: 220, freqEnd: 180, amp: 0.6, attack: 1.4, decay: 2.6 }
          ];
          break;
        case 'cookie-click':
          base.duration = 0.25;
          base.steps = [
            { offset: 0, length: 0.2, shape: 'noise', amp: 0.22, decay: 3.8 },
            { offset: 0, length: 0.18, shape: 'sine', freq: 620, freqEnd: 540, amp: 0.4, attack: 1.8, decay: 2.4 }
          ];
          break;
        case 'cookie-bonus':
          base.duration = 0.8;
          base.steps = [
            { offset: 0, length: 0.4, shape: 'sine', freq: 840, freqEnd: 1180, amp: 0.6, attack: 1.6, decay: 2.6 },
            { offset: 0.28, length: 0.4, shape: 'triangle', freq: 960, freqEnd: 1240, amp: 0.4, attack: 1.4, decay: 2.2 }
          ];
          break;
        case 'cookie-upgrade':
          base.duration = 0.6;
          base.steps = [
            { offset: 0, length: 0.35, shape: 'triangle', freq: 720, freqEnd: 980, amp: 0.6, attack: 1.8, decay: 2.8 }
          ];
          break;
        case 'cookie-prestige':
          base.duration = 1.2;
          base.steps = [
            { offset: 0, length: 0.8, shape: 'sine', freq: 440, freqEnd: 1020, amp: 0.6, attack: 1.6, decay: 2.8 },
            { offset: 0.5, length: 0.5, shape: 'triangle', freq: 880, freqEnd: 1260, amp: 0.5, attack: 1.8, decay: 2.6 }
          ];
          break;
        case 'reward':
          base.duration = 0.8;
          base.steps = [
            { offset: 0, length: 0.45, shape: 'sine', freq: 820, freqEnd: 1180, amp: 0.6, attack: 1.6, decay: 2.6 }
          ];
          break;
        default:
          return base;
      }
      return base;
    },
    _renderSfx(descriptor) {
      if (!this.ctx) return null;
      const duration = Math.max(0.05, descriptor.duration || 1);
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(duration * sampleRate);
      const buffer = this.ctx.createBuffer(2, length, sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      const rng = this._rng(descriptor.seed || 1);
      const steps = Array.isArray(descriptor.steps) ? descriptor.steps : [];
      steps.forEach(step => {
        const offset = Math.max(0, step.offset || 0);
        const start = Math.floor(offset * sampleRate);
        const stepLength = Math.max(1, Math.floor((step.length || 0.2) * sampleRate));
        const shape = (step.shape || 'sine').toLowerCase();
        const freq = step.freq || 440;
        const freqEnd = step.freqEnd || freq;
        const amp = typeof step.amp === 'number' ? step.amp : 0.5;
        const attack = typeof step.attack === 'number' ? step.attack : 1.2;
        const decay = typeof step.decay === 'number' ? step.decay : 2.4;
        const pan = typeof step.pan === 'number' ? Math.max(-1, Math.min(1, step.pan)) : (rng() * 2 - 1) * 0.4;
        const panLeft = pan <= 0 ? 1 : 1 - pan * 0.8;
        const panRight = pan >= 0 ? 1 : 1 + pan * 0.8;
        for (let i = 0; i < stepLength; i++) {
          const idx = start + i;
          if (idx >= length) break;
          const progress = stepLength <= 1 ? 0 : i / stepLength;
          const freqNow = freq + (freqEnd - freq) * progress;
          const envAttack = Math.pow(Math.min(1, progress * 4), attack);
          const envDecay = Math.pow(Math.max(0, 1 - progress), decay);
          const envelope = envAttack * envDecay;
          let value = 0;
          switch (shape) {
            case 'triangle':
              value = 2 / Math.PI * Math.asin(Math.sin(2 * Math.PI * freqNow * (i / sampleRate)));
              break;
            case 'square':
              value = Math.sign(Math.sin(2 * Math.PI * freqNow * (i / sampleRate)));
              break;
            case 'noise':
              value = rng() * 2 - 1;
              break;
            default:
              value = Math.sin(2 * Math.PI * freqNow * (i / sampleRate));
          }
          const sample = value * envelope * amp;
          left[idx] += sample * panLeft;
          right[idx] += sample * panRight;
        }
      });
      this._normalizeStereo(left, right, 0.95);
      return buffer;
    },
    decorateArea(root) {
      if (!root) return;
      const selectors = ['button', '.btn', '.draw-panel', '.nav a'];
      const nodes = root.querySelectorAll(selectors.join(','));
      nodes.forEach(node => {
        if (node.dataset && node.dataset.sfxDecorated) return;
        if (node.dataset && node.dataset.sfx === 'custom') return;
        node.dataset.sfxDecorated = '1';
        node.addEventListener('pointerdown', () => {
          this.playSfx('ui-tap');
        });
      });
    }
  };

  window.AudioEngine = Engine;
  Engine.ensure();
})();
