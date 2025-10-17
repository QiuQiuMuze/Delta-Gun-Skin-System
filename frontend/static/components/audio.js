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
        key: 'cultivation',
        seed: 4101,
        tempo: 62,
        scale: 'pentatonic',
        root: 196,
        bars: 16,
        pad: true,
        sparkle: true,
        swing: 0.04,
        warmth: 0.48,
        melodyOctaves: [-2, -1, -1, 0, 0, 1],
        longNoteChance: 0.55,
        melodyPan: 0.28,
        ambience: { wind: 0.28, chimes: 0.16, water: 0.18 },
        heartbeat: { interval: 4, depth: 0.52, echo: 0.32 },
        beatNoiseLevel: 0.08,
        volume: 0.58
      },
      gacha: {
        key: 'gacha',
        seed: 9012,
        tempo: 124,
        scale: 'mystic',
        root: 233,
        bars: 10,
        pad: false,
        sparkle: true,
        warmth: 0.62,
        melodyOctaves: [-1, 0, 0, 1],
        longNoteChance: 0.22,
        melodyPan: 0.42,
        beatNoiseLevel: 0.24,
        bassPulse: { freq: 82, drive: 0.9, pattern: [1, 0.35, 0.75, 0.15, 0.9, 0.25, 0.65, 0.4] },
        risers: { density: 0.35, length: 1.6, shimmer: 0.5 },
        stingers: { every: 8, lift: 1.6 },
        volume: 0.64
      },
      cookie: {
        key: 'cookie',
        seed: 20241,
        tempo: 120,
        scale: 'major',
        root: 262,
        bars: 12,
        pad: true,
        sparkle: true,
        swing: 0.12,
        warmth: 0.6,
        melodyOctaves: [-1, 0, 1, 1],
        longNoteChance: 0.18,
        melodyPan: 0.22,
        beatNoiseLevel: 0.12,
        percussion: {
          type: 'clockwork',
          pattern: [1, 0, 1, 0, 1, 0, 1, 1],
          accent: 0.32,
          click: 0.18,
          bell: 0.46
        },
        volume: 0.6
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
      const melodyOctaves = Array.isArray(preset.melodyOctaves) && preset.melodyOctaves.length ? preset.melodyOctaves : octaves;
      const melodyGain = typeof preset.warmth === 'number' ? preset.warmth : 0.5;
      const padGain = preset.pad ? 0.25 : 0.12;
      const sparkleGain = preset.sparkle ? 0.18 : 0.08;
      const swingAmount = typeof preset.swing === 'number' ? preset.swing : (preset.swing ? 0.08 : 0);
      const beatNoiseLevel = typeof preset.beatNoiseLevel === 'number' ? preset.beatNoiseLevel : 0.18;
      const longNoteChance = typeof preset.longNoteChance === 'number' ? Math.min(Math.max(preset.longNoteChance, 0), 1) : 0.32;
      const melodyPan = typeof preset.melodyPan === 'number' ? Math.min(Math.max(preset.melodyPan, 0), 1) : 0.35;

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
        const lengthBeats = rng() < longNoteChance ? 2 : 1;
        const noteIndex = Math.floor(rng() * scale.length);
        const octave = melodyOctaves[Math.floor(rng() * melodyOctaves.length)] || 0;
        const freq = root * Math.pow(2, (scale[noteIndex] + 12 * octave) / 12);
        const start = Math.floor(beat * secondsPerBeat * sampleRate);
        const pan = (rng() * 2 - 1) * melodyPan;
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

      const applyBeatNoise = () => {
        const beatNoise = Math.max(totalBeats, 16);
        for (let i = 0; i < beatNoise; i++) {
          const offsetBeat = 1 + (i % 2 === 1 ? swingAmount : 0);
          const beatTime = i * secondsPerBeat * offsetBeat;
          const start = Math.floor(beatTime * sampleRate);
          const len = Math.floor(secondsPerBeat * sampleRate * 0.2);
          const pan = (rng() * 2 - 1) * 0.2;
          for (let j = 0; j < len; j++) {
            const idx = start + j;
            if (idx >= length) break;
            const progress = len <= 1 ? 0 : j / len;
            const envelope = Math.pow(1 - progress, 2.5) * Math.pow(progress, 0.5);
            const value = (rng() * 2 - 1) * envelope * beatNoiseLevel;
            const panLeft = pan <= 0 ? 1 : 1 - pan * 0.7;
            const panRight = pan >= 0 ? 1 : 1 + pan * 0.7;
            left[idx] += value * panLeft;
            right[idx] += value * panRight;
          }
        }
      };

      const applyPercussion = () => {
        const percussion = preset.percussion;
        if (!percussion || percussion.type !== 'clockwork') {
          applyBeatNoise();
          return;
        }
        const pattern = Array.isArray(percussion.pattern) && percussion.pattern.length ? percussion.pattern : [1, 0, 1, 0];
        const baseFreq = percussion.baseFreq || root * 2;
        const accent = Math.max(0, Math.min(percussion.accent == null ? 0.3 : percussion.accent, 1));
        const clickLevel = Math.max(0, Math.min(percussion.click == null ? 0.16 : percussion.click, 1));
        const bellLevel = Math.max(0, Math.min(percussion.bell == null ? 0.4 : percussion.bell, 1));
        const totalBeatsInt = Math.ceil(totalBeats);
        for (let i = 0; i < totalBeatsInt; i++) {
          const weight = pattern[i % pattern.length];
          if (!weight) continue;
          const beatTime = i * secondsPerBeat;
          const start = Math.floor(beatTime * sampleRate);
          const freq = baseFreq * (1 + (i % 4 === 0 ? 0.04 : 0));
          const pan = (rng() * 2 - 1) * 0.18;
          const toneLen = Math.floor(secondsPerBeat * sampleRate * 0.32);
          for (let j = 0; j < toneLen; j++) {
            const idx = start + j;
            if (idx >= length) break;
            const progress = toneLen <= 1 ? 0 : j / toneLen;
            const env = Math.pow(1 - progress, 3.2) * Math.pow(progress, 1.2);
            const osc = Math.sin(2 * Math.PI * freq * (j / sampleRate));
            const panLeft = pan <= 0 ? 1 : 1 - pan * 0.5;
            const panRight = pan >= 0 ? 1 : 1 + pan * 0.5;
            const value = osc * bellLevel * weight * env;
            left[idx] += value * panLeft;
            right[idx] += value * panRight;
          }
          if (clickLevel > 0) {
            const clickStart = Math.floor((beatTime + secondsPerBeat * 0.25) * sampleRate);
            const clickLen = Math.floor(secondsPerBeat * sampleRate * 0.08);
            const clickPan = (rng() * 2 - 1) * 0.12;
            for (let j = 0; j < clickLen; j++) {
              const idx = clickStart + j;
              if (idx >= length) break;
              const decay = Math.pow(1 - (j / Math.max(1, clickLen)), 2.5);
              const pulse = (rng() * 2 - 1) * decay * clickLevel * weight;
              const panLeft = clickPan <= 0 ? 1 : 1 - clickPan * 0.6;
              const panRight = clickPan >= 0 ? 1 : 1 + clickPan * 0.6;
              left[idx] += pulse * panLeft;
              right[idx] += pulse * panRight;
            }
          }
          if (accent > 0 && i % 4 === 0) {
            const accentStart = Math.floor((beatTime + secondsPerBeat * 0.5) * sampleRate);
            const accentLen = Math.floor(secondsPerBeat * sampleRate * 0.22);
            for (let j = 0; j < accentLen; j++) {
              const idx = accentStart + j;
              if (idx >= length) break;
              const env = Math.pow(1 - j / Math.max(1, accentLen), 2.4);
              const pulse = Math.sin(2 * Math.PI * (freq * 0.5) * (j / sampleRate)) * env * accent;
              left[idx] += pulse;
              right[idx] += pulse;
            }
          }
        }
      };

      if (beatNoiseLevel > 0 || preset.percussion) {
        applyPercussion();
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

      const ambience = preset.ambience || null;
      if (ambience && (ambience.wind || ambience.water || ambience.chimes)) {
        const applyWind = (level) => {
          if (!level) return;
          let prev = 0;
          for (let i = 0; i < length; i++) {
            const noise = (rng() * 2 - 1) * level * 0.18;
            prev = prev * 0.985 + noise * 0.015;
            left[i] += prev;
            right[i] += prev * 0.92;
          }
        };
        const applyWater = (level) => {
          if (!level) return;
          const drops = Math.max(3, Math.floor(duration * 2 * level));
          for (let d = 0; d < drops; d++) {
            const when = rng() * duration;
            const start = Math.floor(when * sampleRate);
            const len = Math.floor(sampleRate * 0.28);
            const freq = root * Math.pow(2, (scale[(d + 3) % scale.length] + 12) / 12);
            const pan = (rng() * 2 - 1) * 0.35;
            for (let j = 0; j < len; j++) {
              const idx = start + j;
              if (idx >= length) break;
              const progress = len <= 1 ? 0 : j / len;
              const env = Math.pow(1 - progress, 2.8) * Math.pow(progress, 1.1);
              const value = Math.sin(2 * Math.PI * freq * (j / sampleRate)) * env * level * 0.32;
              const panLeft = pan <= 0 ? 1 : 1 - pan * 0.6;
              const panRight = pan >= 0 ? 1 : 1 + pan * 0.6;
              left[idx] += value * panLeft;
              right[idx] += value * panRight;
            }
          }
        };
        const applyChimes = (level) => {
          if (!level) return;
          const count = Math.max(4, Math.floor(totalBeats * level * 0.6));
          for (let i = 0; i < count; i++) {
            const when = rng() * duration;
            const start = Math.floor(when * sampleRate);
            const len = Math.floor(sampleRate * 0.42);
            const freq = root * Math.pow(2, (scale[(i + 1) % scale.length] + 24) / 12);
            const pan = (rng() * 2 - 1) * 0.5;
            for (let j = 0; j < len; j++) {
              const idx = start + j;
              if (idx >= length) break;
              const progress = len <= 1 ? 0 : j / len;
              const env = Math.pow(1 - progress, 3.4) * Math.pow(progress, 0.8);
              const value = Math.sin(2 * Math.PI * freq * (j / sampleRate) + rng() * Math.PI) * env * level * 0.4;
              const panLeft = pan <= 0 ? 1 : 1 - pan * 0.6;
              const panRight = pan >= 0 ? 1 : 1 + pan * 0.6;
              left[idx] += value * panLeft;
              right[idx] += value * panRight;
            }
          }
        };
        applyWind(Math.min(Math.max(ambience.wind || 0, 0), 1));
        applyWater(Math.min(Math.max(ambience.water || 0, 0), 1));
        applyChimes(Math.min(Math.max(ambience.chimes || 0, 0), 1));
      }

      if (preset.heartbeat) {
        const hb = preset.heartbeat;
        const interval = Math.max(1, Math.floor(hb.interval || 4));
        const depth = Math.min(Math.max(hb.depth == null ? 0.45 : hb.depth, 0), 1);
        const echo = Math.min(Math.max(hb.echo == null ? 0.25 : hb.echo, 0), 1);
        const firstFreq = hb.freq || 58;
        const secondFreq = (hb.freq || 58) * 1.2;
        for (let beatIndex = 0; beatIndex < totalBeats; beatIndex += interval) {
          const beatTime = beatIndex * secondsPerBeat;
          const startPrimary = Math.floor(beatTime * sampleRate);
          const lenPrimary = Math.floor(sampleRate * secondsPerBeat * 0.35);
          for (let j = 0; j < lenPrimary; j++) {
            const idx = startPrimary + j;
            if (idx >= length) break;
            const progress = lenPrimary <= 1 ? 0 : j / lenPrimary;
            const env = Math.pow(1 - progress, 4.2) * Math.pow(progress, 1.1);
            const osc = Math.sin(2 * Math.PI * firstFreq * (j / sampleRate));
            const value = osc * env * depth;
            left[idx] += value;
            right[idx] += value * 0.9;
          }
          const offset = Math.floor(sampleRate * secondsPerBeat * 0.28);
          const lenSecondary = Math.floor(sampleRate * secondsPerBeat * 0.32);
          for (let j = 0; j < lenSecondary; j++) {
            const idx = startPrimary + offset + j;
            if (idx >= length) break;
            const progress = lenSecondary <= 1 ? 0 : j / lenSecondary;
            const env = Math.pow(1 - progress, 3.2) * Math.pow(progress, 1.2);
            const osc = Math.sin(2 * Math.PI * secondFreq * (j / sampleRate));
            const value = osc * env * depth * 0.78;
            left[idx] += value;
            right[idx] += value * 0.92;
          }
          if (echo > 0) {
            const echoStart = startPrimary + Math.floor(sampleRate * secondsPerBeat * 0.7);
            const echoLen = Math.floor(sampleRate * secondsPerBeat * 0.45);
            for (let j = 0; j < echoLen; j++) {
              const idx = echoStart + j;
              if (idx >= length) break;
              const progress = echoLen <= 1 ? 0 : j / echoLen;
              const env = Math.pow(1 - progress, 3.4) * Math.pow(progress, 0.9);
              const osc = Math.sin(2 * Math.PI * firstFreq * 0.5 * (j / sampleRate));
              const value = osc * env * depth * 0.5 * echo;
              left[idx] += value;
              right[idx] += value;
            }
          }
        }
      }

      if (preset.bassPulse) {
        const bp = preset.bassPulse;
        const pattern = Array.isArray(bp.pattern) && bp.pattern.length ? bp.pattern : [1, 0.4, 0.8, 0.3];
        const freq = bp.freq || root / 2;
        const drive = Math.min(Math.max(bp.drive == null ? 0.6 : bp.drive, 0), 1);
        const pulseLen = Math.floor(secondsPerBeat * sampleRate * 0.8);
        const totalBeatsInt = Math.ceil(totalBeats);
        for (let i = 0; i < totalBeatsInt; i++) {
          const weight = pattern[i % pattern.length];
          if (!weight) continue;
          const beatTime = (i + (bp.offset || 0)) * secondsPerBeat;
          const start = Math.floor(beatTime * sampleRate);
          const pan = (rng() * 2 - 1) * 0.1;
          for (let j = 0; j < pulseLen; j++) {
            const idx = start + j;
            if (idx >= length) break;
            const progress = pulseLen <= 1 ? 0 : j / pulseLen;
            const attack = Math.pow(Math.min(1, progress * 6), 1.6);
            const release = Math.pow(1 - progress, 1.8);
            const env = attack * release;
            const osc = Math.sin(2 * Math.PI * freq * (j / sampleRate));
            const distortion = Math.tanh(osc * 2.4) * 0.6 + osc * 0.4;
            const value = distortion * env * drive * weight;
            const panLeft = pan <= 0 ? 1 : 1 - pan * 0.4;
            const panRight = pan >= 0 ? 1 : 1 + pan * 0.4;
            left[idx] += value * panLeft;
            right[idx] += value * panRight;
          }
        }
      }

      if (preset.risers) {
        const risers = preset.risers;
        const density = Math.max(0, risers.density == null ? 0.25 : risers.density);
        const count = Math.max(1, Math.floor(bars * density));
        const lengthSeconds = Math.max(0.8, risers.length || 1.4);
        for (let i = 0; i < count; i++) {
          const when = rng() * Math.max(0.1, duration - lengthSeconds * 0.5);
          const start = Math.floor(when * sampleRate);
          const len = Math.floor(lengthSeconds * sampleRate);
          const pan = (rng() * 2 - 1) * 0.35;
          const shimmer = Math.min(Math.max(risers.shimmer == null ? 0.35 : risers.shimmer, 0), 1);
          for (let j = 0; j < len; j++) {
            const idx = start + j;
            if (idx >= length) break;
            const progress = len <= 1 ? 0 : j / len;
            const env = Math.pow(progress, 2.2);
            const sweepFreq = root * Math.pow(2, (scale[(i + j) % scale.length] + 12 * progress * 2) / 12);
            const osc = Math.sin(2 * Math.PI * sweepFreq * (j / sampleRate));
            const noise = (rng() * 2 - 1) * shimmer;
            const value = (osc * (1 - shimmer) + noise) * env * 0.4;
            const panLeft = pan <= 0 ? 1 : 1 - pan * 0.7;
            const panRight = pan >= 0 ? 1 : 1 + pan * 0.7;
            left[idx] += value * panLeft;
            right[idx] += value * panRight;
          }
        }
      }

      if (preset.stingers && preset.stingers.every) {
        const stingers = preset.stingers;
        const every = Math.max(2, Math.floor(stingers.every));
        const lift = Math.min(Math.max(stingers.lift == null ? 1.2 : stingers.lift, 0), 3);
        const count = Math.ceil(totalBeats / every);
        for (let i = 1; i <= count; i++) {
          const beatIndex = i * every;
          const beatTime = beatIndex * secondsPerBeat * 0.99;
          const start = Math.floor(beatTime * sampleRate);
          const len = Math.floor(sampleRate * secondsPerBeat * 0.6);
          const baseFreq = root * Math.pow(2, (scale[(i + 1) % scale.length] + 12) / 12);
          for (let j = 0; j < len; j++) {
            const idx = start + j;
            if (idx >= length) break;
            const progress = len <= 1 ? 0 : j / len;
            const env = Math.pow(1 - progress, 2.8) * Math.pow(progress, 0.9);
            const osc = Math.sin(2 * Math.PI * baseFreq * (j / sampleRate) * (1 + lift * progress));
            const value = osc * env * 0.48;
            left[idx] += value;
            right[idx] += value;
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
