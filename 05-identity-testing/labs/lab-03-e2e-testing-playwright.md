# Lab 03: E2E Testing with Playwright

## Objective
Write end-to-end tests for complete authentication flows using Playwright, including login, signup, logout, and protected page access.

## Setup

```bash
npm init playwright@latest
```

## Test Suite

```typescript
// tests/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication E2E', () => {
  test('user can log in and see profile', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('text=Login');

    // Auth0 Universal Login page
    await page.fill('input[name="username"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestP@ss123!');
    await page.click('button[type="submit"]');

    // Wait for redirect back to app
    await page.waitForURL('http://localhost:3000/**');

    // Verify user is logged in
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('protected page redirects unauthenticated users', async ({ page }) => {
    await page.goto('http://localhost:3000/profile');

    // Should redirect to login
    await expect(page).toHaveURL(/auth0.com/);
  });

  test('user can log out', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000');
    await page.click('text=Login');
    await page.fill('input[name="username"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestP@ss123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/**');

    // Logout
    await page.click('text=Logout');
    await expect(page.locator('text=Login')).toBeVisible();
  });
});
```

## Run Tests

```bash
npx playwright test
npx playwright test --headed  # Watch in browser
npx playwright show-report    # View HTML report
```

## Validation Checklist
- [ ] Login flow works end-to-end
- [ ] Protected pages redirect unauthenticated users
- [ ] Logout clears session
- [ ] Tests run headless in CI
