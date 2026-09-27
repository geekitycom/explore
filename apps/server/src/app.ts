import { REFUSED_CLOSE_CODE, avatarSchema, displayNameSchema } from '@explore/core';
import { getConnInfo } from '@hono/node-server/conninfo';
import { createNodeWebSocket } from '@hono/node-ws';
import { Hono, type Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import type { MainDb } from './db.ts';
import type { WorldHost } from './host.ts';
import { worldMapJson } from './map.ts';
import {
  hashPassword,
  rejectUnknownUser,
  SCRYPT_COST,
  verifyPassword,
  type ScryptCost,
} from './password.ts';
import type { Player } from './presence.ts';
import { AUTH_LIMITS, VISIT_LIMITS, createRateLimiter, type RateLimiter } from './rate-limit.ts';
import {
  createSession,
  deleteSession,
  SESSION_COOKIE,
  sessionToken,
  sessionUser,
} from './sessions.ts';
import { findUserCredentials, insertUser, updateProfile, type User } from './users.ts';
import { visitCodeSchema } from './visitors.ts';
import {
  admission,
  ensureHomeWorld,
  homeWorld,
  worldIdSchema,
  type Admission,
  type WorldId,
} from './worlds.ts';

type Env = { Variables: { user: User; worldId: WorldId; admission: Admission } };

class ApiError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;
  readonly field: string | undefined;

  constructor(status: ContentfulStatusCode, code: string, message: string, field?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

const username = z
  .string()
  .regex(/^[A-Za-z0-9_-]{3,20}$/, 'Username must be 3-20 letters, digits, _ or -');
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200, 'Password must be at most 200 characters');

const REFUSED_MESSAGE = 'That world is not open to you';
const UNKNOWN_CODE_MESSAGE =
  "That code doesn't open any world right now. Check it with your friend.";

const signupBody = z.object({ username, displayName: displayNameSchema, password });
const loginBody = z.object({ username: z.string().max(200), password: z.string().max(200) });
const profileBody = z.object({ displayName: displayNameSchema, avatar: avatarSchema });
const visitBody = z.object({ code: visitCodeSchema });

async function parseBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const json: unknown = await c.req.json().catch(() => {
    throw new ApiError(400, 'invalid_json', 'Request body must be JSON');
  });
  const result = schema.safeParse(json);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue?.path[0];
  throw new ApiError(
    400,
    'validation',
    issue?.message ?? 'Invalid request',
    typeof field === 'string' ? field : undefined,
  );
}

