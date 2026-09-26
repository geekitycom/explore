import { existsSync } from 'node:fs';
import { openMainDatabase, openWorldDatabase, type WorldDb } from './db.ts';
import { dataDir, mainDbPath, worldDbPath } from './paths.ts';
import { worldIdSchema, worldOwnedBy, type WorldId } from './worlds.ts';

export const WORLD_USAGE = `  --world <id>        act on worlds/<id>.db under DATA_DIR
  --owner <username>  act on the world that account owns`;

/** The argument after `name`, if the flag is present. */
export const flagValue = (args: readonly string[], name: string): string | undefined => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : (args[i + 1] ?? '');
};

/**
 * Opens the world an admin script names with --world or --owner, skipping the record lift so a
 * record that cannot be lifted never blocks an admin. Prints why and exits when it cannot.
 */
export function openNamedWorld(args: readonly string[]): { db: WorldDb; path: string } {
  const dir = dataDir();
  const id = worldIdFrom(args, dir);
  if (id === undefined) {
    console.error(`Name the world to act on:\n${WORLD_USAGE}`);
    process.exit(2);
  }
  const path = worldDbPath(dir, id);
  if (!existsSync(path)) {
    console.error(`No world file at ${path}. Set DATA_DIR to the directory holding it.`);
    process.exit(1);
  }
  return { db: openWorldDatabase(path, { upgradeRecords: false }), path };
}

function worldIdFrom(args: readonly string[], dir: string): WorldId | undefined {
  const world = flagValue(args, '--world');
  if (world !== undefined) {
    const parsed = worldIdSchema.safeParse(world);
    return parsed.success ? parsed.data : undefined;
  }
  const owner = flagValue(args, '--owner');
  if (owner === undefined) return undefined;
  const mainPath = mainDbPath(dir);
  if (!existsSync(mainPath)) {
    console.error(`No database at ${mainPath}. Set DATA_DIR to the directory holding it.`);
    process.exit(1);
  }
  const main = openMainDatabase(mainPath);
  const id = worldOwnedBy(main, owner);
  main.close();
  if (id === undefined) {
    console.error(`No account named ${owner} owns a world.`);
    process.exit(1);
  }
  return id;
}
