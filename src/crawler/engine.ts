import * as cheerio from 'cheerio';
import { CrawlStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

interface CrawlOptions {
  jobId: string;
  startUrl: string;
  maxDepth: number;
}

interface PageResult {
  url: string;
  statusCode: number | null;
  title: string | null;
  links: string[];
  error: string | null;
  depth: number;
}

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const CONCURRENCY = Number(process.env.CRAWL_CONCURRENCY ?? 5);
const MAX_PAGES_PER_JOB = Number(process.env.MAX_PAGES_PER_JOB ?? 500);

function normalizeUrl(raw: string, base: string): string | null {
  try {
    const url = new URL(raw, base);
    url.hash = '';
    let href = url.href;
    if (href.endsWith('/') && url.pathname !== '/') {
      href = href.slice(0, -1);
    }
    return href;
  } catch {
    return null;
  }
}

async function readBodyCapped(response: Response, maxBytes: number): Promise<string | null> {
  if (!response.body) return await response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let total = 0;
  let out = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      return null;
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

async function fetchPage(url: string): Promise<Omit<PageResult, 'depth'>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ts-web-crawler/1.0',
        Accept: 'text/html',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return {
        url,
        statusCode: response.status,
        title: null,
        links: [],
        error: null,
      };
    }

    const html = await readBodyCapped(response, MAX_BODY_BYTES);
    if (html === null) {
      return {
        url,
        statusCode: response.status,
        title: null,
        links: [],
        error: `Response exceeded ${MAX_BODY_BYTES} bytes`,
      };
    }

    const $ = cheerio.load(html);
    const title = $('title').first().text().trim() || null;

    const links: string[] = [];
    $('a[href]').each((_i, el) => {
      const href = $(el).attr('href');
      if (href) {
        const normalized = normalizeUrl(href, url);
        if (normalized && normalized.startsWith('http')) {
          links.push(normalized);
        }
      }
    });

    return {
      url,
      statusCode: response.status,
      title,
      links: [...new Set(links)],
      error: null,
    };
  } catch (err) {
    return {
      url,
      statusCode: null,
      title: null,
      links: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function processUrl(
  url: string,
  depth: number,
  jobId: string,
): Promise<string[]> {
  const page = await fetchPage(url);

  await prisma.crawlResult.upsert({
    where: { crawlJobId_url: { crawlJobId: jobId, url: page.url } },
    update: {
      statusCode: page.statusCode,
      title: page.title,
      links: page.links,
      error: page.error,
    },
    create: {
      crawlJobId: jobId,
      url: page.url,
      statusCode: page.statusCode,
      title: page.title,
      depth,
      links: page.links,
      error: page.error,
    },
  });

  return page.links;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function runCrawl({ jobId, startUrl, maxDepth }: CrawlOptions): Promise<void> {
  await prisma.crawlJob.update({
    where: { id: jobId },
    data: { status: CrawlStatus.RUNNING, startedAt: new Date() },
  });

  const origin = new URL(startUrl).origin;
  const visited = new Set<string>();
  let currentLevel: string[] = [startUrl];
  let depth = 0;

  try {
    while (currentLevel.length > 0 && depth <= maxDepth) {
      const remaining = MAX_PAGES_PER_JOB - visited.size;
      if (remaining <= 0) break;

      const toFetch: string[] = [];
      for (const url of currentLevel) {
        if (visited.has(url)) continue;
        if (toFetch.length >= remaining) break;
        visited.add(url);
        toFetch.push(url);
      }

      const capturedDepth = depth;
      const linksPerUrl = await mapWithConcurrency(toFetch, CONCURRENCY, (url) =>
        processUrl(url, capturedDepth, jobId),
      );

      const nextLevel: string[] = [];
      if (depth < maxDepth) {
        for (const links of linksPerUrl) {
          for (const link of links) {
            if (link.startsWith(origin) && !visited.has(link)) {
              nextLevel.push(link);
            }
          }
        }
      }

      currentLevel = nextLevel;
      depth++;
    }

    await prisma.crawlJob.update({
      where: { id: jobId },
      data: { status: CrawlStatus.COMPLETED, completedAt: new Date() },
    });
  } catch (err) {
    try {
      await prisma.crawlJob.update({
        where: { id: jobId },
        data: { status: CrawlStatus.FAILED, completedAt: new Date() },
      });
    } catch (updateErr) {
      console.error(`Failed to persist FAILED status for job ${jobId}:`, updateErr);
    }
    throw err;
  }
}
