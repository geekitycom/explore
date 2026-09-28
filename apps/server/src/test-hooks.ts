import { TILE, inventorySchema, layerIdSchema, parseInventory } from '@explore/core';
import { Hono } from 'hono';
import { z } from 'zod';
import type { WorldHost } from './host.ts';
import type { RateLimits } from './rate-limit.ts';
import { worldIdSchema } from './worlds.ts';

/**
 * Routes the e2e suite uses to set up state. main.ts imports this module only when the test
 * setting is on, and the production image does not ship it (see settings.ts).
 */

type Deps = { host: WorldHost; rateLimits: RateLimits };

/** A hook's body, and what it does once the body parses. */
const hook = <S extends z.ZodType>(body: S, run: (deps: Deps, input: z.output<S>) => void) => ({
  body,
  apply(deps: Deps, raw: unknown): z.ZodError | undefined {
    const parsed = body.safeParse(raw);
    if (!parsed.success) return parsed.error;
    run(deps, parsed.data);
    return undefined;
  },
});

const player = { worldId: worldIdSchema, userId: z.number().int().positive() };

/** Each goes through the path the game itself writes by, so a live player never undoes it. */
const HOOKS = {
  /** Replaces the player's pockets. */
  inventory: hook(
    z.object({ ...player, stacks: inventorySchema }),
    ({ host }, { worldId, userId, stacks }) =>
      host.setInventory(worldId, userId, parseInventory(stacks)),
  ),
  /** Stands the player on a tile, facing north. */
  place: hook(
    z.object({
      ...player,
      coord: z.object({ layer: layerIdSchema, sx: z.number().int(), sy: z.number().int() }),
      tile: z.object({ tx: z.number().int(), ty: z.number().int() }),
    }),
    ({ host }, { worldId, userId, coord, tile }) =>
      host.place(worldId, userId, coord, {
        x: (tile.tx + 0.5) * TILE,
        y: (tile.ty + 1) * TILE - 2,
        dir: 'n',
        moving: false,
      }),
  ),
  'rate-limits': hook(z.object({}), ({ rateLimits }) => rateLimits.clear()),
};

export type TestHookName = keyof typeof HOOKS;
export type TestHookBody<K extends TestHookName> = z.input<(typeof HOOKS)[K]['body']>;

const isHook = (name: string): name is TestHookName => Object.hasOwn(HOOKS, name);

export function testHookRoutes(deps: Deps): Hono {
  const routes = new Hono();
  routes.post('/:name', async (c) => {
    const name = c.req.param('name');
    if (!isHook(name)) return c.json({ error: `No test hook named ${name}` }, 404);
    const error = HOOKS[name].apply(deps, await c.req.json().catch(() => undefined));
    if (error) return c.json({ error: error.message }, 400);
    return c.body(null, 204);
  });
  return routes;
}
