import { test, expect } from '@playwright/test';

test('Debug: Full login flow with diagnostics', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: Array<{ method: string; url: string; error: string }> = [];
  const responses: Array<{ url: string; status: number }> = [];

  // Capture console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  // Capture failed requests
  page.on('requestfailed', (request) => {
    failedRequests.push({
      method: request.method(),
      url: request.url(),
      error: request.failure()?.errorText ?? 'unknown',
    });
  });

  // Capture all responses
  page.on('response', (response) => {
    responses.push({
      url: response.url(),
      status: response.status(),
    });
    if (response.url().includes('/auth/login/')) {
      console.log('[LOGIN RESPONSE]', response.status(), response.url());
    }
  });

  // Navigate to login page
  console.log('Navigating to /login...');
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  console.log('Current URL:', page.url());
  console.log('Page title:', await page.title());

  // Check form elements
  const emailInput = page.locator('input[name="email"], input#email, input[type="email"]').first();
  const passwordInput = page.locator('input[name="password"], input#password, input[type="password"]').first();
  const submitButton = page.locator('button[type="submit"]').first();

  console.log('Email input visible:', await emailInput.isVisible());
  console.log('Password input visible:', await passwordInput.isVisible());
  console.log('Submit button visible:', await submitButton.isVisible());
  console.log('Submit button text:', await submitButton.textContent());
  console.log('Submit button disabled:', await submitButton.isDisabled());

  // Fill form
  console.log('Filling email...');
  await emailInput.fill('teacher@test.com');
  console.log('Filling password...');
  await passwordInput.fill('testpass123');

  // Wait for login response
  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/auth/login/') && response.request().method() === 'POST',
    { timeout: 10000 }
  );

  // Click submit
  console.log('Clicking submit...');
  await submitButton.click();

  // Wait for response
  console.log('Waiting for login response...');
  const loginResponse = await loginResponsePromise;
  console.log('Login response status:', loginResponse.status());
  console.log('Login response URL:', loginResponse.url());
  
  const responseBody = await loginResponse.json().catch(() => ({}));
  console.log('Login response body (sanitized):', {
    ...responseBody,
    access_token: responseBody.access_token ? '[PRESENT]' : '[MISSING]',
    user: responseBody.user ? responseBody.user : '[MISSING]',
  });

  // Wait a bit for navigation
  await page.waitForTimeout(2000);
  console.log('URL after login attempt:', page.url());

  // Check localStorage
  const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
  console.log('localStorage keys:', localStorageKeys);

  // Check cookies
  const cookies = await page.context().cookies();
  console.log('Cookies:', cookies.map(c => ({ name: c.name, domain: c.domain, path: c.path })));

  // Summary
  console.log('\n=== DIAGNOSTIC SUMMARY ===');
  console.log('Console errors:', consoleErrors.length);
  consoleErrors.forEach(e => console.log('  -', e));
  console.log('Page errors:', pageErrors.length);
  pageErrors.forEach(e => console.log('  -', e));
  console.log('Failed requests:', failedRequests.length);
  failedRequests.forEach(r => console.log('  -', r.method, r.url, r.error));
  console.log('All responses:');
  responses.filter(r => r.url.includes('localhost:5173') || r.url.includes('localhost:8000')).forEach(r => {
    console.log('  -', r.status, r.url);
  });

  // Take screenshot
  await page.screenshot({ path: 'test-results/login-debug.png', fullPage: true });
});

test('Debug: Check if axios request is actually sent', async ({ page }) => {
  const requests: Array<{ method: string; url: string; postData: string }> = [];

  page.on('request', (request) => {
    if (request.url().includes('/auth/login/')) {
      requests.push({
        method: request.method(),
        url: request.url(),
        postData: request.postData() || '',
      });
    }
  });

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[name="email"], input#email, input[type="email"]', 'teacher@test.com');
  await page.fill('input[name="password"], input#password, input[type="password"]', 'testpass123');

  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/auth/login/') && response.request().method() === 'POST',
    { timeout: 10000 }
  );

  await page.click('button[type="submit"]');
  await loginResponsePromise;

  console.log('Login requests captured:', requests.length);
  requests.forEach(r => {
    console.log('  Request:', r.method, r.url);
    console.log('  Post data:', r.postData);
  });

  await page.waitForTimeout(1000);
  console.log('Final URL:', page.url());
});
