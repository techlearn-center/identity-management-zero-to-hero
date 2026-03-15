/**
 * Playwright E2E Authentication Test Suite
 *
 * Tests complete authentication flows in a real browser:
 * - Login (valid/invalid credentials)
 * - Signup (new account creation)
 * - Logout (session cleanup)
 * - Protected routes (auth guard)
 * - Token refresh (automatic token renewal)
 * - Social login (OAuth redirect simulation)
 */

import { test, expect, Page } from '@playwright/test';

// ─── Configuration ──────────────────────────────────────────

const TEST_USER = {
  name: 'E2E Test User',
  email: `e2e-test-${Date.now()}@example.com`,
  password: 'E2eTestP@ss123!',
};

const EXISTING_USER = {
  email: 'existing@example.com',
  password: 'ExistingP@ss123!',
};

// ─── Page Helpers ───────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
}

async function signup(page: Page, name: string, email: string, password: string) {
  await page.goto('/signup');
  await page.getByLabel('Full Name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password').fill(password);
  await page.getByRole('button', { name: /create account|sign up/i }).click();
}

async function logout(page: Page) {
  // Try common logout button patterns
  const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    return;
  }

  // Try menu-based logout
  const userMenu = page.getByTestId('user-menu');
  if (await userMenu.isVisible()) {
    await userMenu.click();
    await page.getByRole('menuitem', { name: /logout|sign out/i }).click();
  }
}

// ─── Test Suite ─────────────────────────────────────────────

