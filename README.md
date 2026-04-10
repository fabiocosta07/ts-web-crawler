# ts-web-crawler

A web crawler API built with TypeScript, Express 5, and Prisma. Submit URLs for breadth-first crawling and retrieve structured results through a REST API with JWT authentication.

## Features

- **JWT Authentication** -- signup/login to get a bearer token
- **Crawl Job Management** -- create, list, view, and delete crawl jobs
- **Breadth-First Crawler** -- crawls pages up to a configurable depth (0-5), staying within the same origin
- **Structured Results** -- stores page title, HTTP status, discovered links, and errors for each crawled page
- **OpenAPI Documentation** -- interactive Swagger UI at `/swagger`

## Quick Start

```bash
# 1. Start PostgreSQL
podman-compose up -d   # or docker-compose up -d

# 2. Run database migrations and seed
npm run db:migrate
npm run db:seed

# 3. Start the dev server
npm run dev
```

The API will be available at http://localhost:3000 and Swagger UI at http://localhost:3000/swagger.

## Usage

```bash
# Sign up
curl -X POST http://localhost:3000/api/signup \
  -H 'Content-Type: application/json' \
  -d '{"email": "user@example.com", "password": "secret123"}'

# Use the returned token for subsequent requests
TOKEN="<token-from-signup>"

# Submit a URL for crawling
curl -X POST http://localhost:3000/api/crawl-jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com", "maxDepth": 2}'

# List your crawl jobs
curl http://localhost:3000/api/crawl-jobs \
  -H "Authorization: Bearer $TOKEN"

# Get crawl job details with results
curl http://localhost:3000/api/crawl-jobs/<job-id> \
  -H "Authorization: Bearer $TOKEN"
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production server |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed the database with sample data |
| `npm test` | Run integration tests (requires Podman/Docker) |
| `npm run test:watch` | Run tests in watch mode |

## Tech Stack

- **Runtime:** Node.js with TypeScript (ESM)
- **Framework:** Express 5
- **Database:** PostgreSQL 17 via Prisma ORM
- **Auth:** JWT (jsonwebtoken + bcryptjs)
- **Validation:** Zod v4
- **HTML Parsing:** cheerio
- **Testing:** Vitest + Supertest + Testcontainers
- **API Docs:** OpenAPI 3.1 + Swagger UI
# ts-web-crawler
