import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

export function createPrisma(connectionString = process.env.DATABASE_URL) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = createPrisma();
