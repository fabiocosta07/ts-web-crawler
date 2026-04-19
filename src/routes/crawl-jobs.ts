import { Router } from 'express';
import { z } from 'zod/v4';
import { prisma } from '../lib/prisma.js';
import type { AuthRequest } from '../middleware/auth.js';
import { validateBody, type ValidatedRequest } from '../middleware/validate.js';
import { runCrawl } from '../crawler/engine.js';

export const crawlJobsRouter = Router();

const paginationSchema = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

function parsePagination(query: unknown): { cursor: number; limit: number } | null {
  const parsed = paginationSchema.safeParse(query);
  return parsed.success ? parsed.data : null;
}

// GET /api/crawl-jobs?cursor=0&limit=20
crawlJobsRouter.get('/', async (req, res) => {
  const { userId } = req as unknown as AuthRequest;
  const page = parsePagination(req.query);
  if (!page) {
    res.status(400).json({ message: 'Invalid query parameters' });
    return;
  }

  const [items, total] = await Promise.all([
    prisma.crawlJob.findMany({
      where: { userId },
      skip: page.cursor,
      take: page.limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { results: true } } },
    }),
    prisma.crawlJob.count({ where: { userId } }),
  ]);

  const nextCursor = page.cursor + page.limit < total ? page.cursor + page.limit : null;

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

// GET /api/crawl-jobs/:id?cursor=0&limit=20
crawlJobsRouter.get('/:id', async (req, res) => {
  const { userId } = req as unknown as AuthRequest;
  const page = parsePagination(req.query);
  if (!page) {
    res.status(400).json({ message: 'Invalid query parameters' });
    return;
  }

  const job = await prisma.crawlJob.findFirst({
    where: { id: req.params.id, userId },
    include: { _count: { select: { results: true } } },
  });

  if (!job) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  const results = await prisma.crawlResult.findMany({
    where: { crawlJobId: job.id },
    orderBy: [{ depth: 'asc' }, { crawledAt: 'asc' }],
    skip: page.cursor,
    take: page.limit,
  });

  const nextCursor =
    page.cursor + page.limit < job._count.results ? page.cursor + page.limit : null;

  res.json({
    id: job.id,
    url: job.url,
    maxDepth: job.maxDepth,
    status: job.status,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    resultCount: job._count.results,
    results: results.map((r) => ({
      id: r.id,
      url: r.url,
      statusCode: r.statusCode,
      title: r.title,
      depth: r.depth,
      linkCount: r.links.length,
      error: r.error,
      crawledAt: r.crawledAt,
    })),
    nextCursor,
  });
});

const createCrawlJobSchema = z.object({
  url: z.url(),
  maxDepth: z.number().int().min(0).max(5).optional(),
});
type CreateCrawlJobBody = z.infer<typeof createCrawlJobSchema>;

// POST /api/crawl-jobs
crawlJobsRouter.post('/', validateBody(createCrawlJobSchema), async (req, res) => {
  const { userId } = req as unknown as AuthRequest;
  const { url, maxDepth } = (req as ValidatedRequest<CreateCrawlJobBody>).validated;
  const depth = maxDepth ?? 2;

  const job = await prisma.crawlJob.create({
    data: { url, maxDepth: depth, userId },
  });

  runCrawl({ jobId: job.id, startUrl: url, maxDepth: depth }).catch((err) => {
    console.error(`Crawl job ${job.id} failed:`, err);
  });

  res.status(201).json({
    id: job.id,
    url: job.url,
    maxDepth: job.maxDepth,
    status: job.status,
    createdAt: job.createdAt,
  });
});

// DELETE /api/crawl-jobs/:id
crawlJobsRouter.delete('/:id', async (req, res) => {
  const { userId } = req as unknown as AuthRequest;
  const { count } = await prisma.crawlJob.deleteMany({
    where: { id: req.params.id, userId },
  });

  if (count === 0) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  res.status(204).end();
});
