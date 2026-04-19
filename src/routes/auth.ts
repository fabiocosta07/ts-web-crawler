import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod/v4';
import { prisma } from '../lib/prisma.js';
import { JWT_SECRET } from '../lib/config.js';
import { validateBody, type ValidatedRequest } from '../middleware/validate.js';

const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

type SignupBody = z.infer<typeof signupSchema>;
type LoginBody = z.infer<typeof loginSchema>;

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

const authLimiter =
  process.env.NODE_ENV === 'test'
    ? (_req: unknown, _res: unknown, next: () => void) => next()
    : rateLimit({
        windowMs: 60_000,
        limit: 10,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { message: 'Too many requests, please try again later' },
      });

export const authRouter = Router();

authRouter.post(
  '/signup',
  authLimiter,
  validateBody(signupSchema),
  async (req, res) => {
    const { email, password } = (req as ValidatedRequest<SignupBody>).validated;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashed } });

    res.status(201).json({ token: signToken(user.id) });
  },
);

authRouter.post(
  '/login',
  authLimiter,
  validateBody(loginSchema),
  async (req, res) => {
    const { email, password } = (req as ValidatedRequest<LoginBody>).validated;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    res.json({ token: signToken(user.id) });
  },
);
