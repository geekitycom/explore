import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import { createTextGenerator, type TextRequest } from './text-gen.ts';

type Seen = { url: string | undefined; headers: IncomingMessage['headers']; body: unknown };

let close: (() => Promise<void>) | undefined;
afterEach(async () => {
  await close?.();
  close = undefined;
});

async function fakeEndpoint(respond: (res: ServerResponse) => void) {
  const seen: Seen[] = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => (raw += chunk.toString()));
    req.on('end', () => {
      seen.push({ url: req.url, headers: req.headers, body: JSON.parse(raw) });
      respond(res);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  close = () =>
    new Promise((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}/v1`, seen };
}

const json = (status: number, body: unknown) => (res: ServerResponse) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const request: TextRequest = {
  messages: [
    { role: 'system', content: 'You write epitaphs.' },
    { role: 'user', content: 'One line.' },
  ],
  maxTokens: 40,
  temperature: 0.9,
};

it('posts the chat request and returns the trimmed completion', async () => {
  const { baseUrl, seen } = await fakeEndpoint(
    json(200, {
      choices: [{ message: { role: 'assistant', content: '  Here lies a wanderer.\n' } }],
    }),
  );
  const generate = createTextGenerator({
    baseUrl,
    model: 'gemma3:12b',
    apiKey: 'sk-secret',
    timeoutMs: 1000,
  });

  expect(await generate(request)).toEqual({ kind: 'ok', text: 'Here lies a wanderer.' });
  expect(seen).toHaveLength(1);
  expect(seen[0]!.url).toBe('/v1/chat/completions');
  expect(seen[0]!.headers.authorization).toBe('Bearer sk-secret');
  expect(seen[0]!.body).toEqual({
    model: 'gemma3:12b',
    messages: request.messages,
    max_tokens: 40,
    temperature: 0.9,
  });
});

it('sends no authorization header without a key', async () => {
  const { baseUrl, seen } = await fakeEndpoint(
    json(200, { choices: [{ message: { content: 'ok' } }] }),
  );
  const generate = createTextGenerator({ baseUrl, model: 'm', timeoutMs: 1000 });

  expect(await generate(request)).toEqual({ kind: 'ok', text: 'ok' });
  expect(seen[0]!.headers.authorization).toBeUndefined();
});

it('credits the app to OpenRouter only with the headers configured, each on its own', async () => {
  const { baseUrl, seen } = await fakeEndpoint(
    json(200, { choices: [{ message: { content: 'ok' } }] }),
  );
  const credit = (app: { appUrl?: string; appName?: string }) =>
    createTextGenerator({ baseUrl, model: 'm', timeoutMs: 1000, ...app })(request);

  await credit({ appUrl: 'https://explore.example', appName: 'Explore' });
  await credit({});
  await credit({ appUrl: 'https://explore.example' });
  await credit({ appName: 'Explore' });

  expect(seen.map(({ headers }) => [headers['http-referer'], headers['x-title']])).toEqual([
    ['https://explore.example', 'Explore'],
    [undefined, undefined],
    ['https://explore.example', undefined],
    [undefined, 'Explore'],
  ]);
});

it('reports not-configured without making a request', async () => {
  expect(await createTextGenerator(undefined)(request)).toEqual({ kind: 'not-configured' });
});

it('times out a provider that never answers', async () => {
  const { baseUrl } = await fakeEndpoint(() => {});
  const generate = createTextGenerator({ baseUrl, model: 'm', timeoutMs: 50 });

  const started = performance.now();
  expect(await generate(request)).toEqual({ kind: 'timeout' });
  expect(performance.now() - started).toBeLessThan(1000);
});

it('reports an HTTP error without the key in the message', async () => {
  const { baseUrl } = await fakeEndpoint(json(401, { error: { message: 'bad key sk-secret' } }));
  const generate = createTextGenerator({
    baseUrl,
    model: 'm',
    apiKey: 'sk-secret',
    timeoutMs: 1000,
  });

  expect(await generate(request)).toEqual({ kind: 'error', message: 'HTTP 401' });
});

it('reports a malformed or empty completion as an error', async () => {
  const shapes = [{ choices: [] }, { choices: [{ message: { content: '   ' } }] }, { nope: true }];
  for (const body of shapes) {
    const { baseUrl } = await fakeEndpoint(json(200, body));
    const result = await createTextGenerator({ baseUrl, model: 'm', timeoutMs: 1000 })(request);
    expect(result.kind).toBe('error');
    await close?.();
  }
  close = undefined;
});

it('reports an unreachable provider as an error', async () => {
  const { baseUrl } = await fakeEndpoint(json(200, {}));
  await close?.();
  close = undefined;

  expect((await createTextGenerator({ baseUrl, model: 'm', timeoutMs: 1000 })(request)).kind).toBe(
    'error',
  );
});
