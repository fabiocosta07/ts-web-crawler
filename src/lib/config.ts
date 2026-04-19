const envSecret = process.env.JWT_SECRET;

if (!envSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}

export const JWT_SECRET = envSecret ?? 'change-me-in-production';
