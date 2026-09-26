import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_AVATAR, GARDEN_COORD, secretGarden, type Avatar } from '@explore/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.ts';
import { openMainDatabase, type MainDb } from './db.ts';
import { createWorldHost, type WorldHost } from './host.ts';
import { hashPassword, verifyPassword } from './password.ts';
import { AUTH_LIMITS, VISIT_LIMITS } from './rate-limit.ts';
import { SESSION_TTL_MS, sessionUser } from './sessions.ts';
import { getScreen, loadWorld } from './world.ts';
import type { WorldId } from './worlds.ts';

type App = ReturnType<typeof createApp>['app'];

let db: MainDb;
let host: WorldHost;
let app: App;

const scryptCost = { N: 2 ** 4, r: 1, p: 1 };

beforeEach(() => {
  db = openMainDatabase(':memory:');
  host = createWorldHost({ pathOf: () => ':memory:' });
  app = createApp({ db, host, scryptCost }).app;
});

afterEach(() => {
  host.stop();
  db.close();
});

const PASSWORD = 'correct horse battery';

const connectionFrom = (address = '203.0.113.1') => ({
  incoming: { socket: { remoteAddress: address } },
});

function send(method: string, path: string, body?: unknown, cookie?: string, address?: string) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  return app.request(
    path,
    { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) },
    connectionFrom(address),
  );
}

function sessionCookie(res: Response): string {
  const header = res.headers.get('set-cookie') ?? '';
  const match = /^session=([^;]*)/.exec(header);
  if (!match?.[1]) throw new Error(`no session cookie in ${header}`);
  return `session=${match[1]}`;
}

async function signup(username = 'Alice', displayName = 'Ally') {
  const res = await send('POST', '/api/signup', { username, displayName, password: PASSWORD });
  expect(res.status).toBe(201);
  return { res, cookie: sessionCookie(res) };
}

describe('signup', () => {
  it('creates the user wearing the default avatar, not yet chosen, with a session cookie', async () => {
    const { res, cookie } = await signup('Alice');
    expect(await res.json()).toEqual({
      user: {
        id: 1,
        username: 'Alice',
        displayName: 'Ally',
        avatar: DEFAULT_AVATAR,
        avatarChosen: false,
        home: 1,
      },
    });
    const header = res.headers.get('set-cookie') ?? '';
    expect(header).toMatch(/HttpOnly/);
    expect(header).toMatch(/SameSite=Lax/);
    expect(header).toMatch(/Path=\//);
    expect(header).not.toMatch(/Secure/);

    const me = await send('GET', '/api/me', undefined, cookie);
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({
      user: {
        id: 1,
        username: 'Alice',
        displayName: 'Ally',
        avatar: DEFAULT_AVATAR,
        avatarChosen: false,
        home: 1,
      },
    });
  });

  it('marks the cookie Secure when secure cookies are on', async () => {
    app = createApp({ db, host, secureCookies: true, scryptCost }).app;
    const { res } = await signup();
    expect(res.headers.get('set-cookie')).toMatch(/Secure/);
  });

  it('rejects a username that differs only in case', async () => {
    await signup('Alice');
    const res = await send('POST', '/api/signup', {
      username: 'aLICE',
      displayName: 'Other',
      password: PASSWORD,
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: 'username_taken', message: 'That username is taken', field: 'username' },
    });
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(db.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 1 });
  });

  it.each([
    ['username too short', { username: 'ab' }, 'username'],
    ['username too long', { username: 'a'.repeat(21) }, 'username'],
    ['username with a space', { username: 'al ice' }, 'username'],
    ['no display name', { displayName: undefined }, 'displayName'],
    ['a display name of only spaces', { displayName: '   ' }, 'displayName'],
    ['a display name too long', { displayName: 'x'.repeat(21) }, 'displayName'],
    ['a display name with a newline', { displayName: 'Al\nly' }, 'displayName'],
    ['password too short', { password: 'short' }, 'password'],
    ['password too long', { password: 'x'.repeat(201) }, 'password'],
  ])('rejects %s with a 400 naming the field', async (_, override, field) => {
    const res = await send('POST', '/api/signup', {
      username: 'Alice',
      displayName: 'Ally',
      password: PASSWORD,
      ...override,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; field: string } };
    expect(body.error).toMatchObject({ code: 'validation', field });
    expect(db.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 0 });
  });

  it('trims the display name and lets two accounts share one', async () => {
    const first = await send('POST', '/api/signup', {
      username: 'andrew1',
      displayName: '  Andrew  ',
      password: PASSWORD,
    });
    const second = await send('POST', '/api/signup', {
      username: 'andrew2',
      displayName: 'Andrew',
      password: PASSWORD,
    });
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(db.prepare('SELECT username, display_name FROM users ORDER BY id').all()).toEqual([
      { username: 'andrew1', display_name: 'Andrew' },
      { username: 'andrew2', display_name: 'Andrew' },
    ]);
  });

  it('rejects a body that is not JSON', async () => {
    const res = await app.request(
      '/api/signup',
      { method: 'POST', body: 'nope' },
      connectionFrom(),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'invalid_json' } });
  });
});

