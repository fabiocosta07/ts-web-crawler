import * as cheerio from 'cheerio';
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

/**
 * Normalise a URL by removing the fragment and trailing slash.
 */
function normalizeUrl(raw: string, base: string): string | null {
  try {
    const url = new URL(raw, base);
    url.hash = '';
    // Remove trailing slash for consistency (except root path)
    let href = url.href;
    if (href.endsWith('/') && url.pathname !== '/') {
      href = href.slice(0, -1);
    }
    return href;
  } catch {
    return null;
  }
}

/**
 * Fetch a single page and extract its title and links.
 */
async function fetchPage(url: string): Promise<Omit<PageResult, 'depth'>> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

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

    const html = await response.text();
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

/**
 * Run a breadth-first crawl starting from the given URL up to maxDepth levels.
 * Results are persisted to the database as they are discovered.
 */
export async function runCrawl({ jobId, startUrl, maxDepth }: CrawlOptions): Promise<void> {
  await prisma.crawlJob.update({
    where: { id: jobId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  const visited = new Set<string>();
  let currentLevel: string[] = [startUrl];
  let depth = 0;

  try {
    while (currentLevel.length > 0 && depth <= maxDepth) {
      const nextLevel: string[] = [];

      for (const url of currentLevel) {
        if (visited.has(url)) continue;
        visited.add(url);

        const page = await fetchPage(url);

        // Persist result (upsert to handle duplicates gracefully)
        await prisma.crawlResult.upsert({
          where: {
            crawlJobId_url: { crawlJobId: jobId, url: page.url },
          },
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

        // Only follow links within the same origin and below maxDepth
        if (depth < maxDepth) {
          const origin = new URL(startUrl).origin;
          for (const link of page.links) {
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
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  } catch (err) {
    await prisma.crawlJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
    });
    throw err;
  }
}