export function createApp({
  db,
  host,
  admit = (user, worldId) => admission(db, host, user, worldId),
  secureCookies = false,
  trustProxy = false,
  scryptCost = SCRYPT_COST,
}: {
  db: MainDb;
  host: WorldHost;
  /** Who may enter which world, and as what; tests widen it to put two players in one world. */
  admit?: (user: User, worldId: WorldId) => Admission | undefined;
  secureCookies?: boolean;
  /** Behind a reverse proxy, key rate limits on the client address it reports. */
  trustProxy?: boolean;
  /** Tests lower it so hashing does not dominate their run time. */
  scryptCost?: ScryptCost;
}) {
  const startSession = (c: Context, user: User) => {
    const { token, expiresAt } = createSession(db, user.id);
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      secure: secureCookies,
      expires: new Date(expiresAt),
    });
  };

  /** The account as the client sees it, with its home world open and ready to join. */
  const account = (user: User) => {
    const home = ensureHomeWorld(db, user.id);
    host.open(home);
    return { user: { ...user, home } };
  };

  const signupsByAddress = createRateLimiter(AUTH_LIMITS.signupsPerAddress);
  const loginsByAddress = createRateLimiter(AUTH_LIMITS.loginsPerAddress);
  const failedLogins = createRateLimiter(AUTH_LIMITS.failedLoginsPerAddressAndUsername);
  const codesByAddress = createRateLimiter(VISIT_LIMITS.codesPerAddress);
  const codesByUser = createRateLimiter(VISIT_LIMITS.codesPerUser);

  const throttle = (c: Context, limiter: RateLimiter, key: string) => {
    const ms = limiter.retryAfterMs(key);
    if (ms === 0) return;
    const seconds = Math.ceil(ms / 1000);
    const minutes = Math.ceil(seconds / 60);
    c.header('Retry-After', String(seconds));
    throw new ApiError(
      429,
      'rate_limited',
      `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    );
  };

  const clientAddress = (c: Context): string => {
    if (trustProxy) {
      const forwardedFor = c.req.header('x-forwarded-for');
      const appended = forwardedFor?.split(',').pop()?.trim();
      if (appended) return appended;
    }
    return getConnInfo(c).remote.address ?? 'unknown';
  };

  const countAttempt = (c: Context, limiter: RateLimiter) => {
    const address = clientAddress(c);
    throttle(c, limiter, address);
    limiter.hit(address);
  };

  const app = new Hono<Env>();
  const nodeWs = createNodeWebSocket({ app });

  app.onError((error, c) => {
    if (error instanceof ApiError) {
      const field = error.field === undefined ? {} : { field: error.field };
      return c.json(
        { error: { code: error.code, message: error.message, ...field } },
        error.status,
      );
    }
    console.error(error);
    return c.json({ error: { code: 'internal', message: 'Internal server error' } }, 500);
  });

  app.post('/api/signup', async (c) => {
    countAttempt(c, signupsByAddress);
    const body = await parseBody(c, signupBody);
    const user = insertUser(db, {
      username: body.username,
      displayName: body.displayName,
      passwordHash: await hashPassword(body.password, scryptCost),
    });
    if (!user) throw new ApiError(409, 'username_taken', 'That username is taken', 'username');
    startSession(c, user);
    return c.json(account(user), 201);
  });

  app.post('/api/login', async (c) => {
    countAttempt(c, loginsByAddress);
    const body = await parseBody(c, loginBody);
    // Keyed on the address too, so guesses from elsewhere cannot lock the owner out.
    const failureKey = `${clientAddress(c)} ${body.username.toLowerCase()}`;
    throttle(c, failedLogins, failureKey);
    failedLogins.hit(failureKey);
    const found = findUserCredentials(db, body.username);
    const ok = found
      ? await verifyPassword(body.password, found.passwordHash)
      : await rejectUnknownUser(body.password, scryptCost);
    if (!found || !ok) {
      throw new ApiError(401, 'invalid_credentials', 'Wrong username or password');
    }
    failedLogins.reset(failureKey);
    startSession(c, found.user);
    return c.json(account(found.user));
  });

  /** Logging out also closes the player's world to visitors, wherever else they are signed in. */
  app.post('/api/logout', (c) => {
    const token = sessionToken(c.req.header('cookie'));
    const user = sessionUser(db, c.req.header('cookie'));
    const home = user && homeWorld(db, user.id);
    if (home !== undefined) host.closeToVisitors(home);
    if (token) deleteSession(db, token);
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: secureCookies });
    return c.body(null, 204);
  });

  const requireUser = createMiddleware<Env>(async (c, next) => {
    const user = sessionUser(db, c.req.header('cookie'));
    if (!user) throw new ApiError(401, 'unauthenticated', 'Not logged in');
    c.set('user', user);
    await next();
  });

  /** Reads `:id` from the path; a world the player may not enter, or no world at all, is 403. */
  const requireWorld = createMiddleware<Env>(async (c, next) => {
    const parsed = worldIdSchema.safeParse(c.req.param('id'));
    const role = parsed.success ? admit(c.get('user'), parsed.data) : undefined;
    if (!parsed.success || !role) throw new ApiError(403, 'forbidden', REFUSED_MESSAGE);
    c.set('worldId', parsed.data);
    c.set('admission', role);
    await next();
  });

  const requireOwner = createMiddleware<Env>(async (c, next) => {
    if (c.get('admission') !== 'owner') {
      throw new ApiError(403, 'forbidden', 'Only the owner can open or close a world');
    }
    await next();
  });

  app.use('/api/me/*', requireUser);

  app.get('/api/me', (c) => c.json(account(c.get('user'))));

  app.put('/api/me/profile', async (c) => {
    const user = updateProfile(db, c.get('user').id, await parseBody(c, profileBody));
    host.changeProfile(user);
    return c.json(account(user));
  });

  app.get('/api/worlds/:id/map', requireUser, requireWorld, (c) => {
    const world = host.open(c.get('worldId'));
    return c.body(worldMapJson(world.db, c.get('user').id, world.game.roster()), 200, {
      'content-type': 'application/json',
    });
  });

  const visitorsJson = (worldId: WorldId) => {
    const opening = host.opening(worldId);
    return { code: opening.state === 'open' ? opening.code : null };
  };

  app.get('/api/worlds/:id/visitors', requireUser, requireWorld, requireOwner, (c) =>
    c.json(visitorsJson(c.get('worldId'))),
  );

  app.post('/api/worlds/:id/visitors', requireUser, requireWorld, requireOwner, (c) => {
    host.openToVisitors(c.get('worldId'), c.get('user'));
    return c.json(visitorsJson(c.get('worldId')));
  });

  app.delete('/api/worlds/:id/visitors', requireUser, requireWorld, requireOwner, (c) => {
    host.closeToVisitors(c.get('worldId'));
    return c.body(null, 204);
  });

  /** Every guess counts against the address and the account, so codes cannot be brute-forced. */
  app.post('/api/visits', requireUser, async (c) => {
    countAttempt(c, codesByAddress);
    const userKey = String(c.get('user').id);
    throttle(c, codesByUser, userKey);
    codesByUser.hit(userKey);
    const { code } = await parseBody(c, visitBody);
    const world = host.redeemCode(code, c.get('user').id);
    if (!world) throw new ApiError(404, 'unknown_code', UNKNOWN_CODE_MESSAGE);
    codesByUser.reset(userKey);
    return c.json({ world });
  });

  app.all('/api/*', () => {
    throw new ApiError(404, 'not_found', 'No such endpoint');
  });

  app.get(
    '/ws/worlds/:id',
    requireUser,
    nodeWs.upgradeWebSocket((c: Context<Env>) => {
      const user = c.get('user');
      const parsed = worldIdSchema.safeParse(c.req.param('id'));
      const role = parsed.success ? admit(user, parsed.data) : undefined;
      const worldId = parsed.success && role ? parsed.data : undefined;
      let player: Player | undefined;
      return {
        onOpen(_event, ws) {
          if (worldId === undefined || !role) {
            ws.close(REFUSED_CLOSE_CODE, REFUSED_MESSAGE);
            return;
          }
          player = host.connect(
            worldId,
            user,
            {
              send: (message) => ws.send(JSON.stringify(message)),
              close: (code, reason) => ws.close(code, reason),
            },
            role,
          );
        },
        onMessage(event: { data: unknown }) {
          if (player && worldId !== undefined && typeof event.data === 'string') {
            host.receive(worldId, player, event.data);
          }
        },
        onClose() {
          if (player && worldId !== undefined) host.disconnect(worldId, player);
        },
      };
    }),
  );

  return { app, injectWebSocket: nodeWs.injectWebSocket.bind(nodeWs) };
}
