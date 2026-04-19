import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../lib/config.js';

export function createAuthToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function authHeader(userId: string): { Authorization: string } {
  return { Authorization: `Bearer ${createAuthToken(userId)}` };
}
