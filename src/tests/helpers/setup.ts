import { PrismaClient } from '@prisma/client';
import { beforeEach, afterAll } from 'vitest';

export const prisma = new PrismaClient();

// List all model table names in dependency-safe order (children first).
const TABLES = [
  'CrawlResult',
  'CrawlJob',
  'User',
] as const;

export function useCleanDatabase() {
  beforeEach(async () => {
    const tableNames = TABLES.map((t) => `"${t}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} CASCADE`);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
}
