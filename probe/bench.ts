const root = process.argv[2]!;
const { generateScreen } = await import(`${root}/generate.ts`);
const { OVERWORLD } = await import(`${root}/world.ts`);
const reps = Number(process.argv[3] ?? 5);
for (const seed of [11, 3, 77]) {
  const times: number[] = [];
  for (let r = 0; r < reps; r++) {
    const world = { seed: seed + r * 1000 };
    const t = performance.now();
    for (let i = 0; i < 200; i++) generateScreen(world, { layer: OVERWORLD, sx: i % 20, sy: 30 + i });
    times.push((performance.now() - t) / 200);
  }
  console.log(`seed ${seed}: ms/screen`, times.map((x) => x.toFixed(2)).join(' '));
}
