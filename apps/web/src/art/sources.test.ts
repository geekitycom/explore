import { describe, expect, it } from 'vitest';
import { AMBIENT_SOUNDS } from '../audio/ambience.ts';
import { SHEETS } from './sheets.ts';

const ROOT = '../../public/assets/ninja-adventure/';
const shipped = Object.keys(import.meta.glob('../../public/assets/**/*')).map((path) =>
  path.startsWith(ROOT) ? path.slice(ROOT.length) : path,
);
const sources = Object.values(
  import.meta.glob<string>('../../public/assets/ninja-adventure/SOURCES.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
)[0]!;

describe('shipped art and audio', () => {
  it('lives only under the CC0 Ninja Adventure directory, with its license', () => {
    expect(shipped.every((path) => !path.startsWith('../'))).toBe(true);
    expect(shipped).toContain('LICENSE.txt');
    expect(sources).toMatch(/CC0 1\.0/);
    expect(sources).toContain('https://pixel-boy.itch.io/ninja-adventure-asset-pack');
  });

  it('lists every shipped file in SOURCES.md', () => {
    for (const path of shipped.filter((p) => p !== 'SOURCES.md')) {
      expect(sources, path).toContain(`\`${path}\``);
    }
  });

  it('ships every sheet the registry loads', () => {
    for (const path of Object.values(SHEETS)) expect(shipped).toContain(path);
  });

  it('ships every ambient sound the client loads', () => {
    for (const path of Object.values(AMBIENT_SOUNDS)) expect(shipped).toContain(path);
  });
});
