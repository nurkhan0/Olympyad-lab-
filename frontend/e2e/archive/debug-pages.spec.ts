import { test, expect } from '@playwright/test';

async function login(page, email, password) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[name="email"], input#email, input[type="email"]').first().pressSequentially(email);
  await page.locator('input[name="password"], input#password, input[type="password"]').first().pressSequentially(password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*\/problems/);
  await page.waitForLoadState('networkidle');
}

test('Debug: Teacher Dashboard with longer wait', async ({ page }) => {
  await login(page, 'teacher@test.com', 'testpass123');
  await page.goto('/teacher');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000); // Wait for React Query
  
  console.log('URL:', page.url());
  const bodyText = await page.locator('body').textContent();
  console.log('Body text:', bodyText?.substring(0, 3000));
  
  // Check all buttons
  const buttons = await page.locator('button').allTextContents();
  console.log('Buttons:', buttons);
  
  // Check for the create course button specifically
  const createBtn = page.locator('button:has-text("Создать курс")');
  console.log('Create course button count:', await createBtn.count());
  if (await createBtn.count() > 0) {
    console.log('Create course button visible:', await createBtn.first().isVisible());
  }
});

test('Debug: Courses Page student with longer wait', async ({ page }) => {
  await login(page, 'student@test.com', 'testpass123');
  await page.goto('/courses');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000); // Wait for React Query
  
  console.log('URL:', page.url());
  const bodyText = await page.locator('body').textContent();
  console.log('Body text:', bodyText?.substring(0, 3000));
  
  // Check for course cards
  const articles = await page.locator('article').count();
  console.log('Article count:', articles);
  
  // Check network requests
  const responses = [];
  page.on('response', r => {
    if (r.url().includes('/education/courses/')) {
      responses.push({ status: r.status(), url: r.url() });
    }
  });
  
  // Wait a bit more
  await page.waitForTimeout(2000);
  
  console.log('Course API responses:', responses);
});

test('Debug: Teacher Contests with longer wait', async ({ page }) => {
  await login(page, 'teacher@test.com', 'testpass123');
  await page.goto('/teacher/contests');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  console.log('URL:', page.url());
  const bodyText = await page.locator('body').textContent();
  console.log('Body text:', bodyText?.substring(0, 3000));
  
  const createBtn = page.locator('button:has-text("+ Создать контест")');
  console.log('Create contest button count:', await createBtn.count());
  if (await createBtn.count() > 0) {
    console.log('Create contest button visible:', await createBtn.first().isVisible());
  }
});

test('Debug: Judge verdict display', async ({ page }) => {
  await login(page, 'student@test.com', 'testpass123');
  await page.goto('/problems/hello-world');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  console.log('URL:', page.url());
  const bodyText = await page.locator('body').textContent();
  console.log('Body text:', bodyText?.substring(0, 3000));
  
  // Check for Monaco editor
  const editor = page.locator('.monaco-editor').first();
  console.log('Monaco editor visible:', await editor.isVisible());
  
  // Submit wrong code
  await editor.click();
  await page.keyboard.type('def solve():\n    print("Wrong")\n\nsolve()');
  await page.click('button:has-text("Submit ↵ Ctrl+Enter")');
  
  // Wait for submission to complete
  await page.waitForTimeout(10000);
  
  const bodyTextAfter = await page.locator('body').textContent();
  console.log('Body text after submit:', bodyTextAfter?.substring(0, 3000));
  
  // Check for verdict
  const verdicts = await page.locator('text=Accepted, text=Wrong Answer, text=Compilation Error, text=Time Limit, text=Memory Limit, text=Runtime Error').allTextContents();
  console.log('Verdicts found:', verdicts);
});
