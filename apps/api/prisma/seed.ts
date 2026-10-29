// Seed stub. Curriculum data arrives through `pnpm content:sync` in Phase 3.
import { prisma } from '../src/lib/prisma';

async function main() {
  const tracks = await prisma.track.count();
  console.log(`seed: nothing to do yet (${tracks} tracks in the database)`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
