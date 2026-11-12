import { test, expect } from '@playwright/test';

test('Diagnostic: Check teacher dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'teacher@test.com');
  await page.fill('input[name="password"]', 'testpass123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*\/problems/);
  await page.goto('/teacher');
  await page.waitForLoadState('networkidle');
  console.log('Teacher page URL:', page.url());
  console.log('Teacher page title:', await page.title());
  const content = await page.content();
  console.log('Teacher page content length:', content.length);
  // Check for button
  const buttons = await page.locator('button').allTextContents();
  console.log('Buttons found:', buttons);
  const links = await page.locator('a').allTextContents();
  console.log('Links found:', links);
});

test('Diagnostic: Check courses page', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'student@test.com');
  await page.fill('input[name="password"]', 'testpass123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*\/problems/);
  await page.goto('/courses');
  await page.waitForLoadState('networkidle');
  console.log('Courses page URL:', page.url());
  const content = await page.content();
  console.log('Courses page content length:', content.length);
  const courseTitles = await page.locator('text=Python для начинающих').count();
  console.log('Course title count:', courseTitles);
  // Check for any course cards
  const cards = await page.locator('article').count();
  console.log('Course cards:', cards);
});

test('Diagnostic: Check teacher contests page', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'teacher@test.com');
  await page.fill('input[name="password"]', 'testpass123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*\/problems/);
  await page.goto('/teacher/contests');
  await page.waitForLoadState('networkidle');
  console.log('Teacher contests page URL:', page.url());
  const content = await page.content();
  console.log('Teacher contests page content length:', content.length);
  const buttons = await page.locator('button').allTextContents();
  console.log('Buttons found:', buttons);
});

test('Diagnostic: Check teacher analytics page', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'teacher@test.com');
  await page.fill('input[name="password"]', 'testpass123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*\/problems/);
  await page.goto('/teacher/courses/1/analytics');
  await page.waitForLoadState('networkidle');
  console.log('Analytics page URL:', page.url());
  const content = await page.content();
  console.log('Analytics page content length:', content.length);
  const texts = await page.locator('body').textContent();
  console.log('Body text preview:', texts?.substring(0, 500));
});