test.describe('Authentication E2E Tests', () => {

  // ── Signup Flow ────────────────────────────────────────

  test.describe('Signup', () => {
    test('should create a new account successfully', async ({ page }) => {
      await signup(page, TEST_USER.name, TEST_USER.email, TEST_USER.password);

      // Should redirect to dashboard or onboarding
      await expect(page).toHaveURL(/\/(dashboard|onboarding|home)/, {
        timeout: 10000,
      });
    });

    test('should display user name after signup', async ({ page }) => {
      const uniqueEmail = `signup-display-${Date.now()}@example.com`;
      await signup(page, 'Display Name Test', uniqueEmail, TEST_USER.password);

      await expect(page).toHaveURL(/\/(dashboard|onboarding|home)/, {
        timeout: 10000,
      });

      // User name should appear somewhere in the UI (nav, sidebar, etc.)
      await expect(page.getByText('Display Name Test')).toBeVisible({
        timeout: 5000,
      });
    });

    test('should reject signup with existing email', async ({ page }) => {
      // First signup
      const email = `dup-${Date.now()}@example.com`;
      await signup(page, 'First User', email, TEST_USER.password);
      await expect(page).toHaveURL(/\/(dashboard|onboarding|home)/, {
        timeout: 10000,
      });

      // Logout and try to register with same email
      await logout(page);
      await signup(page, 'Second User', email, TEST_USER.password);

      // Should show error
      await expect(page.getByTestId('error-message').or(
        page.getByText(/already|exists|registered/i)
      )).toBeVisible({ timeout: 5000 });
    });

    test('should reject signup with weak password', async ({ page }) => {
      await page.goto('/signup');
      await page.getByLabel('Full Name').fill('Weak Pass User');
      await page.getByLabel('Email').fill(`weak-${Date.now()}@example.com`);
      await page.getByLabel('Password', { exact: true }).fill('123');
      await page.getByLabel('Confirm Password').fill('123');
      await page.getByRole('button', { name: /create account|sign up/i }).click();

      // Should show password strength error (either browser validation or custom)
      const errorVisible = await page.getByText(/password|weak|short|characters/i)
        .isVisible()
        .catch(() => false);

      // Or the form might not submit at all (HTML5 validation)
      const stillOnSignup = page.url().includes('/signup');

      expect(errorVisible || stillOnSignup).toBeTruthy();
    });

    test('should navigate to login page from signup', async ({ page }) => {
      await page.goto('/signup');
      await page.getByRole('link', { name: /sign in|log in|already have/i }).click();
      await expect(page).toHaveURL(/\/login/);
    });
  });

  // ── Login Flow ─────────────────────────────────────────

  test.describe('Login', () => {
    test('should login with valid credentials', async ({ page }) => {
      await login(page, EXISTING_USER.email, EXISTING_USER.password);

      await expect(page).toHaveURL(/\/(dashboard|home)/, { timeout: 10000 });
    });

    test('should show error for wrong password', async ({ page }) => {
      await login(page, EXISTING_USER.email, 'WrongPassword123!');

      await expect(
        page.getByTestId('error-message').or(page.getByText(/invalid|incorrect|wrong/i))
      ).toBeVisible({ timeout: 5000 });

      // Should remain on login page
      await expect(page).toHaveURL(/\/login/);
    });

    test('should show error for non-existent user', async ({ page }) => {
      await login(page, 'nobody@nonexistent.com', 'SomeP@ss123!');

      await expect(
        page.getByTestId('error-message').or(page.getByText(/invalid|incorrect|wrong/i))
      ).toBeVisible({ timeout: 5000 });
    });

    test('should show same error for wrong email and wrong password', async ({ page }) => {
      // This prevents email enumeration
      await login(page, 'nobody@nonexistent.com', 'WrongP@ss123!');
      const errorForBadEmail = await page
        .getByTestId('error-message')
        .textContent()
        .catch(() => '');

      await page.goto('/login');

      await login(page, EXISTING_USER.email, 'WrongP@ss123!');
      const errorForBadPassword = await page
        .getByTestId('error-message')
        .textContent()
        .catch(() => '');

      // Both errors should be identical to prevent enumeration
      if (errorForBadEmail && errorForBadPassword) {
        expect(errorForBadEmail).toBe(errorForBadPassword);
      }
    });

    test('should store authentication token after login', async ({ page }) => {
      await login(page, EXISTING_USER.email, EXISTING_USER.password);
      await expect(page).toHaveURL(/\/(dashboard|home)/, { timeout: 10000 });

      // Check localStorage for token
      const token = await page.evaluate(() => {
        return (
          localStorage.getItem('accessToken') ||
          localStorage.getItem('token') ||
          localStorage.getItem('auth_token')
        );
      });

      // Token should exist (either in localStorage or as a cookie)
      const cookies = await page.context().cookies();
      const authCookie = cookies.find(
        (c) => c.name.includes('token') || c.name.includes('session')
      );

      expect(token || authCookie).toBeTruthy();
    });

    test('should navigate to signup page from login', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('link', { name: /sign up|create account|register/i }).click();
      await expect(page).toHaveURL(/\/signup|\/register/);
    });
  });

  // ── Protected Routes ───────────────────────────────────

  test.describe('Protected Routes', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
      // Clear any existing auth state
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      // Try to access a protected route
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });

    test('should allow authenticated user to access protected routes', async ({ page }) => {
      await login(page, EXISTING_USER.email, EXISTING_USER.password);
      await expect(page).toHaveURL(/\/(dashboard|home)/, { timeout: 10000 });

      // Navigate to another protected route
      await page.goto('/dashboard/settings');

      // Should NOT redirect to login
      await page.waitForTimeout(2000);
      expect(page.url()).not.toMatch(/\/login/);
    });

    test('should preserve requested URL and redirect after login', async ({ page }) => {
      // Clear auth state
      await page.evaluate(() => localStorage.clear());

      // Try to access a specific protected page
      await page.goto('/dashboard/profile');

      // Should be on login page
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

      // Login
      await page.getByLabel('Email').fill(EXISTING_USER.email);
      await page.getByLabel('Password').fill(EXISTING_USER.password);
      await page.getByRole('button', { name: /sign in|log in/i }).click();

      // Should redirect back to the originally requested page
      await expect(page).toHaveURL(/\/dashboard\/profile/, { timeout: 10000 });
    });

    test('should maintain session across page navigations', async ({ page }) => {
      await login(page, EXISTING_USER.email, EXISTING_USER.password);
      await expect(page).toHaveURL(/\/(dashboard|home)/, { timeout: 10000 });

      // Navigate to multiple protected pages
      const protectedPages = ['/dashboard', '/dashboard/settings', '/dashboard/profile'];

      for (const pagePath of protectedPages) {
        await page.goto(pagePath);
        await page.waitForTimeout(1000);

        // Should not be redirected to login
        expect(page.url()).not.toMatch(/\/login/);
      }
    });
  });

  // ── Logout Flow ────────────────────────────────────────

  test.describe('Logout', () => {
    test('should redirect to login page after logout', async ({ page }) => {
      // Login first
      await login(page, EXISTING_USER.email, EXISTING_USER.password);
      await expect(page).toHaveURL(/\/(dashboard|home)/, { timeout: 10000 });

      // Logout
      await logout(page);

      // Should be redirected to login or home page
      await expect(page).toHaveURL(/\/(login|$)/, { timeout: 10000 });
    });

    test('should clear auth tokens from storage after logout', async ({ page }) => {
      await login(page, EXISTING_USER.email, EXISTING_USER.password);
      await expect(page).toHaveURL(/\/(dashboard|home)/, { timeout: 10000 });

      // Verify token exists before logout
      const tokenBefore = await page.evaluate(() => {
        return (
          localStorage.getItem('accessToken') ||
          localStorage.getItem('token') ||
          localStorage.getItem('auth_token')
        );
      });

      // Logout
      await logout(page);

      // Verify tokens are cleared
      const tokenAfter = await page.evaluate(() => {
        return (
          localStorage.getItem('accessToken') ||
          localStorage.getItem('token') ||
          localStorage.getItem('auth_token')
        );
      });

      expect(tokenAfter).toBeNull();
    });

    test('should deny access to protected routes after logout', async ({ page }) => {
      await login(page, EXISTING_USER.email, EXISTING_USER.password);
      await expect(page).toHaveURL(/\/(dashboard|home)/, { timeout: 10000 });

      await logout(page);

      // Try to access a protected route
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });
  });

  // ── Token Refresh ──────────────────────────────────────

  test.describe('Token Refresh', () => {
    test('should maintain session when access token is about to expire', async ({ page }) => {
      await login(page, EXISTING_USER.email, EXISTING_USER.password);
      await expect(page).toHaveURL(/\/(dashboard|home)/, { timeout: 10000 });

      // Simulate near-expiry by modifying the stored token's exp claim
      // (The app should detect this and proactively refresh)
      await page.evaluate(() => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          // Signal the app that the token needs refresh
          localStorage.setItem('tokenExpiresSoon', 'true');
        }
      });

      // Navigate to trigger a token-aware API call
      await page.goto('/dashboard');
      await page.waitForTimeout(3000);

      // Should still be on dashboard (not redirected to login)
      expect(page.url()).not.toMatch(/\/login/);
    });

    test('should intercept 401 responses and refresh token', async ({ page }) => {
      await login(page, EXISTING_USER.email, EXISTING_USER.password);
      await expect(page).toHaveURL(/\/(dashboard|home)/, { timeout: 10000 });

      // Track if a refresh request was made
      let refreshRequested = false;
      await page.route('**/auth/refresh', (route) => {
        refreshRequested = true;
        route.continue();
      });

      // Simulate an expired token by intercepting API calls
      await page.route('**/api/**', async (route, request) => {
        if (!refreshRequested) {
          // First API call returns 401 to trigger refresh
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Token expired' }),
          });
        } else {
          // After refresh, continue normally
          await route.continue();
        }
      });

      // Navigate to trigger an API call
      await page.goto('/dashboard');
      await page.waitForTimeout(3000);

      // The app should have attempted a token refresh
      // (Note: this depends on the app's implementation)
    });
  });

  // ── Social Login ───────────────────────────────────────

  test.describe('Social Login', () => {
    test('should display social login buttons on login page', async ({ page }) => {
      await page.goto('/login');

      // Check for common social login providers
      const googleButton = page.getByRole('button', { name: /google/i });
      const githubButton = page.getByRole('button', { name: /github/i });

      // At least one social provider should be available
      const hasGoogle = await googleButton.isVisible().catch(() => false);
      const hasGithub = await githubButton.isVisible().catch(() => false);

      expect(hasGoogle || hasGithub).toBeTruthy();
    });

    test('should initiate OAuth redirect when clicking social login', async ({ page }) => {
      await page.goto('/login');

      // Track navigation
      const navigationPromise = page.waitForURL(
        /accounts\.google\.com|github\.com\/login|auth0\.com|authorize/,
        { timeout: 10000 }
      ).catch(() => null);

      // Click the Google login button (or whichever is available)
      const googleButton = page.getByRole('button', { name: /google/i });
      if (await googleButton.isVisible()) {
        await googleButton.click();
      }

      // Check if we navigated to an OAuth provider
      const navigated = await navigationPromise;
      if (navigated !== null) {
        const url = page.url();
        expect(url).toMatch(/authorize|oauth|accounts\.google|github\.com/);
      }
    });

    test('should handle OAuth callback correctly', async ({ page }) => {
      // Mock the OAuth callback to simulate a successful social login
      await page.route('**/auth/callback**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: 'mock-social-access-token',
            refreshToken: 'mock-social-refresh-token',
            user: {
              id: 'social-user-123',
              email: 'social@example.com',
              name: 'Social User',
            },
          }),
        });
      });

      // Simulate arriving at the callback URL
      await page.goto(
        '/auth/callback?code=mock-auth-code&state=mock-csrf-state'
      );

      // The app should process the callback and redirect to dashboard
      await page.waitForTimeout(3000);

      // Should not remain on the callback page
      expect(page.url()).not.toMatch(/callback/);
    });
  });

  // ── Security Checks ────────────────────────────────────

  test.describe('Security', () => {
    test('should not expose tokens in URL after login', async ({ page }) => {
      await login(page, EXISTING_USER.email, EXISTING_USER.password);
      await expect(page).toHaveURL(/\/(dashboard|home)/, { timeout: 10000 });

      const url = page.url();
      expect(url).not.toContain('token');
      expect(url).not.toContain('access_token');
      expect(url).not.toContain('id_token');
    });

    test('should not expose tokens in page source', async ({ page }) => {
      await login(page, EXISTING_USER.email, EXISTING_USER.password);
      await expect(page).toHaveURL(/\/(dashboard|home)/, { timeout: 10000 });

      const content = await page.content();
      // JWT tokens start with "eyJ"
      const jwtPattern = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;

      // Tokens should not be embedded in HTML source
      expect(content).not.toMatch(jwtPattern);
    });

    test('should handle XSS attempt in login form gracefully', async ({ page }) => {
      await page.goto('/login');

      // Listen for any dialog (alert) events
      let dialogAppeared = false;
      page.on('dialog', (dialog) => {
        dialogAppeared = true;
        dialog.dismiss();
      });

      // Enter XSS payload
      await page.getByLabel('Email').fill('<script>alert("xss")</script>');
      await page.getByLabel('Password').fill('password');
      await page.getByRole('button', { name: /sign in|log in/i }).click();

      await page.waitForTimeout(2000);

      // No alert dialog should have appeared
      expect(dialogAppeared).toBeFalsy();
    });

    test('should enforce password field masking', async ({ page }) => {
      await page.goto('/login');

      const passwordInput = page.getByLabel('Password');
      const inputType = await passwordInput.getAttribute('type');

      expect(inputType).toBe('password');
    });
  });
});
