import { app } from './app.js';
import { prisma } from './lib/prisma.js';

const PORT = process.env.PORT ?? 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Swagger UI at http://localhost:${PORT}/swagger`);
});

function shutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down...`);
  server.close(async (err) => {
    if (err) console.error('Error closing server:', err);
    try {
      await prisma.$disconnect();
    } catch (e) {
      console.error('Error disconnecting Prisma:', e);
    }
    process.exit(err ? 1 : 0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
