const src = process.argv[2]!;
const { generateScreen } = await import(`${src}/generate.ts`);
const { OVERWORLD } = await import(`${src}/world.ts`);
const world = { seed: 11 };
const t = performance.now();
for (let i = 0; i < 200; i++) generateScreen(world, { layer: OVERWORLD, sx: i % 20, sy: 30 + i });
console.log(src.split('/').pop(), ((performance.now() - t) / 200).toFixed(2));