describe('login', () => {
  it('starts a new session with the right password, case-insensitively', async () => {
    await signup('Alice');
    const res = await send('POST', '/api/login', { username: 'alice', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: {
        id: 1,
        username: 'Alice',
        displayName: 'Ally',
        avatar: DEFAULT_AVATAR,
        avatarChosen: false,
        home: 1,
      },
    });
    const me = await send('GET', '/api/me', undefined, sessionCookie(res));
    expect(me.status).toBe(200);
  });

  it('gives the same 401 for a wrong password and an unknown user', async () => {
    await signup('Alice');
    const wrongPassword = await send('POST', '/api/login', {
      username: 'Alice',
      password: 'not the password',
    });
    const unknownUser = await send('POST', '/api/login', {
      username: 'Bob',
      password: PASSWORD,
    });
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    const expected = {
      error: { code: 'invalid_credentials', message: 'Wrong username or password' },
    };
    expect(await wrongPassword.json()).toEqual(expected);
    expect(await unknownUser.json()).toEqual(expected);
    expect(wrongPassword.headers.get('set-cookie')).toBeNull();
    expect(unknownUser.headers.get('set-cookie')).toBeNull();
  });
});

describe('logout', () => {
  it('deletes the session server-side and clears the cookie', async () => {
    const { cookie } = await signup();
    const res = await send('POST', '/api/logout', undefined, cookie);
    expect(res.status).toBe(204);
    expect(res.headers.get('set-cookie')).toMatch(/^session=;.*Max-Age=0/);
    expect(db.prepare('SELECT count(*) AS n FROM sessions').get()).toEqual({ n: 0 });

    const replayed = await send('GET', '/api/me', undefined, cookie);
    expect(replayed.status).toBe(401);
  });

  it('leaves other sessions of the same user alive', async () => {
    const { cookie: first } = await signup();
    const login = await send('POST', '/api/login', { username: 'Alice', password: PASSWORD });
    await send('POST', '/api/logout', undefined, first);
    const me = await send('GET', '/api/me', undefined, sessionCookie(login));
    expect(me.status).toBe(200);
  });
});

