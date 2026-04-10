import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create a demo user
  const password = await bcrypt.hash('crawler123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@crawler.dev' },
    update: {},
    create: {
      email: 'demo@crawler.dev',
      password,
    },
  });

  // Create sample crawl jobs if none exist
  const jobCount = await prisma.crawlJob.count();
  if (jobCount === 0) {
    const completedJob = await prisma.crawlJob.create({
      data: {
        url: 'https://example.com',
        maxDepth: 2,
        status: 'COMPLETED',
        startedAt: new Date('2026-04-09T10:00:00Z'),
        completedAt: new Date('2026-04-09T10:00:15Z'),
        userId: user.id,
        results: {
          create: [
            {
              url: 'https://example.com',
              statusCode: 200,
              title: 'Example Domain',
              depth: 0,
              links: ['https://www.iana.org/domains/example'],
            },
            {
              url: 'https://www.iana.org/domains/example',
              statusCode: 200,
              title: 'IANA - Example domains',
              depth: 1,
              links: [],
            },
          ],
        },
      },
    });

    await prisma.crawlJob.create({
      data: {
        url: 'https://httpbin.org',
        maxDepth: 1,
        status: 'PENDING',
        userId: user.id,
      },
    });

    console.log(`Seeded user: ${user.email}`);
    console.log(`Seeded ${2} crawl jobs (1 completed with results, 1 pending)`);
  } else {
    console.log('Crawl jobs already exist, skipping seed.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
