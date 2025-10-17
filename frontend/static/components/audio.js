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
        key: 'cultivation-v2',
        seed: 4101,
        tempo: 56,
        scale: 'pentatonic',
        root: 174,
        bars: 16,
        pad: true,
        sparkle: true,
        warmth: 0.42,
        volume: 0.64,
        beatNoise: { density: 0.55, amp: 0.08, length: 0.38, color: 'pink', spread: 0.18, randomness: 0.25 },
        pulse: { intervalBeats: 4, width: 1.2, amp: 0.38, freq: 48, shape: 'heartbeat', noise: 0.12, spread: 0.35 },
        atmosphere: { type: 'wind', amp: 0.18, motion: 0.35, swayFreq: 0.03 }
      },
      gacha: {
        key: 'gacha-v2',
        seed: 9012,
        tempo: 128,
        scale: 'mystic',
        root: 196,
        bars: 8,
        pad: false,
        sparkle: true,
        swing: false,
        warmth: 0.5,
        volume: 0.66,
        beatNoise: { density: 3.4, amp: 0.26, length: 0.22, attack: 0.18, decay: 1.9, spread: 0.28, color: 'digital', click: 0.55 },
        pulse: { intervalBeats: 0.5, width: 0.65, amp: 0.28, freq: 94, shape: 'gate', curve: 1.8, spread: 0.45 },
        bass: { subdivision: 2, length: 0.9, amp: 0.42, notes: [-12, -12, -10, -17], glide: 0.25, decay: 2.1, spread: 0.3 },
        riser: { lengthBeats: 4, amp: 0.34, freqStart: 180, freqEnd: 1760, shimmer: 0.22, curve: 1.18, spread: 0.55 }
      },
      cookie: {
        key: 'cookie-v2',
        seed: 20241,
        tempo: 122,
        scale: 'major',
        root: 262,
        bars: 12,
        pad: true,
        sparkle: true,
        swing: true,
        warmth: 0.54,
        volume: 0.63,
        beatNoise: { density: 2.6, amp: 0.22, length: 0.26, attack: 0.32, decay: 2.2, spread: 0.32, color: 'bright', click: 0.38 },
        pulse: { intervalBeats: 1, width: 0.55, amp: 0.24, freq: 182, shape: 'pluck', noise: 0.06, spread: 0.4 }
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
      const octaves = preset.octaves || [-1, 0, 0, 1];
      const melodyGain = typeof preset.warmth === 'number' ? preset.warmth : 0.5;
      const padGain = preset.pad ? 0.25 : 0.12;
      const sparkleGain = preset.sparkle ? 0.18 : 0.08;
      const swing = !!preset.swing;

      const writeTone = (startSample, beatLength, freq, amp, pan, phaseShift = 0) => {
        const toneSamples = Math.min(length - startSample, Math.floor(beatLength * secondsPerBeat * sampleRate));
        if (toneSamples <= 0) return;
        const panLeft = pan <= 0 ? 1 : 1 - pan * 0.6;
        const panRight = pan >= 0 ? 1 : 1 + pan * 0.6;
        for (let i = 0; i < toneSamples; i++) {
          const idx = startSample + i;
          if (idx >= length) break;
          const t = i / sampleRate;
          const progress = toneSamples <= 1 ? 0 : i / toneSamples;
          const attack = Math.min(1, progress * 3.5);
          const release = Math.pow(1 - progress, 1.8);
          const envelope = attack * release;
          const osc = Math.sin(phaseShift + 2 * Math.PI * freq * t);
          const value = osc * amp * envelope;
          left[idx] += value * panLeft;
          right[idx] += value * panRight;
        }
      };

      let beat = 0;
      while (beat < totalBeats) {
        const lengthBeats = rng() < 0.32 ? 2 : 1;
        const noteIndex = Math.floor(rng() * scale.length);
        const octave = octaves[Math.floor(rng() * octaves.length)] || 0;
        const freq = root * Math.pow(2, (scale[noteIndex] + 12 * octave) / 12);
        const start = Math.floor(beat * secondsPerBeat * sampleRate);
        const pan = (rng() * 2 - 1) * 0.35;
        const phase = rng() * Math.PI * 2;
        writeTone(start, lengthBeats, freq, melodyGain, pan, phase);
        beat += lengthBeats;
      }

      if (padGain > 0) {
        const padNotes = scale.slice(0, 4).map(step => root * Math.pow(2, step / 12));
        padNotes.forEach((freq, idx) => {
          const pan = (idx / padNotes.length) * 0.8 - 0.4;
          const totalSamples = length;
          for (let i = 0; i < totalSamples; i++) {
            const t = i / sampleRate;
            const progress = totalSamples <= 1 ? 0 : i / totalSamples;
            const envelope = Math.pow(Math.min(1, progress * 1.5), 1.2) * Math.pow(1 - progress, 1.2);
            const osc = Math.sin(2 * Math.PI * freq * t + idx * 0.35);
            const value = osc * padGain * envelope;
            const panLeft = pan <= 0 ? 1 : 1 - pan * 0.5;
            const panRight = pan >= 0 ? 1 : 1 + pan * 0.5;
            left[i] += value * panLeft;
            right[i] += value * panRight;
          }
        });
      }

      const writeStereo = (idx, value, pan = 0, spread = 0.6) => {
        const panLeft = pan <= 0 ? 1 : 1 - pan * spread;
        const panRight = pan >= 0 ? 1 : 1 + pan * spread;
        left[idx] += value * panLeft;
        right[idx] += value * panRight;
      };

      const beatNoiseCfg = Object.assign({
        density: 1,
        amp: 0.18,
        length: 0.2,
        attack: 0.5,
        decay: 2.5,
        spread: 0.2,
        color: 'white',
        randomness: 0.35,
        click: 0
      }, preset.beatNoise || {});

      if (beatNoiseCfg.amp > 0) {
        const beatStep = beatNoiseCfg.density > 0 ? 1 / beatNoiseCfg.density : totalBeats;
        const totalSteps = Math.max(Math.ceil(totalBeats / Math.max(beatStep, 0.01)), 1);
        for (let i = 0; i < totalSteps; i++) {
          const beatPos = i * beatStep;
          if (beatPos >= totalBeats) break;
          const offsetBeat = swing && i % 2 === 1 ? 1.08 : 1;
          const beatTime = beatPos * secondsPerBeat * offsetBeat;
          const start = Math.floor(beatTime * sampleRate);
          const len = Math.max(1, Math.floor(secondsPerBeat * sampleRate * beatNoiseCfg.length));
          const pan = (rng() * 2 - 1) * beatNoiseCfg.spread;
          const ampJitter = Math.max(0.15, 1 + (rng() * 2 - 1) * beatNoiseCfg.randomness);
          for (let j = 0; j < len; j++) {
            const idx = start + j;
            if (idx >= length) break;
            const progress = len <= 1 ? 0 : j / len;
            let envelope = Math.pow(1 - progress, beatNoiseCfg.decay || 2.5) * Math.pow(progress, beatNoiseCfg.attack || 0.5);
            if (beatNoiseCfg.shape === 'ping') {
              envelope = Math.pow(1 - progress, 3.5);
            }
            let value = (rng() * 2 - 1);
            if (beatNoiseCfg.color === 'pink') {
              value *= 1 - progress * 0.5;
            } else if (beatNoiseCfg.color === 'bright') {
              value = Math.sin(2 * Math.PI * (680 + rng() * 240) * (j / sampleRate)) * 0.6 + value * 0.4;
            } else if (beatNoiseCfg.color === 'digital') {
              value = (value > 0 ? 0.8 : -0.8) + value * 0.2;
            }
            if (beatNoiseCfg.click) {
              const clickFreq = 580 + rng() * 920;
              value = value * (1 - beatNoiseCfg.click) + Math.sin(2 * Math.PI * clickFreq * (j / sampleRate)) * beatNoiseCfg.click;
            }
            writeStereo(idx, value * envelope * beatNoiseCfg.amp * ampJitter, pan, 0.7);
          }
        }
      }

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

      if (sparkleGain > 0) {
        const sparkCount = Math.max(6, Math.floor(totalBeats / 2));
        for (let i = 0; i < sparkCount; i++) {
          const when = rng() * duration;
          const start = Math.floor(when * sampleRate);
          const len = Math.floor(sampleRate * 0.35);
          const freq = root * Math.pow(2, (scale[(i + 2) % scale.length] + 24) / 12);
          const pan = (rng() * 2 - 1) * 0.6;
          for (let j = 0; j < len; j++) {
            const idx = start + j;
            if (idx >= length) break;
            const progress = len <= 1 ? 0 : j / len;
            const env = Math.pow(1 - progress, 2.6) * Math.pow(progress, 0.8);
            const value = Math.sin(2 * Math.PI * freq * (j / sampleRate) + rng() * Math.PI) * env * sparkleGain;
            const panLeft = pan <= 0 ? 1 : 1 - pan * 0.7;
            const panRight = pan >= 0 ? 1 : 1 + pan * 0.7;
            left[idx] += value * panLeft;
            right[idx] += value * panRight;
          }
        }
      }

      this._smoothBuffer(left);
      this._smoothBuffer(right);
      this._normalizeStereo(left, right, 0.85);
      return buffer;
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
