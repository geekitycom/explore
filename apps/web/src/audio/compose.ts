import { BIOMES, createRng, type Biome, type Rng } from '@explore/core';

export type Voice = 'lead' | 'harm' | 'bass';
export type DrumKind = 'kick' | 'snare' | 'hat';

/** Steps are 16th notes, 16 per bar. Pitches are MIDI numbers. */
export type NoteEvent =
  | { voice: Voice; step: number; len: number; midi: number; vel: number }
  | { voice: 'noise'; step: number; kind: DrumKind; vel: number };

export type Song = {
  bpm: number;
  root: number;
  scale: readonly number[];
  bars: number;
  steps: number;
  events: readonly NoteEvent[];
  leadDuty: number;
  echo: number;
};

type Span = readonly [start: number, length: number];

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
} as const;

const RHYTHMS: Record<'calm' | 'lively' | 'sparse', readonly (readonly Span[])[]> = {
  calm: [
    [
      [0, 4],
      [4, 4],
      [8, 8],
    ],
    [
      [0, 6],
      [6, 2],
      [8, 8],
    ],
    [
      [0, 4],
      [4, 2],
      [6, 2],
      [8, 8],
    ],
    [
      [0, 8],
      [8, 4],
      [12, 4],
    ],
  ],
  lively: [
    [
      [0, 2],
      [2, 2],
      [4, 4],
      [8, 2],
      [10, 2],
      [12, 4],
    ],
    [
      [0, 3],
      [3, 3],
      [6, 2],
      [8, 4],
      [12, 2],
      [14, 2],
    ],
    [
      [0, 4],
      [4, 2],
      [6, 2],
      [8, 2],
      [10, 2],
      [12, 4],
    ],
    [
      [0, 2],
      [2, 4],
      [6, 2],
      [8, 6],
      [14, 2],
    ],
  ],
  sparse: [
    [
      [0, 6],
      [8, 2],
      [10, 6],
    ],
    [
      [2, 4],
      [8, 8],
    ],
    [
      [0, 3],
      [3, 5],
      [12, 4],
    ],
    [
      [0, 8],
      [10, 2],
      [12, 4],
    ],
  ],
};

type Accompaniment = (
  chordTones: readonly number[],
  root: number,
  fifth: number,
) => [number, number, number][];

const BASS: Record<string, Accompaniment> = {
  halves: (_, r, f) => [
    [0, 8, r],
    [8, 8, f],
  ],
  bounce: (_, r, f) => [
    [0, 3, r],
    [4, 2, r + 12],
    [6, 2, f],
    [8, 3, r],
    [12, 2, r + 12],
    [14, 2, f],
  ],
  wholes: (_, r) => [[0, 16, r]],
  pulse: (_, r, f) => [
    [0, 4, r],
    [6, 2, r],
    [10, 6, f],
  ],
  gallop: (_, r, f) => [
    [0, 2, r],
    [3, 1, r],
    [4, 2, f],
    [8, 2, r],
    [11, 1, r],
    [12, 2, f],
  ],
  drone: (_, r) => [
    [0, 12, r],
    [12, 4, r - 12],
  ],
};

const ARP: Record<string, Accompaniment> = {
  eighths: (t) => Array.from({ length: 8 }, (_, i) => [i * 2, 2, t[i % 3]! + 12]),
  sixteenths: (t) => Array.from({ length: 16 }, (_, i) => [i, 1, t[[0, 1, 2, 1][i % 4]!]! + 12]),
  rolling: (t) =>
    Array.from({ length: 8 }, (_, i) => [i * 2, 3, t[[0, 1, 2, 1, 2, 1, 0, 1][i]!]! + 12]),
  sparse: (t) => [
    [2, 2, t[2]! + 12],
    [6, 2, t[1]! + 12],
    [12, 4, t[0]! + 12],
  ],
  strum: (t) => [
    [0, 4, t[0]! + 12],
    [1, 3, t[1]! + 12],
    [2, 2, t[2]! + 12],
    [8, 4, t[0]! + 12],
    [9, 3, t[1]! + 12],
    [10, 2, t[2]! + 12],
  ],
  twinkle: (t) => [
    [0, 1, t[2]! + 24],
    [5, 1, t[1]! + 24],
    [11, 1, t[0]! + 24],
  ],
};

