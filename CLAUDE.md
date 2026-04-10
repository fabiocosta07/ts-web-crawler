# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A web crawler API that lets authenticated users submit URLs for breadth-first crawling and retrieve structured results. Uses TypeScript (ESM), Express 5, Prisma ORM with PostgreSQL, JWT auth, and Zod v4 for validation. The crawler engine uses `cheerio` for HTML parsing and the native `fetch` API for HTTP requests.

## Commands

- **Dev server:** `npm run dev` (tsx watch, http://localhost:3000)
- **Build:** `npm run build` (tsc -> dist/)
- **Start prod:** `npm run start`
- **DB migrate:** `npm run db:migrate` (Prisma migrate dev)
- **DB seed:** `npm run db:seed`
- **Start Postgres:** `podman-compose up -d` (or `docker-compose up -d`)
- **Run tests:** `npm test` (Vitest + Supertest + Testcontainers)
- **Watch tests:** `npm run test:watch`

## Database

PostgreSQL via `podman-compose.yml`. Connection string set via `DATABASE_URL` env var. Prisma schema at `prisma/schema.prisma`.

Models:
- **User** -- owns crawl jobs, has email/password for auth
- **CrawlJob** -- a crawl request with URL, maxDepth, status (PENDING/RUNNING/COMPLETED/FAILED), timestamps. Belongs to User.
- **CrawlResult** -- a single crawled page with URL, HTTP status, page title, discovered links, depth. Belongs to CrawlJob. Unique on (crawlJobId, url).

## Architecture

- `src/index.ts` -- Thin entry point, imports app and starts listening.
- `src/app.ts` -- Express app setup, middleware, route mounting. Serves OpenAPI spec at `/swagger` and `/api/openapi.json`.
- `src/routes/auth.ts` -- Public signup/login endpoints.
- `src/routes/crawl-jobs.ts` -- Protected CRUD for crawl jobs. POST triggers crawl in the background.
- `src/crawler/engine.ts` -- Breadth-first crawler engine. Fetches pages, extracts links with cheerio, persists results to DB. Stays within the same origin, respects maxDepth.
- `src/middleware/auth.ts` -- JWT verification middleware. Extends Request with `userId` via `AuthRequest` interface.
- `src/lib/prisma.ts` -- Singleton Prisma client.
- `src/openapi.json` -- OpenAPI 3.1 spec loaded at runtime.

## Key Patterns

- Zod v4 imported as `z` from `'zod/v4'` (not `'zod'`).
- Route files export a named Router instance (e.g., `crawlJobsRouter`).
- ESM imports require `.js` extensions in import paths.
- `JWT_SECRET` defaults to `'change-me-in-production'` from env var.
- Crawl jobs are fire-and-forget: POST creates the job and starts crawling in the background. Poll GET /:id to check status.
- The crawler only follows links within the same origin as the start URL.
- CrawlResult has a unique constraint on (crawlJobId, url) to prevent duplicate pages.

## Testing

- **Run tests:** `npm test` (Vitest + Supertest + Testcontainers)
- **Watch mode:** `npm run test:watch`
- Tests live in `src/tests/`, excluded from `tsc` build
- Testcontainers spins up a disposable PostgreSQL container per run
- TRUNCATE between tests for isolation
- Factory functions in `src/tests/helpers/factories.ts`
- Auth helper in `src/tests/helpers/auth.ts` for protected route tests
- Requires podman socket: `systemctl --user start podman.socket`