describe('rate limits', () => {
  const { failedLoginsPerUsername, loginsPerAddress, signupsPerAddress } = AUTH_LIMITS;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => vi.useRealTimers());

  async function expectThrottled(res: Response, windowMs: number) {
    const minutes = windowMs / 60_000;
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe(String(windowMs / 1000));
    expect(await res.json()).toEqual({
      error: {
        code: 'rate_limited',
        message: `Too many attempts. Try again in ${minutes} minutes.`,
      },
    });
  }

  const login = (username: string, password: string, address?: string) =>
    send('POST', '/api/login', { username, password }, undefined, address);

  const loginWithForwardedFor = (username: string, forwardedFor: string, address = '203.0.113.1') =>
    app.request(
      '/api/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': forwardedFor },
        body: JSON.stringify({ username, password: 'wrong password' }),
      },
      connectionFrom(address),
    );

  it('throttles failed logins for one username from any address until the window passes', async () => {
    await signup('Alice');
    await signup('Bob');
    for (let i = 0; i < failedLoginsPerUsername.max; i++) {
      expect((await login('alice', 'wrong password', `198.51.100.${i}`)).status).toBe(401);
    }

    await expectThrottled(
      await login('ALICE', PASSWORD, '192.0.2.99'),
      failedLoginsPerUsername.windowMs,
    );
    expect((await login('Bob', PASSWORD, '198.51.100.0')).status).toBe(200);

    vi.setSystemTime(Date.now() + failedLoginsPerUsername.windowMs);
    expect((await login('Alice', PASSWORD)).status).toBe(200);
  });

  it('forgets earlier failures after a successful login', async () => {
    await signup('Alice');
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < failedLoginsPerUsername.max - 1; i++) {
        expect((await login('Alice', 'wrong password', `198.51.100.${i}`)).status).toBe(401);
      }
      expect((await login('Alice', PASSWORD, '192.0.2.99')).status).toBe(200);
    }
  });

  it('throttles logins from one address until the window passes', async () => {
    for (let i = 0; i < loginsPerAddress.max; i++) {
      expect((await login(`nobody${i}`, 'wrong password')).status).toBe(401);
    }

    await expectThrottled(await login('nobody', 'wrong password'), loginsPerAddress.windowMs);
    expect((await login('nobody', 'wrong password', '192.0.2.99')).status).toBe(401);

    vi.setSystemTime(Date.now() + loginsPerAddress.windowMs);
    expect((await login('nobody', 'wrong password')).status).toBe(401);
  });

  it('throttles signups from one address until the window passes', async () => {
    const attempt = (username: string, address?: string) =>
      send(
        'POST',
        '/api/signup',
        { username, displayName: username, password: PASSWORD },
        undefined,
        address,
      );
    for (let i = 0; i < signupsPerAddress.max; i++) {
      expect((await attempt(`player${i}`)).status).toBe(201);
    }

    await expectThrottled(await attempt('spammer'), signupsPerAddress.windowMs);
    expect(db.prepare('SELECT count(*) AS n FROM users').get()).toEqual({
      n: signupsPerAddress.max,
    });
    expect((await attempt('neighbor', '192.0.2.99')).status).toBe(201);

    vi.setSystemTime(Date.now() + signupsPerAddress.windowMs);
    expect((await attempt('spammer')).status).toBe(201);
  });

  it('ignores X-Forwarded-For when trustProxy is off', async () => {
    for (let i = 0; i < loginsPerAddress.max; i++) {
      expect((await loginWithForwardedFor(`nobody${i}`, `198.51.100.${i}`)).status).toBe(401);
    }
    await expectThrottled(
      await loginWithForwardedFor('nobody', '198.51.100.99'),
      loginsPerAddress.windowMs,
    );
  });

  describe('trust proxy', () => {
    beforeEach(() => {
      app = createApp({ db, host, trustProxy: true, scryptCost }).app;
    });

    it('keys the limit on the rightmost X-Forwarded-For entry, not a spoofed leftmost one', async () => {
      for (let i = 0; i < loginsPerAddress.max; i++) {
        expect(
          (await loginWithForwardedFor(`nobody${i}`, `spoofed-${i}, 198.51.100.1`)).status,
        ).toBe(401);
      }
      await expectThrottled(
        await loginWithForwardedFor('nobody', 'another-spoof, 198.51.100.1'),
        loginsPerAddress.windowMs,
      );
      expect((await loginWithForwardedFor('nobody', 'spoofed, 198.51.100.2')).status).toBe(401);
    });
  });
});

