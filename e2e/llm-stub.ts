import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

/**
 * An OpenAI-compatible chat server for the e2e suite, answering from the prompt alone. A signpost
 * prompt gets the first of `NAMES` it does not already mention, so a suggestion always differs
 * from the name shown and from the last one given. One that mentions `BREAK` fails, as does every
 * other prompt, so graves keep their seed epitaphs.
 */
export const NAMES = [
  'Stubby Hollow',
  'Mockingbird Rise',
  'Fakewater Green',
  'Dummy Stones',
  'Placeholder Grove',
  'Sample Barrow',
  'Proxy Mere',
  'Standin Common',
];
export const LINE = 'Nothing here is quite what it seems.';
export const BREAK = 'Break the model';
/** Slow enough for a spec to see the dialog wait. */
const DELAY_MS = 300;

type Chat = { messages: { role: string; content: string }[] };

const reply = (body: Chat): string | undefined => {
  const [system, user] = body.messages.map((m) => m.content);
  if (!system?.includes('signposts') || !user || user.includes(BREAK)) return undefined;
  return NAMES.find((name) => !user.includes(`"${name}"`));
};

const stub = createServer((request, response) => {
  if (request.method === 'GET') return response.writeHead(200).end('ok');
  let raw = '';
  request.on('data', (chunk: Buffer) => (raw += chunk.toString()));
  request.on('end', () => {
    const name = reply(JSON.parse(raw) as Chat);
    setTimeout(() => {
      if (!name) return response.writeHead(500).end('stub refuses');
      const content = `Name: ${name}\nLine: ${LINE}`;
      response
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }));
    }, DELAY_MS);
  });
});

// Specs import the names above; only playwright's webServer runs the server.
if (process.argv[1] === fileURLToPath(import.meta.url))
  stub.listen(Number(process.env['LLM_STUB_PORT'] ?? 4311));
