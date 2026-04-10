import { prisma } from './setup.js';
import bcrypt from 'bcryptjs';

let counter = 0;
function seq() {
  return ++counter;
}

export async function createUser(
  overrides: { email?: string; password?: string } = {},
) {
  const n = seq();
  const password = overrides.password ?? 'password123';
  const hashed = await bcrypt.hash(password, 4); // low rounds for test speed
  return prisma.user.create({
    data: {
      email: overrides.email ?? `user${n}@test.com`,
      password: hashed,
    },
  });
}

export async function createCrawlJob(
  userId: string,
  overrides: {
    url?: string;
    maxDepth?: number;
    status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  } = {},
) {
  const n = seq();
  return prisma.crawlJob.create({
    data: {
      url: overrides.url ?? `https://example-${n}.com`,
      maxDepth: overrides.maxDepth ?? 2,
      status: overrides.status ?? 'PENDING',
      userId,
    },
  });
}

export async function createCrawlResult(
  crawlJobId: string,
  overrides: {
    url?: string;
    statusCode?: number;
    title?: string;
    depth?: number;
    links?: string[];
  } = {},
) {
  const n = seq();
  return prisma.crawlResult.create({
    data: {
      crawlJobId,
      url: overrides.url ?? `https://example.com/page-${n}`,
      statusCode: overrides.statusCode ?? 200,
      title: overrides.title ?? `Page ${n}`,
      depth: overrides.depth ?? 0,
      links: overrides.links ?? [],
    },
  });
}
