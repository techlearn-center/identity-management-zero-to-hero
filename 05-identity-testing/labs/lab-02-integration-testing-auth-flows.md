# Lab 02: Integration Testing Auth Flows

## Objective
Write integration tests for complete authentication flows using Supertest against an Express API.

## Setup

```bash
npm install --save-dev supertest jest
```

## Test Suite

```javascript
const request = require('supertest');
const app = require('../server'); // Your Express app

describe('Authentication Flows', () => {
  describe('POST /api/auth/login', () => {
    test('returns 200 and tokens for valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'ValidP@ss123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('access_token');
      expect(res.body).toHaveProperty('refresh_token');
      expect(res.body.token_type).toBe('Bearer');
    });

    test('returns 401 for invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.access_token).toBeUndefined();
    });

    test('returns 429 after too many failed attempts', async () => {
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'wrong' });
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(res.status).toBe(429);
    });
  });

  describe('Protected Routes', () => {
    let accessToken;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'ValidP@ss123' });
      accessToken = res.body.access_token;
    });

    test('allows access with valid token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('test@example.com');
    });

    test('rejects request without token', async () => {
      const res = await request(app).get('/api/users/me');
      expect(res.status).toBe(401);
    });

    test('rejects request with invalid token', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });
});
```

## Validation Checklist
- [ ] Valid login returns tokens
- [ ] Invalid login returns 401
- [ ] Rate limiting works after max attempts
- [ ] Protected routes require valid token
- [ ] Invalid/missing tokens are rejected
