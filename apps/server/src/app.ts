import type { DatabaseSync } from 'node:sqlite';
import { avatarSchema } from '@explore/core';
import { getConnInfo } from '@hono/node-server/conninfo';
import { createNodeWebSocket } from '@hono/node-ws';
import { Hono, type Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import { hashPassword, rejectUnknownUser, verifyPassword } from './password.ts';
import type { Game } from './play.ts';
import type { Player } from './presence.ts';
import { AUTH_LIMITS, createRateLimiter, type RateLimiter } from './rate-limit.ts';
import {
  createSession,
  deleteSession,
  SESSION_COOKIE,
  sessionToken,
  sessionUser,
} from './sessions.ts';
import { findUserCredentials, insertUser, updateAvatar, type User } from './users.ts';
import { worldMapJson } from './map.ts';

type Env = { Variables: { user: User } };

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

const signupBody = z.object({ username, password, avatar: avatarSchema });
const loginBody = z.object({ username: z.string().max(200), password: z.string().max(200) });
const avatarBody = z.object({ avatar: avatarSchema });

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
  game,
  secureCookies = false,
}: {
  db: DatabaseSync;
  game: Game;
  secureCookies?: boolean;
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

  const signupsByAddress = createRateLimiter(AUTH_LIMITS.signupsPerAddress);
  const loginsByAddress = createRateLimiter(AUTH_LIMITS.loginsPerAddress);
  const failedLoginsByUsername = createRateLimiter(AUTH_LIMITS.failedLoginsPerUsername);

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

  const countAttempt = (c: Context, limiter: RateLimiter) => {
    const address = getConnInfo(c).remote.address ?? 'unknown';
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
      passwordHash: await hashPassword(body.password),
      avatar: body.avatar,
    });
    if (!user) throw new ApiError(409, 'username_taken', 'That username is taken', 'username');
    startSession(c, user);
    return c.json({ user }, 201);
  });

  app.post('/api/login', async (c) => {
    countAttempt(c, loginsByAddress);
    const body = await parseBody(c, loginBody);
    const usernameKey = body.username.toLowerCase();
    throttle(c, failedLoginsByUsername, usernameKey);
    failedLoginsByUsername.hit(usernameKey);
    const found = findUserCredentials(db, body.username);
    const ok = found
      ? await verifyPassword(body.password, found.passwordHash)
      : await rejectUnknownUser(body.password);
    if (!found || !ok) {
      throw new ApiError(401, 'invalid_credentials', 'Wrong username or password');
    }
    failedLoginsByUsername.reset(usernameKey);
    startSession(c, found.user);
    return c.json({ user: found.user });
  });

  app.post('/api/logout', (c) => {
    const token = sessionToken(c.req.header('cookie'));
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

  app.use('/api/me/*', requireUser);

  app.get('/api/me', (c) => c.json({ user: c.get('user') }));

  app.put('/api/me/avatar', async (c) => {
    const { avatar } = await parseBody(c, avatarBody);
    return c.json({ user: updateAvatar(db, c.get('user').id, avatar) });
  });

  app.get('/api/map', requireUser, (c) =>
    c.body(worldMapJson(db, c.get('user').id), 200, { 'content-type': 'application/json' }),
  );

  app.all('/api/*', () => {
    throw new ApiError(404, 'not_found', 'No such endpoint');
  });

  app.get(
    '/ws',
    requireUser,
    nodeWs.upgradeWebSocket((c: Context<Env>) => {
      const user = c.get('user');
      let player: Player | undefined;
      return {
        onOpen(_event, ws) {
          player = game.connect(user, {
            send: (message) => ws.send(JSON.stringify(message)),
            close: (code, reason) => ws.close(code, reason),
          });
        },
        onMessage(event: { data: unknown }) {
          if (player && typeof event.data === 'string') game.receive(player, event.data);
        },
        onClose() {
          if (player) game.disconnect(player);
        },
      };
    }),
  );

  return { app, injectWebSocket: nodeWs.injectWebSocket.bind(nodeWs) };
}