describe('me', () => {
  it.each([
    ['no cookie', undefined],
    ['an unknown token', 'session=forged'],
  ])('returns 401 with %s', async (_, cookie) => {
    const res = await send('GET', '/api/me', undefined, cookie);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: 'unauthenticated' } });
  });

  it('saving a profile keeps the name and marks the avatar chosen for every later session', async () => {
    const { cookie } = await signup();
    const avatar: Avatar = { ...DEFAULT_AVATAR, hairStyle: 'spiky', shirt: 'purple' };
    const saved = {
      user: { id: 1, username: 'Alice', displayName: 'Al', avatar, avatarChosen: true, home: 1 },
    };
    const res = await send('PUT', '/api/me/profile', { displayName: ' Al ', avatar }, cookie);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(saved);

    const me = await send('GET', '/api/me', undefined, cookie);
    expect(await me.json()).toEqual(saved);
    const login = await send('POST', '/api/login', { username: 'Alice', password: PASSWORD });
    expect(await login.json()).toEqual(saved);
  });

  it('rejects an invalid avatar, an empty name, and an unauthenticated update', async () => {
    const { cookie } = await signup();
    const invalid = await send(
      'PUT',
      '/api/me/profile',
      { displayName: 'Ally', avatar: { ...DEFAULT_AVATAR, hairStyle: 'mohawk' } },
      cookie,
    );
    expect(invalid.status).toBe(400);
    const blank = await send(
      'PUT',
      '/api/me/profile',
      { displayName: ' ', avatar: DEFAULT_AVATAR },
      cookie,
    );
    expect(blank.status).toBe(400);
    expect(await blank.json()).toMatchObject({ error: { field: 'displayName' } });
    expect(sessionUser(db, cookie)).toMatchObject({ displayName: 'Ally', avatarChosen: false });
    const anonymous = await send('PUT', '/api/me/profile', {
      displayName: 'Ally',
      avatar: DEFAULT_AVATAR,
    });
    expect(anonymous.status).toBe(401);
  });
});

describe('storage', () => {
  it('holds only an scrypt hash of the password and a sha256 of the session token', async () => {
    const { cookie } = await signup();
    const token = cookie.slice('session='.length);

    const { password_hash } = db.prepare('SELECT password_hash FROM users').get() as {
      password_hash: string;
    };
    expect(password_hash).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(password_hash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, password_hash)).toBe(true);
    expect(await verifyPassword('wrong password', password_hash)).toBe(false);

    const sessions = db.prepare('SELECT token_hash FROM sessions').all();
    expect(sessions).toEqual([{ token_hash: createHash('sha256').update(token).digest('hex') }]);
  });

  it('hashes with the full scrypt cost unless told otherwise', async () => {
    const stored = await hashPassword(PASSWORD);
    expect(stored).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyPassword(PASSWORD, stored)).toBe(true);
  });

  it('salts each password so equal passwords hash differently', async () => {
    await signup('Alice');
    await signup('Bobby');
    const hashes = db.prepare('SELECT password_hash FROM users').all();
    expect(new Set(hashes.map((row) => row.password_hash)).size).toBe(2);
  });

  it('expires sessions after 30 days', async () => {
    const { cookie } = await signup();
    expect(sessionUser(db, cookie)).toMatchObject({ username: 'Alice' });
    expect(sessionUser(db, cookie, Date.now() + SESSION_TTL_MS + 1000)).toBeUndefined();
  });
});

it('answers unknown /api paths with a JSON 404', async () => {
  const res = await send('GET', '/api/nope');
  expect(res.status).toBe(404);
  expect(await res.json()).toMatchObject({ error: { code: 'not_found' } });
});

