// k6 Load Test for Auth Endpoints
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const loginFailRate = new Rate('login_failures');
const loginDuration = new Trend('login_duration');

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    login_failures: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'loadtest@example.com',
    password: 'TestP@ss123!',
  }), { headers: { 'Content-Type': 'application/json' } });

  loginDuration.add(loginRes.timings.duration);
  loginFailRate.add(loginRes.status !== 200);

  check(loginRes, {
    'login returns 200': (r) => r.status === 200,
    'has access_token': (r) => r.json('access_token') !== undefined,
  });

  if (loginRes.status === 200) {
    const token = loginRes.json('access_token');
    const profileRes = http.get(`${BASE_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    check(profileRes, { 'profile returns 200': (r) => r.status === 200 });
  }

  sleep(1);
}
