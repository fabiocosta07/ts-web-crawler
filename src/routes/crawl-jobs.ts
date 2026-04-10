import { Router } from 'express';
import { z } from 'zod/v4';
import { prisma } from '../lib/prisma.js';
import type { AuthRequest } from '../middleware/auth.js';
import { runCrawl } from '../crawler/engine.js';

export const crawlJobsRouter = Router();

// GET /api/crawl-jobs?cursor=0&limit=20
crawlJobsRouter.get('/', async (req: AuthRequest, res) => {
  const cursor = Number(req.query.cursor ?? 0);
  const limit = Number(req.query.limit ?? 20);

  const items = await prisma.crawlJob.findMany({
    where: { userId: req.userId },
    skip: cursor,
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { results: true } } },
  });

  const total = await prisma.crawlJob.count({ where: { userId: req.userId } });
  const nextCursor = cursor + limit < total ? cursor + limit : null;

  res.json({
    crawlJobs: items.map((item) => ({
      id: item.id,
      url: item.url,
      maxDepth: item.maxDepth,
      status: item.status,
      createdAt: item.createdAt,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      resultCount: item._count.results,
    })),
    nextCursor,
  });
});

// GET /api/crawl-jobs/:id
crawlJobsRouter.get('/:id', async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const item = await prisma.crawlJob.findUnique({
    where: { id },
    include: {
      results: {
        orderBy: { depth: 'asc' },
      },
    },
  });

  if (!item || item.userId !== req.userId) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  res.json({
    id: item.id,
    url: item.url,
    maxDepth: item.maxDepth,
    status: item.status,
    createdAt: item.createdAt,
    startedAt: item.startedAt,
    completedAt: item.completedAt,
    results: item.results.map((r) => ({
      id: r.id,
      url: r.url,
      statusCode: r.statusCode,
      title: r.title,
      depth: r.depth,
      linkCount: r.links.length,
      error: r.error,
      crawledAt: r.crawledAt,
    })),
  });
});

const createCrawlJobSchema = z.object({
  url: z.url(),
  maxDepth: z.number().int().min(0).max(5).optional(),
});

// POST /api/crawl-jobs
crawlJobsRouter.post('/', async (req: AuthRequest, res) => {
  const parsed = createCrawlJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid input' });
    return;
  }

  const { url, maxDepth } = parsed.data;

  const job = await prisma.crawlJob.create({
    data: {
      url,
      maxDepth: maxDepth ?? 2,
      userId: req.userId!,
    },
  });

  // Fire-and-forget: start crawling in the background
  runCrawl({ jobId: job.id, startUrl: url, maxDepth: maxDepth ?? 2 }).catch(
    (err) => console.error(`Crawl job ${job.id} failed:`, err),
  );

  res.status(201).json({
    id: job.id,
    url: job.url,
    maxDepth: job.maxDepth,
    status: job.status,
    createdAt: job.createdAt,
  });
});

// DELETE /api/crawl-jobs/:id
crawlJobsRouter.delete('/:id', async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const existing = await prisma.crawlJob.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== req.userId) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  try {
    await prisma.crawlJob.delete({ where: { id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ message: 'Not found' });
  }
});