const DRUMS: Record<string, readonly [number, DrumKind, number][]> = {
  none: [],
  shaker: [
    [4, 'hat', 0.3],
    [12, 'hat', 0.3],
    [14, 'hat', 0.2],
  ],
  beat: [
    [0, 'kick', 1],
    [4, 'snare', 0.8],
    [8, 'kick', 1],
    [10, 'kick', 0.6],
    [12, 'snare', 0.8],
    [2, 'hat', 0.35],
    [6, 'hat', 0.35],
    [14, 'hat', 0.35],
  ],
  ticks: [
    [6, 'hat', 0.25],
    [14, 'hat', 0.35],
  ],
  gallop: [
    [0, 'kick', 0.8],
    [3, 'hat', 0.3],
    [4, 'snare', 0.5],
    [8, 'kick', 0.8],
    [11, 'hat', 0.3],
    [12, 'snare', 0.5],
  ],
  march: [
    [0, 'kick', 0.9],
    [4, 'snare', 0.6],
    [6, 'snare', 0.35],
    [7, 'snare', 0.35],
    [8, 'kick', 0.9],
    [12, 'snare', 0.6],
  ],
  hand: [
    [0, 'kick', 0.6],
    [6, 'kick', 0.4],
    [10, 'snare', 0.3],
    [12, 'hat', 0.2],
  ],
};

type MoodStyle = {
  scale: keyof typeof SCALES;
  root: number;
  bpm: readonly [number, number];
  rhythm: keyof typeof RHYTHMS;
  progressions: readonly (readonly number[])[];
  bass: keyof typeof BASS;
  arp: keyof typeof ARP;
  drums: keyof typeof DRUMS;
  leadDuty: number;
  echo: number;
};

export const MOOD_STYLES: Record<Biome, MoodStyle> = {
  garden: {
    scale: 'lydian',
    root: 65,
    bpm: [80, 92],
    rhythm: 'calm',
    progressions: [
      [0, 4, 5, 3],
      [0, 3, 0, 4],
      [0, 1, 4, 0],
      [3, 4, 2, 5],
    ],
    bass: 'halves',
    arp: 'eighths',
    drums: 'shaker',
    leadDuty: 0.25,
    echo: 0.25,
  },
  meadow: {
    scale: 'major',
    root: 67,
    bpm: [112, 128],
    rhythm: 'lively',
    progressions: [
      [0, 4, 5, 3],
      [0, 5, 3, 4],
      [3, 4, 0, 5],
      [0, 3, 4, 4],
    ],
    bass: 'bounce',
    arp: 'sixteenths',
    drums: 'beat',
    leadDuty: 0.5,
    echo: 0,
  },
  lakeland: {
    scale: 'minor',
    root: 62,
    bpm: [66, 78],
    rhythm: 'calm',
    progressions: [
      [0, 5, 2, 6],
      [0, 3, 6, 2],
      [0, 5, 3, 4],
      [5, 6, 0, 0],
    ],
    bass: 'wholes',
    arp: 'rolling',
    drums: 'none',
    leadDuty: 0.5,
    echo: 0.4,
  },
  forest: {
    scale: 'dorian',
    root: 64,
    bpm: [88, 100],
    rhythm: 'sparse',
    progressions: [
      [0, 3, 0, 6],
      [0, 6, 3, 0],
      [0, 1, 0, 6],
      [3, 0, 6, 0],
    ],
    bass: 'pulse',
    arp: 'sparse',
    drums: 'ticks',
    leadDuty: 0.125,
    echo: 0.3,
  },
  scrubland: {
    scale: 'major',
    root: 64,
    bpm: [104, 116],
    rhythm: 'lively',
    progressions: [
      [0, 0, 3, 4],
      [0, 3, 0, 4],
      [0, 4, 0, 3],
      [3, 0, 4, 0],
    ],
    bass: 'gallop',
    arp: 'strum',
    drums: 'gallop',
    leadDuty: 0.25,
    echo: 0,
  },
  desert: {
    scale: 'harmonicMinor',
    root: 62,
    bpm: [76, 88],
    rhythm: 'sparse',
    progressions: [
      [0, 0, 5, 4],
      [0, 5, 0, 4],
      [0, 3, 4, 0],
      [5, 4, 0, 0],
    ],
    bass: 'drone',
    arp: 'sparse',
    drums: 'hand',
    leadDuty: 0.125,
    echo: 0.35,
  },
  highlands: {
    scale: 'mixolydian',
    root: 62,
    bpm: [96, 108],
    rhythm: 'lively',
    progressions: [
      [0, 6, 0, 4],
      [0, 6, 3, 0],
      [0, 3, 6, 0],
      [6, 0, 3, 0],
    ],
    bass: 'drone',
    arp: 'eighths',
    drums: 'march',
    leadDuty: 0.5,
    echo: 0.15,
  },
  taiga: {
    scale: 'phrygian',
    root: 60,
    bpm: [84, 94],
    rhythm: 'sparse',
    progressions: [
      [0, 1, 0, 6],
      [0, 5, 1, 0],
      [0, 6, 5, 1],
      [5, 1, 0, 0],
    ],
    bass: 'halves',
    arp: 'rolling',
    drums: 'ticks',
    leadDuty: 0.25,
    echo: 0.45,
  },
  tundra: {
    scale: 'minor',
    root: 69,
    bpm: [56, 66],
    rhythm: 'calm',
    progressions: [
      [0, 5, 0, 3],
      [0, 2, 5, 0],
      [5, 3, 0, 0],
      [0, 3, 5, 6],
    ],
    bass: 'wholes',
    arp: 'twinkle',
    drums: 'none',
    leadDuty: 0.125,
    echo: 0.5,
  },
};

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;

