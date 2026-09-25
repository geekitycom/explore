import { compose } from './compose.ts';
import type { AudioEngine } from './engine.ts';
import type { Tune } from './mood.ts';
import { createSynth } from './synth.ts';

const LOOKAHEAD_S = 0.3;
const TICK_MS = 50;
const CROSSFADE_S = 1.5;

type Playing = { tune: Tune; out: GainNode; timer: number };

/** Plays one tune at a time. A new tune crossfades in; asking for the current one does nothing. */
export function createMusic(engine: AudioEngine) {
  let playing: Playing | undefined;
  let wanted: Tune | undefined;

  const start = (tune: Tune) =>
    engine.whenReady(({ ctx, music }) => {
      if (wanted?.key !== tune.key || playing?.tune.key === tune.key) return;
      const now = ctx.currentTime;
      if (playing) {
        const old = playing;
        old.out.gain.setTargetAtTime(0, now, CROSSFADE_S / 4);
        window.setTimeout(
          () => {
            window.clearInterval(old.timer);
            old.out.disconnect();
          },
          CROSSFADE_S * 1000 + 200,
        );
      }
      const out = ctx.createGain();
      out.gain.setValueAtTime(0, now);
      out.gain.linearRampToValueAtTime(1, now + CROSSFADE_S);
      out.connect(music);
      const synth = createSynth(ctx, compose(tune.biome, tune.seed), out);
      const songStart = now + 0.05;
      let scheduled = 0;
      const tick = () => {
        const until = ctx.currentTime - songStart + LOOKAHEAD_S;
        if (until <= scheduled) return;
        synth.schedule(songStart, scheduled, until);
        scheduled = until;
      };
      tick();
      playing = { tune, out, timer: window.setInterval(tick, TICK_MS) };
    });

  return {
    play(tune: Tune) {
      wanted = tune;
      start(tune);
    },
    current: () => playing?.tune.key,
    stop() {
      if (playing) window.clearInterval(playing.timer);
      playing?.out.disconnect();
      playing = undefined;
    },
  };
}
