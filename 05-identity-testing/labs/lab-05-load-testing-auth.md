# Lab 05: Load Testing Auth Endpoints with k6

## Objective
Load test authentication endpoints to ensure they perform well under realistic traffic and identify breaking points.

## Setup

```bash
# Install k6
# macOS: brew install k6
# Windows: choco install k6
# Linux: https://k6.io/docs/getting-started/installation/
```

## k6 Load Test Script

```javascript
// auth-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const loginFailRate = new Rate('login_failures');
const loginDuration = new Trend('login_duration');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 50 },    // Stay at 50 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests under 500ms
    login_failures: ['rate<0.05'],       // Less than 5% failure rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test login endpoint
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'loadtest@example.com',
    password: 'TestP@ss123!',
  }), { headers: { 'Content-Type': 'application/json' } });

  loginDuration.add(loginRes.timings.duration);
  loginFailRate.add(loginRes.status !== 200);

  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login returns token': (r) => r.json('access_token') !== undefined,
    'login under 500ms': (r) => r.timings.duration < 500,
  });

  if (loginRes.status === 200) {
    const token = loginRes.json('access_token');

    // Test protected endpoint with token
    const profileRes = http.get(`${BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    check(profileRes, {
      'profile status is 200': (r) => r.status === 200,
      'profile under 200ms': (r) => r.timings.duration < 200,
    });
  }

  sleep(1);
}
```

## Run

```bash
k6 run auth-load-test.js
k6 run --env BASE_URL=http://localhost:3000 auth-load-test.js
```

## Validation Checklist
- [ ] Login endpoint handles 50 concurrent users
- [ ] 95th percentile response time under 500ms
- [ ] Failure rate below 5%
- [ ] Token validation endpoint is fast (<200ms)