type Motif = { rhythm: readonly Span[]; contour: number[] };

export function compose(biome: Biome, seed: number): Song {
  const style = MOOD_STYLES[biome];
  const rng = createRng(Math.imul(seed, 7919) + BIOMES.indexOf(biome));
  const scale = SCALES[style.scale];
  const bpm = Math.round(style.bpm[0] + rng() * (style.bpm[1] - style.bpm[0]));
  const root = style.root + pick(rng, [-2, 0, 0, 2, 3]);

  const pitch = (degree: number, octave = 0) =>
    root + scale[((degree % 7) + 7) % 7]! + 12 * (Math.floor(degree / 7) + octave);
  const chordDegrees = (chord: number) => [chord, chord + 2, chord + 4];
  const nearestChordTone = (degree: number, chord: number) => {
    let best = degree;
    let bestDistance = Infinity;
    for (const tone of chordDegrees(chord)) {
      for (const octave of [-7, 0, 7]) {
        const d = Math.abs(tone + octave - degree);
        if (d < bestDistance) [best, bestDistance] = [tone + octave, d];
      }
    }
    return best;
  };

  const progA = pick(rng, style.progressions);
  const progB =
    style.progressions[
      (style.progressions.indexOf(progA) + 1 + Math.floor(rng() * 3)) % style.progressions.length
    ]!;

  const makeMotif = (): Motif => {
    const rhythm = pick(rng, RHYTHMS[style.rhythm]);
    const contour = [0];
    for (let i = 1; i < rhythm.length; i++) {
      contour.push(
        Math.max(-4, Math.min(5, contour[i - 1]! + pick(rng, [-2, -1, -1, 1, 1, 2, 0, 3, -3]))),
      );
    }
    return { rhythm, contour };
  };

  const events: NoteEvent[] = [];
  const melodyBar = (
    bar: number,
    chord: number,
    motif: Motif,
    vary: boolean,
    cadence: 'none' | 'half' | 'home',
    register: number,
  ) => {
    const base = nearestChordTone(chord + register, chord);
    const notes = motif.rhythm.map(([s, len], i) => {
      let degree = base + motif.contour[i]!;
      if (vary && i >= motif.rhythm.length / 2) degree += pick(rng, [-1, 1, 2, -2]);
      if (s === 0 || s === 8) degree = nearestChordTone(degree, chord);
      return { s, len, degree };
    });
    const last = notes[notes.length - 1]!;
    if (cadence !== 'none') {
      last.len = 16 - last.s;
      last.degree =
        cadence === 'home' ? 7 * Math.round(last.degree / 7) : nearestChordTone(last.degree, 0);
    }
    for (const n of notes) {
      events.push({
        voice: 'lead',
        step: bar * 16 + n.s,
        len: n.len,
        midi: pitch(n.degree),
        vel: n.s % 8 === 0 ? 0.9 : 0.7,
      });
    }
  };

  const accompany = (bar: number, chord: number) => {
    const at = bar * 16;
    const tones = chordDegrees(chord).map((d) => pitch(d, -1));
    for (const [s, len, midi] of BASS[style.bass]!(tones, pitch(chord, -2), pitch(chord + 4, -2))) {
      events.push({ voice: 'bass', step: at + s, len, midi, vel: 0.9 });
    }
    for (const [s, len, midi] of ARP[style.arp]!(tones, 0, 0)) {
      events.push({ voice: 'harm', step: at + s, len: Math.min(len, 16 - s), midi, vel: 0.45 });
    }
    for (const [s, kind, vel] of DRUMS[style.drums]!)
      events.push({ voice: 'noise', step: at + s, kind, vel });
  };

  const motifA = makeMotif();
  const motifB = makeMotif();
  const sections = [
    { prog: progA, motif: motifA, register: 0, vary: false },
    { prog: progA, motif: motifA, register: 0, vary: true },
    { prog: progB, motif: motifB, register: 2, vary: false },
    { prog: progA, motif: motifA, register: 0, vary: true },
  ];
  let bar = 0;
  sections.forEach((section, si) => {
    const final = si === sections.length - 1;
    for (let i = 0; i < 8; i++, bar++) {
      // The loop closes with an authentic cadence, V then I, before it repeats.
      const chord = final && i === 6 ? 4 : final && i === 7 ? 0 : section.prog[i % 4]!;
      const cadence = i !== 7 ? 'none' : final ? 'home' : 'half';
      melodyBar(bar, chord, section.motif, section.vary && i % 2 === 1, cadence, section.register);
      accompany(bar, chord);
    }
  });

  return {
    bpm,
    root,
    scale,
    bars: bar,
    steps: bar * 16,
    events,
    leadDuty: style.leadDuty,
    echo: style.echo,
  };
}
