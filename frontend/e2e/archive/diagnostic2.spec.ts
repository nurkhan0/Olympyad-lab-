import { test, expect } from '@playwright/test';

test('Diagnostic: Check login flow', async ({ page }) => {
  await page.goto('/login');
  console.log('Login page URL:', page.url());
  const content = await page.content();
  console.log('Login page content length:', content.length);
  console.log('Login page title:', await page.title());
  
  await page.fill('input[name="email"]', 'teacher@test.com');
  await page.fill('input[name="password"]', 'testpass123');
  await page.click('button[type="submit"]');
  
  // Wait a bit and check where we end up
  await page.waitForTimeout(3000);
  console.log('After login URL:', page.url());
  console.log('After login title:', await page.title());
});
