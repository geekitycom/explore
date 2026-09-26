import type { NoteEvent, Song } from './compose.ts';

const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const HARMONICS = 64;

export function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const real = new Float32Array(HARMONICS);
  const imag = new Float32Array(HARMONICS);
  for (let k = 1; k < HARMONICS; k++) {
    real[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k);
    imag[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k);
  }
  return ctx.createPeriodicWave(real, imag);
}

/** The NES triangle is a 4-bit staircase, which gives the bass its grainy edge. */
export function steppedTriangle(ctx: BaseAudioContext): PeriodicWave {
  const samples = 32;
  const table = Array.from({ length: samples }, (_, i) => (i < 16 ? i : 31 - i) / 7.5 - 1);
  const real = new Float32Array(HARMONICS);
  const imag = new Float32Array(HARMONICS);
  for (let k = 1; k < HARMONICS; k++) {
    for (let i = 0; i < samples; i++) {
      const t = (2 * Math.PI * k * i) / samples;
      real[k]! += (2 * table[i]! * Math.cos(t)) / samples;
      imag[k]! += (2 * table[i]! * Math.sin(t)) / samples;
    }
  }
  return ctx.createPeriodicWave(real, imag);
}

/** Noise from the NES's 15-bit linear feedback shift register. */
export function lfsrNoise(ctx: BaseAudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lfsr = 1;
  for (let i = 0; i < data.length; i++) {
    const bit = (lfsr ^ (lfsr >> 1)) & 1;
    lfsr = (lfsr >> 1) | (bit << 14);
    data[i] = lfsr & 1 ? 1 : -1;
  }
  return buffer;
}

const VOICE_GAIN = { lead: 0.5, harm: 0.22, bass: 0.7 } as const;

/** Plays one song's events into `out`. The caller owns timing and the output gain. */
export function createSynth(ctx: BaseAudioContext, song: Song, out: AudioNode) {
  const stepSec = 60 / song.bpm / 4;
  const mix = ctx.createGain();
  mix.gain.value = 0.22;
  mix.connect(out);

  const leadBus = ctx.createGain();
  leadBus.connect(mix);
  if (song.echo > 0) {
    const delay = ctx.createDelay(1);
    delay.delayTime.value = stepSec * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = song.echo;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    leadBus.connect(delay).connect(feedback).connect(delay);
    delay.connect(wet).connect(mix);
  }

  const waves = {
    lead: pulseWave(ctx, song.leadDuty),
    harm: pulseWave(ctx, 0.125),
    bass: steppedTriangle(ctx),
  };
  const noise = lfsrNoise(ctx);

  const tone = (ev: Extract<NoteEvent, { midi: number }>, t: number) => {
    const dur = ev.len * stepSec;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(waves[ev.voice]);
    osc.frequency.value = midiHz(ev.midi);
    if (ev.voice === 'lead' && dur > 0.4) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(midiHz(ev.midi) * 0.006, t + 0.25);
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const gain = ctx.createGain();
    const peak = VOICE_GAIN[ev.voice] * ev.vel;
    const sustain = ev.voice === 'bass' ? peak : peak * 0.7;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.005);
    gain.gain.linearRampToValueAtTime(sustain, t + 0.08);
    gain.gain.setValueAtTime(sustain, t + Math.max(0.01, dur - 0.03));
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(gain).connect(ev.voice === 'lead' ? leadBus : mix);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  };

  const drum = (ev: Extract<NoteEvent, { voice: 'noise' }>, t: number) => {
    const gain = ctx.createGain();
    gain.connect(mix);
    if (ev.kind === 'kick') {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(waves.bass);
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      gain.gain.setValueAtTime(0.8 * ev.vel, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.16);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = ev.kind === 'hat' ? 'highpass' : 'bandpass';
    filter.frequency.value = ev.kind === 'hat' ? 7000 : 1800;
    const length = ev.kind === 'hat' ? 0.04 : 0.14;
    gain.gain.setValueAtTime(0.35 * ev.vel, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + length);
    src.connect(filter).connect(gain);
    src.start(t, (ev.step * 0.37) % 0.5);
    src.stop(t + length + 0.01);
  };

  const loopSec = song.steps * stepSec;
  return {
    /** Schedules every event starting in [from, to) seconds of song time, wrapping the loop. */
    schedule(songStart: number, from: number, to: number) {
      for (let loop = Math.floor(from / loopSec); loop <= Math.floor(to / loopSec); loop++) {
        for (const ev of song.events) {
          const at = loop * loopSec + ev.step * stepSec;
          if (at < from || at >= to) continue;
          if (ev.voice === 'noise') drum(ev, songStart + at);
          else tone(ev, songStart + at);
        }
      }
    },
  };
}
