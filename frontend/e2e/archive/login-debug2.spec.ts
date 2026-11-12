import { test, expect } from '@playwright/test';

test('Debug: Check form submission behavior', async ({ page }) => {
  const allRequests: Array<{ method: string; url: string }> = [];
  const allResponses: Array<{ url: string; status: number }> = [];

  page.on('request', (request) => {
    allRequests.push({ method: request.method(), url: request.url() });
  });

  page.on('response', (response) => {
    allResponses.push({ url: response.url(), status: response.status() });
  });

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  console.log('=== Before fill ===');
  console.log('URL:', page.url());

  // Fill form using keyboard to trigger React events
  await page.locator('input[name="email"], input#email, input[type="email"]').first().pressSequentially('teacher@test.com');
  await page.locator('input[name="password"], input#password, input[type="password"]').first().pressSequentially('testpass123');

  console.log('=== After fill, before click ===');
  
  // Click and wait for ANY navigation or request
  await page.click('button[type="submit"]');
  
  // Wait for either navigation or network idle
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('=== After click ===');
  console.log('Final URL:', page.url());
  
  // Check for any login-related requests
  const loginRequests = allRequests.filter(r => r.url.includes('/auth/login/'));
  console.log('Login requests:', loginRequests.length);
  loginRequests.forEach(r => console.log('  ', r.method, r.url));

  const loginResponses = allResponses.filter(r => r.url.includes('/auth/login/'));
  console.log('Login responses:', loginResponses.length);
  loginResponses.forEach(r => console.log('  ', r.status, r.url));

  // Check all requests to API
  const apiRequests = allRequests.filter(r => r.url.includes('/api/'));
  console.log('All API requests:', apiRequests.length);
  apiRequests.forEach(r => console.log('  ', r.method, r.url));

  // Check for form validation errors
  const errorElements = await page.locator('.text-red-600, [role="alert"], .error').allTextContents();
  console.log('Error messages:', errorElements);

  // Check if still on login page
  const isOnLogin = page.url().includes('/login');
  console.log('Still on login page:', isOnLogin);

  // Check submit button state after click
  const submitButton = page.locator('button[type="submit"]').first();
  console.log('Button disabled after:', await submitButton.isDisabled());
  console.log('Button text after:', await submitButton.textContent());

  // Check localStorage
  const localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
  console.log('localStorage keys:', localStorageKeys);

  // Screenshot
  await page.screenshot({ path: 'test-results/login-debug2.png', fullPage: true });
});

test('Debug: Try pressing Enter to submit', async ({ page }) => {
  const allRequests: Array<{ method: string; url: string }> = [];

  page.on('request', (request) => {
    allRequests.push({ method: request.method(), url: request.url() });
  });

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="email"], input#email, input[type="email"]').first().pressSequentially('teacher@test.com');
  await page.locator('input[name="password"], input#password, input[type="password"]').first().pressSequentially('testpass123');

  // Press Enter in password field
  await page.locator('input[name="password"], input#password, input[type="password"]').first().press('Enter');

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('Final URL:', page.url());
  
  const loginRequests = allRequests.filter(r => r.url.includes('/auth/login/'));
  console.log('Login requests:', loginRequests.length);
  loginRequests.forEach(r => console.log('  ', r.method, r.url));
});
