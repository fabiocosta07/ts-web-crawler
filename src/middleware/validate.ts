import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodType } from 'zod/v4';

export interface ValidatedRequest<T> extends Request {
  validated: T;
}

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid input' });
      return;
    }
    (req as ValidatedRequest<T>).validated = parsed.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid query parameters' });
      return;
    }
    (req as unknown as { validatedQuery: T }).validatedQuery = parsed.data;
    next();
  };
}
