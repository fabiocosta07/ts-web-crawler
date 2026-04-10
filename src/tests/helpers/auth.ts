import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

export function createAuthToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function authHeader(userId: string): { Authorization: string } {
  return { Authorization: `Bearer ${createAuthToken(userId)}` };
}