describe('worlds', () => {
  it("signup creates the account's world file with its own seed and the garden", async () => {
    const dir = mkdtempSync(join(tmpdir(), 'explore-app-'));
    try {
      host.stop();
      host = createWorldHost({ pathOf: (id) => join(dir, `${id}.db`) });
      app = createApp({ db, host, scryptCost }).app;
      const { res } = await signup('Alice');
      expect(await res.json()).toMatchObject({ user: { home: 1 } });
      expect(readdirSync(dir)).toContain('1.db');
      const world = host.open(1 as WorldId).db;
      expect(Number.isInteger(loadWorld(world).seed)).toBe(true);
      expect(getScreen(world, GARDEN_COORD)).toEqual(secretGarden());
    } finally {
      host.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("gives each account its own home world and shows only that world's map", async () => {
    const alice = await signup('Alice');
    const bob = await signup('Bobby');
    const me = await send('GET', '/api/me', undefined, bob.cookie);
    expect(await me.json()).toMatchObject({ user: { id: 2, home: 2 } });

    expect((await send('GET', '/api/worlds/2/map', undefined, bob.cookie)).status).toBe(200);
    expect((await send('GET', '/api/worlds/1/map', undefined, alice.cookie)).status).toBe(200);
    const refused = await send('GET', '/api/worlds/1/map', undefined, bob.cookie);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({
      error: { code: 'forbidden', message: 'That world is not open to you' },
    });
    expect((await send('GET', '/api/worlds/abc/map', undefined, bob.cookie)).status).toBe(403);
    expect((await send('GET', '/api/worlds/2/map')).status).toBe(401);
  });
});

describe('visit code guesses', () => {
  const { codesPerUser, codesPerAddress } = VISIT_LIMITS;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => vi.useRealTimers());

  const guess = (cookie: string, code: string, address?: string) =>
    send('POST', '/api/visits', { code }, cookie, address);

  it('throttles one account after its share of guesses, whatever the address, until the window passes', async () => {
    const { cookie } = await signup('Alice');
    const { cookie: bobCookie } = await signup('Bob');
    for (let i = 0; i < codesPerUser.max; i++) {
      expect((await guess(cookie, 'ABCDE', `198.51.100.${i}`)).status).toBe(404);
    }
    const throttled = await guess(cookie, 'ABCDE', '192.0.2.99');
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get('retry-after')).toBe(String(codesPerUser.windowMs / 1000));
    expect(await throttled.json()).toMatchObject({ error: { code: 'rate_limited' } });
    expect((await guess(bobCookie, 'ABCDE', '192.0.2.99')).status).toBe(404);

    vi.setSystemTime(Date.now() + codesPerUser.windowMs);
    expect((await guess(cookie, 'ABCDE')).status).toBe(404);
  });

  it('throttles one address after its share of guesses across accounts', async () => {
    const cookies = [];
    for (let i = 0; i < 4; i++) cookies.push((await signup(`user${i}`, `User ${i}`)).cookie);
    for (let i = 0; i < codesPerAddress.max; i++) {
      expect((await guess(cookies[i % 4]!, 'ABCDE')).status).toBe(404);
    }
    expect((await guess(cookies[0]!, 'ABCDE')).status).toBe(429);
    expect((await guess(cookies[0]!, 'ABCDE', '198.51.100.7')).status).toBe(404);
  });

  it("forgets an account's guesses once one opens a door", async () => {
    const { cookie } = await signup('Alice');
    const { cookie: bobCookie } = await signup('Bob');
    const opened = await send('POST', '/api/worlds/1/visitors', undefined, cookie);
    const { code } = (await opened.json()) as { code: string };
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < codesPerUser.max - 1; i++) {
        expect((await guess(bobCookie, 'ABCDE', `198.51.100.${i}`)).status).toBe(404);
      }
      expect((await guess(bobCookie, code, '192.0.2.99')).status).toBe(200);
    }
  });
});
