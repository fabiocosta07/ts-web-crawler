import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { useCleanDatabase } from '../helpers/setup.js';
import { authHeader } from '../helpers/auth.js';
import { createUser, createCrawlJob, createCrawlResult } from '../helpers/factories.js';

describe('GET /api/crawl-jobs', () => {
  useCleanDatabase();

  it('should return 401 without auth', async () => {
    const res = await request(app).get('/api/crawl-jobs');
    expect(res.status).toBe(401);
  });

  it('should return crawl jobs for authenticated user', async () => {
    const user = await createUser();
    await createCrawlJob(user.id, { url: 'https://example.com' });
    await createCrawlJob(user.id, { url: 'https://test.com' });

    const res = await request(app)
      .get('/api/crawl-jobs')
      .set(authHeader(user.id));

    expect(res.status).toBe(200);
    expect(res.body.crawlJobs).toHaveLength(2);
    expect(res.body.nextCursor).toBeNull();
  });

  it('should not return other users crawl jobs', async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    await createCrawlJob(user1.id);
    await createCrawlJob(user2.id);

    const res = await request(app)
      .get('/api/crawl-jobs')
      .set(authHeader(user1.id));

    expect(res.status).toBe(200);
    expect(res.body.crawlJobs).toHaveLength(1);
  });
});

describe('GET /api/crawl-jobs/:id', () => {
  useCleanDatabase();

  it('should return 401 without auth', async () => {
    const res = await request(app).get('/api/crawl-jobs/some-id');
    expect(res.status).toBe(401);
  });

  it('should return crawl job with results', async () => {
    const user = await createUser();
    const job = await createCrawlJob(user.id, {
      url: 'https://example.com',
      status: 'COMPLETED',
    });
    await createCrawlResult(job.id, {
      url: 'https://example.com',
      title: 'Example',
      depth: 0,
    });

    const res = await request(app)
      .get(`/api/crawl-jobs/${job.id}`)
      .set(authHeader(user.id));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(job.id);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].title).toBe('Example');
  });

  it('should return 404 for another users job', async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    const job = await createCrawlJob(user1.id);

    const res = await request(app)
      .get(`/api/crawl-jobs/${job.id}`)
      .set(authHeader(user2.id));

    expect(res.status).toBe(404);
  });

  it('should return 404 for non-existent job', async () => {
    const user = await createUser();

    const res = await request(app)
      .get('/api/crawl-jobs/00000000-0000-0000-0000-000000000000')
      .set(authHeader(user.id));

    expect(res.status).toBe(404);
  });
});

describe('POST /api/crawl-jobs', () => {
  useCleanDatabase();

  it('should return 401 without auth', async () => {
    const res = await request(app)
      .post('/api/crawl-jobs')
      .send({ url: 'https://example.com' });

    expect(res.status).toBe(401);
  });

  it('should create a crawl job', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/crawl-jobs')
      .set(authHeader(user.id))
      .send({ url: 'https://example.com', maxDepth: 1 });

    expect(res.status).toBe(201);
    expect(res.body.url).toBe('https://example.com');
    expect(res.body.maxDepth).toBe(1);
    expect(res.body.status).toBe('PENDING');
  });

  it('should reject invalid URL', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/crawl-jobs')
      .set(authHeader(user.id))
      .send({ url: 'not-a-url' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid input');
  });

  it('should reject maxDepth above 5', async () => {
    const user = await createUser();

    const res = await request(app)
      .post('/api/crawl-jobs')
      .set(authHeader(user.id))
      .send({ url: 'https://example.com', maxDepth: 10 });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/crawl-jobs/:id', () => {
  useCleanDatabase();

  it('should return 401 without auth', async () => {
    const res = await request(app).delete('/api/crawl-jobs/some-id');
    expect(res.status).toBe(401);
  });

  it('should delete a crawl job', async () => {
    const user = await createUser();
    const job = await createCrawlJob(user.id);

    const res = await request(app)
      .delete(`/api/crawl-jobs/${job.id}`)
      .set(authHeader(user.id));

    expect(res.status).toBe(204);
  });

  it('should return 404 for another users job', async () => {
    const user1 = await createUser();
    const user2 = await createUser();
    const job = await createCrawlJob(user1.id);

    const res = await request(app)
      .delete(`/api/crawl-jobs/${job.id}`)
      .set(authHeader(user2.id));

    expect(res.status).toBe(404);
  });

  it('should return 404 for non-existent job', async () => {
    const user = await createUser();

    const res = await request(app)
      .delete('/api/crawl-jobs/00000000-0000-0000-0000-000000000000')
      .set(authHeader(user.id));

    expect(res.status).toBe(404);
  });
});
