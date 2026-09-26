import { z } from 'zod';
import { tileX, tileY } from '../fields.ts';
import { refuse, traceAt, traceKind, type TraceKind } from '../kind.ts';

const fields = {
  by: z.number().int(),
  label: z.string().max(20).optional(),
  /** Stands in for a taken rock: hides the generated feature and does not block. */
  hides: z.boolean().optional(),
};
const relabel = z.object({ tx: tileX, ty: tileY, label: z.string().max(20) });

/**
 * Proves the foundation in tests; nothing in play grants a probe. The annotation is what lets
 * the registry derive `Trace` and `Item` from this value while the hooks below use them.
 */
export const probe: TraceKind<'probe', typeof fields, string, z.output<typeof relabel>> = traceKind(
  {
    kind: 'probe',
    fields,
    limits: { carry: 2 },
    solid: (trace) => !trace.hides,
    look: (trace) => ({
      hidesFeature: trace.hides ?? false,
      recipe: { family: 'rock', params: { stone: 'granite', size: 0.6 } },
    }),
    bubble: (trace) => (trace.label ? { text: trace.label } : undefined),
    interact: (_here, spot) =>
      spot.mine
        ? {
            ok: true,
            label: 'Pick up the probe',
            next: null,
            gain: { kind: 'probe', variant: 'probe' },
          }
        : undefined,
    carry: {
      variant: z.string().min(1).max(20),
      full: 'You can only carry 2 probes.',
      name: (variant) => `${variant} probe`,
      icon: () => ({ family: 'rock', params: { stone: 'granite', size: 0.4 } }),
      use: (here, spot) =>
        spot.mine
          ? refuse('There is a probe here already.')
          : !spot.walkable
            ? refuse('Something is in the way.')
            : { ok: true, label: 'Place the probe', next: { by: here.me.id } },
    },
    action: {
      input: relabel,
      apply: (here, { tx, ty, label }) => {
        const mine = traceAt(here.place, { tx, ty }, 'probe');
        return mine
          ? { ok: true, label: 'Label the probe', next: { by: mine.by, label }, at: { tx, ty } }
          : refuse('No probe there.');
      },
    },
  },
);
