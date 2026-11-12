import { test, expect } from '@playwright/test';

async function loginAs(page, email, password) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[name="email"], input#email, input[type="email"]').first().pressSequentially(email);
  await page.locator('input[name="password"], input#password, input[type="password"]').first().pressSequentially(password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*\/problems/);
  await page.waitForLoadState('networkidle');
}

test('Diagnostic: Teacher Dashboard', async ({ page }) => {
  await loginAs(page, 'teacher@test.com', 'testpass123');
  await page.goto('/teacher');
  await page.waitForLoadState('networkidle');
  
  console.log('URL:', page.url());
  const content = await page.content();
  
  // Get all button texts
  const buttons = await page.locator('button').allTextContents();
  console.log('Buttons:', buttons);
  
  // Get all link texts
  const links = await page.locator('a').allTextContents();
  console.log('Links:', links);
  
  // Get all text content
  const bodyText = await page.locator('body').textContent();
  console.log('Body text (first 2000 chars):', bodyText?.substring(0, 2000));
});

test('Diagnostic: Courses Page (student)', async ({ page }) => {
  await loginAs(page, 'student@test.com', 'testpass123');
  await page.goto('/courses');
  await page.waitForLoadState('networkidle');
  
  console.log('URL:', page.url());
  
  const bodyText = await page.locator('body').textContent();
  console.log('Body text (first 3000 chars):', bodyText?.substring(0, 3000));
  
  // Check for course cards
  const articles = await page.locator('article').count();
  console.log('Article count:', articles);
  
  const cards = await page.locator('[class*="card"], [class*="course"]').count();
  console.log('Card-like elements:', cards);
});

test('Diagnostic: Teacher Contests Page', async ({ page }) => {
  await loginAs(page, 'teacher@test.com', 'testpass123');
  await page.goto('/teacher/contests');
  await page.waitForLoadState('networkidle');
  
  console.log('URL:', page.url());
  
  const buttons = await page.locator('button').allTextContents();
  console.log('Buttons:', buttons);
  
  const links = await page.locator('a').allTextContents();
  console.log('Links:', links);
  
  const bodyText = await page.locator('body').textContent();
  console.log('Body text (first 2000 chars):', bodyText?.substring(0, 2000));
});

test('Diagnostic: Teacher Analytics Page', async ({ page }) => {
  await loginAs(page, 'teacher@test.com', 'testpass123');
  await page.goto('/teacher/courses/d7717eb0-25f1-4707-a508-076bb04e8701/analytics');
  await page.waitForLoadState('networkidle');
  
  console.log('URL:', page.url());
  
  const bodyText = await page.locator('body').textContent();
  console.log('Body text (first 3000 chars):', bodyText?.substring(0, 3000));
});

test('Diagnostic: Problem Page for Judge Test', async ({ page }) => {
  await loginAs(page, 'student@test.com', 'testpass123');
  // Go to a problem page - need to find a problem first
  await page.goto('/problems');
  await page.waitForLoadState('networkidle');
  
  console.log('Problems page URL:', page.url());
  const bodyText = await page.locator('body').textContent();
  console.log('Problems body text (first 3000 chars):', bodyText?.substring(0, 3000));
  
  // Click first problem
  const problemLinks = page.locator('a[href*="/problems/"]').first();
  if (await problemLinks.count() > 0) {
    await problemLinks.click();
    await page.waitForLoadState('networkidle');
    console.log('Problem page URL:', page.url());
    const problemText = await page.locator('body').textContent();
    console.log('Problem body text (first 3000 chars):', problemText?.substring(0, 3000));
    
    // Check for Monaco editor
    const editor = page.locator('.monaco-editor, [class*="monaco"]');
    console.log('Monaco editor found:', await editor.count());
    
    // Check for submit button
    const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Отправить")');
    console.log('Submit buttons:', await submitBtn.allTextContents());
  }
});
