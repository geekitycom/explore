import type { Dir } from '@explore/core';

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'n',
  KeyW: 'n',
  ArrowDown: 's',
  KeyS: 's',
  ArrowLeft: 'w',
  KeyA: 'w',
  ArrowRight: 'e',
  KeyD: 'e',
};

/** Tracks held movement keys. Releases everything on blur so a key can't stick down. */
export function keyboard() {
  const held = new Set<Dir>();
  let lastPressed: Dir | undefined;

  const down = (event: KeyboardEvent) => {
    const dir = KEY_DIRS[event.code];
    if (!dir) return;
    event.preventDefault();
    if (!held.has(dir)) lastPressed = dir;
    held.add(dir);
  };
  const up = (event: KeyboardEvent) => {
    const dir = KEY_DIRS[event.code];
    if (dir) held.delete(dir);
  };
  const clear = () => held.clear();

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', clear);

  return {
    held: held as ReadonlySet<Dir>,
    lastPressed: () => lastPressed,
    dispose: () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    },
  };
}
