import { test, expect } from '@playwright/test';

test('Debug: Auth state after login', async ({ page }) => {
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  // Fill and submit
  await page.locator('input[name="email"], input#email, input[type="email"]').first().pressSequentially('teacher@test.com');
  await page.locator('input[name="password"], input#password, input[type="password"]').first().pressSequentially('testpass123');
  await page.click('button[type="submit"]');
  
  // Wait for navigation
  await page.waitForURL(/.*\/problems/);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('After login URL:', page.url());
  
  // Check authStore state
  const authState = await page.evaluate(() => {
    // Access zustand store
    const state = window.useAuthStore?.getState?.();
    if (state) {
      return {
        isAuthenticated: state.isAuthenticated,
        isLoading: state.isLoading,
        user: state.user,
        accessToken: state.accessToken ? '[PRESENT]' : '[MISSING]',
      };
    }
    return 'store not accessible';
  });
  console.log('Auth state:', authState);
  
  // Check cookies
  const cookies = await page.context().cookies();
  console.log('Cookies:', cookies.filter(c => c.name.includes('refresh')).map(c => ({ name: c.name, domain: c.domain, path: c.path })));
  
  // Now navigate to teacher page
  await page.goto('/teacher');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('After /teacher URL:', page.url());
  const bodyText = await page.locator('body').textContent();
  console.log('Body text:', bodyText?.substring(0, 1000));
  
  // Check authStore again
  const authState2 = await page.evaluate(() => {
    const state = window.useAuthStore?.getState?.();
    if (state) {
      return {
        isAuthenticated: state.isAuthenticated,
        isLoading: state.isLoading,
        user: state.user,
        accessToken: state.accessToken ? '[PRESENT]' : '[MISSING]',
      };
    }
    return 'store not accessible';
  });
  console.log('Auth state after /teacher:', authState2);
  
  // Print console logs
  console.log('Console logs:');
  consoleLogs.forEach(l => console.log(`  [${l.type}] ${l.text}`));
});

test('Debug: Login response and setAuth', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  
  // Capture login response
  const loginResponsePromise = page.waitForResponse(r => r.url().includes('/auth/login/') && r.request().method() === 'POST');
  
  await page.locator('input[name="email"], input#email, input[type="email"]').first().pressSequentially('teacher@test.com');
  await page.locator('input[name="password"], input#password, input[type="password"]').first().pressSequentially('testpass123');
  await page.click('button[type="submit"]');
  
  const loginResponse = await loginResponsePromise;
  const body = await loginResponse.json().catch(() => ({}));
  console.log('Login response status:', loginResponse.status());
  console.log('Login response body:', JSON.stringify(body, null, 2).substring(0, 500));
  
  // Check if setAuth is called
  await page.waitForTimeout(1000);
  const authState = await page.evaluate(() => {
    const state = window.useAuthStore?.getState?.();
    return state ? {
      isAuthenticated: state.isAuthenticated,
      user: state.user,
      accessToken: state.accessToken ? '[PRESENT]' : '[MISSING]',
    } : 'no store';
  });
  console.log('Auth state after login:', authState);
});
