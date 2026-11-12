import { test, expect } from '@playwright/test';

test('Debug: Capture login response details', async ({ page }) => {
  const allResponses: Array<{ url: string; status: number; statusText: string }> = [];
  const requestFailures: Array<{ url: string; error: string }> = [];

  page.on('response', (response) => {
    allResponses.push({ 
      url: response.url(), 
      status: response.status(), 
      statusText: response.statusText() 
    });
  });

  page.on('requestfailed', (request) => {
    requestFailures.push({ 
      url: request.url(), 
      error: request.failure()?.errorText ?? 'unknown' 
    });
  });

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="email"], input#email, input[type="email"]').first().pressSequentially('teacher@test.com');
  await page.locator('input[name="password"], input#password, input[type="password"]').first().pressSequentially('testpass123');

  await page.click('button[type="submit"]');
  
  // Wait longer and check for network idle multiple times
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  console.log('Final URL:', page.url());
  
  // Check login responses
  const loginResponses = allResponses.filter(r => r.url.includes('/auth/login/'));
  console.log('Login responses:', loginResponses.length);
  loginResponses.forEach(r => console.log('  ', r.status, r.statusText, r.url));

  // Check refresh responses
  const refreshResponses = allResponses.filter(r => r.url.includes('/auth/refresh/'));
  console.log('Refresh responses:', refreshResponses.length);
  refreshResponses.forEach(r => console.log('  ', r.status, r.statusText, r.url));

  // Check failed requests
  console.log('Failed requests:', requestFailures.length);
  requestFailures.forEach(r => console.log('  ', r.url, r.error));

  // Check error message
  const errorElements = await page.locator('.text-red-600, [role="alert"], .error, .bg-red-50').allTextContents();
  console.log('Error messages:', errorElements);

  // Get response body for login if available
  if (loginResponses.length > 0) {
    try {
      const response = await page.waitForResponse(r => r.url().includes('/auth/login/'), { timeout: 5000 });
      const body = await response.json().catch(() => null);
      console.log('Login response body:', JSON.stringify(body, null, 2).substring(0, 500));
    } catch (e) {
      console.log('Could not get response body:', e);
    }
  }

  // Check if axios is even working - try a direct fetch
  const fetchTest = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/v1/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: 'teacher@test.com', password: 'testpass123' })
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, data };
    } catch (e) {
      return { error: String(e) };
    }
  });
  console.log('Direct fetch test:', fetchTest);
});
