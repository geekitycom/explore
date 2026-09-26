import { lfsrNoise, pulseWave, steppedTriangle } from './synth.ts';

/** How long the portal's sound lasts, in seconds: as long as the portal. */
export const WHOOSH_S = 2;

/** One wheeze, a rise and a fall; the portal groans through a little under three. */
const CYCLE_S = 0.74;
const BASE_HZ = 62;
/** Each wheeze bends the pitch up by this many semitones at its top. */
const BEND_SEMITONES = 8;
const FADE_IN_S = 0.2;
const FADE_OUT_S = 0.45;
/** Full loudness next to the effects bus, which ambient loops share. */
const LOUDNESS = 0.3;
/** Curves are sampled this often for Web Audio's value curves. */
const CURVE_RATE = 200;

/** 0 at the start and end of each wheeze, 1 at its top, leaning late like a breath drawn in. */
const swell = (t: number) => {
  const phase = (t / CYCLE_S) % 1;
  return Math.sin(Math.PI * phase ** 0.8) ** 2;
};

/** The whole sound's loudness envelope, 0 at both ends. */
const envelope = (t: number) =>
  Math.max(0, Math.min(1, t / FADE_IN_S, (WHOOSH_S - t) / FADE_OUT_S));

/**
 * The portal's sound at `t` seconds: a rising and falling wheeze in the spirit of the TARDIS.
 * `hz` is the groaning voice's pitch, `cutoff` where its filter opens to, and `gain` its
 * loudness from 0 to 1.
 */
export function whooshAt(t: number): { hz: number; cutoff: number; gain: number } {
  const s = swell(t);
  const drift = 1 + 0.08 * (t / WHOOSH_S);
  return {
    hz: BASE_HZ * drift * 2 ** ((BEND_SEMITONES * s) / 12),
    cutoff: 350 + 2400 * s,
    gain: envelope(t) * (0.35 + 0.65 * s),
  };
}

function curve(pick: (at: ReturnType<typeof whooshAt>) => number): Float32Array<ArrayBuffer> {
  const n = Math.round(WHOOSH_S * CURVE_RATE) + 1;
  return Float32Array.from({ length: n }, (_, i) => pick(whooshAt((i / (n - 1)) * WHOOSH_S)));
}

/**
 * Plays the portal's sound into `out` starting at `at` (context time), on the synth's own
 * voices: two detuned narrow pulses and a stepped triangle an octave under them for the groan,
 * and LFSR noise through a sweeping band-pass for the wheeze.
 */
export function playWhoosh(ctx: BaseAudioContext, out: AudioNode, at: number): void {
  const end = at + WHOOSH_S;
  const pitch = curve((w) => w.hz);
  const gain = curve((w) => w.gain * LOUDNESS);
  const cutoff = curve((w) => w.cutoff);

  const level = ctx.createGain();
  level.gain.value = 0;
  level.gain.setValueCurveAtTime(gain, at, WHOOSH_S);
  level.connect(out);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 7;
  filter.frequency.setValueCurveAtTime(cutoff, at, WHOOSH_S);
  filter.connect(level);

  const voices: [PeriodicWave, number, number][] = [
    [pulseWave(ctx, 0.125), 1, 0.3],
    [pulseWave(ctx, 0.25), 2 ** (9 / 1200), 0.22],
    [steppedTriangle(ctx), 0.5, 0.5],
  ];
  for (const [wave, ratio, loudness] of voices) {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(wave);
    osc.frequency.setValueCurveAtTime(
      pitch.map((hz) => hz * ratio),
      at,
      WHOOSH_S,
    );
    const voice = ctx.createGain();
    voice.gain.value = loudness;
    osc.connect(voice).connect(filter);
    osc.start(at);
    osc.stop(end);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = lfsrNoise(ctx);
  noise.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 4;
  band.frequency.setValueCurveAtTime(
    cutoff.map((hz) => hz * 1.4),
    at,
    WHOOSH_S,
  );
  const breath = ctx.createGain();
  breath.gain.value = 0.28;
  noise.connect(band).connect(breath).connect(level);
  noise.start(at);
  noise.stop(end);
}
