import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../app.js';
import { useCleanDatabase } from '../helpers/setup.js';
import { createUser } from '../helpers/factories.js';

describe('POST /api/signup', () => {
  useCleanDatabase();

  it('should create a user and return a token', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({ email: 'new@test.com', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  it('should reject duplicate email', async () => {
    await createUser({ email: 'dupe@test.com' });

    const res = await request(app)
      .post('/api/signup')
      .send({ email: 'dupe@test.com', password: 'secret123' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email already in use');
  });

  it('should reject invalid input', async () => {
    const res = await request(app)
      .post('/api/signup')
      .send({ email: 'not-an-email', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid input');
  });
});

describe('POST /api/login', () => {
  useCleanDatabase();

  it('should return a token for valid credentials', async () => {
    await createUser({ email: 'login@test.com', password: 'secret123' });

    const res = await request(app)
      .post('/api/login')
      .send({ email: 'login@test.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('should reject wrong password', async () => {
    await createUser({ email: 'wrong@test.com', password: 'correct' });

    const res = await request(app)
      .post('/api/login')
      .send({ email: 'wrong@test.com', password: 'incorrect' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('should reject non-existent user', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ email: 'ghost@test.com', password: 'any' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });
});
