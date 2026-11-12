/**
 * Shared E2E helpers.
 *
 * Rules enforced here:
 * - Login always happens through the real UI form (no token injection).
 * - No fixed sleeps: every wait targets an API response or visible UI state.
 * - Test-data arrangement may use the REST API (that is setup, not auth bypass).
 */
import { expect, type APIRequestContext, type Page, type Response, request as playwrightRequest } from '@playwright/test';

export const E2E_PASSWORD = 'testpass123';

export const ROLES = {
  teacher: { email: 'teacher@test.com', password: E2E_PASSWORD, destination: /\/teacher/ },
  teacher2: { email: 'teacher2@test.com', password: E2E_PASSWORD, destination: /\/teacher/ },
  student: { email: 'student@test.com', password: E2E_PASSWORD, destination: /\/courses/ },
  student2: { email: 'student2@test.com', password: E2E_PASSWORD, destination: /\/courses/ },
  admin: { email: 'admin@test.com', password: E2E_PASSWORD, destination: /\/admin/ },
} as const;

export type Role = keyof typeof ROLES;

const ROLE_MARKERS: Record<Role, RegExp> = {
  teacher: /Панель преподавателя/,
  teacher2: /Панель преподавателя/,
  student: /Курсы/,
  student2: /Курсы/,
  admin: /Задачи|Admin/,
};

/**
 * Log in through the real form and verify the role-specific destination and
 * marker text. Resolves only when the authenticated page has rendered.
 */
export async function loginAs(page: Page, role: Role): Promise<void> {
  const creds = ROLES[role];

  // Collect course-list API responses so callers can assert authorization.
  const courseResponses: Response[] = [];
  const onResponse = (r: Response) => {
    if (r.url().includes('/api/v1/education/courses/') && r.request().method() === 'GET') {
      courseResponses.push(r);
    }
  };
  page.on('response', onResponse);

  await page.goto('/login');
  const loginResponse = page.waitForResponse(
    (r) => r.url().includes('/auth/login/') && r.request().method() === 'POST',
  );
  await page.locator('input#email').fill(creds.email);
  await page.locator('input#password').fill(creds.password);
  await page.locator('button[type="submit"]').click();
  const response = await loginResponse;
  expect(response.status(), 'login API must succeed').toBe(200);

  await page.waitForURL(creds.destination, { timeout: 20_000 });
  if (role !== 'admin') {
    await expect(page.locator('h1').first()).toContainText(ROLE_MARKERS[role], {
      timeout: 20_000,
    });
    // The landing page fires its course-list query after mount; wait for it so
    // callers can assert authorization deterministically (no fixed sleeps).
    await expect
      .poll(() => courseResponses.length, { timeout: 15_000 })
      .toBeGreaterThan(0);
  }

  page.off('response', onResponse);
  (page as Page & { __courseResponses?: Response[] }).__courseResponses = courseResponses;
}

/** Accept every browser dialog (e.g. the editor's "Сбросить код?" confirm). */
export function acceptDialogs(page: Page): void {
  page.on('dialog', (dialog) => dialog.accept());
}

/** Course-list API responses observed during loginAs — at least one must be authorized. */
export function observedCourseResponses(page: Page): Response[] {
  return (page as Page & { __courseResponses?: Response[] }).__courseResponses ?? [];
}

/** Backend login for API-side test arrangement. Returns the access token. */
export async function apiLogin(
  request: APIRequestContext,
  role: Role,
): Promise<string> {
  const creds = ROLES[role];
  const res = await request.post('/api/v1/auth/login/', {
    data: { email: creds.email, password: E2E_PASSWORD },
  });
  expect(res.status(), 'API login for test arrangement').toBe(200);
  const body = await res.json();
  if (!body.access_token) {
    throw new Error('API login response missing access_token');
  }
  return body.access_token as string;
}

/** Authenticated API request context for test arrangement. */
export async function authedRequest(
  _base: APIRequestContext,
  role: Role,
): Promise<APIRequestContext> {
  // The per-test `request` fixture does not expose newContext(); the module
  // singleton `request` from @playwright/test does.
  const token = await apiLogin(_base, role);
  return playwrightRequest.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Replace the code in the Monaco editor via its model API. Keyboard select-all
 * is unreliable inside Monaco; setting the model value is deterministic and
 * propagates through onChange to the React state.
 */
export async function setMonacoCode(page: Page, code: string): Promise<void> {
  await page.evaluate((src) => {
    const monacoGlobal = (window as unknown as {
      monaco?: { editor: { getModels(): Array<{ setValue(src: string): void }> } };
    }).monaco;
    if (!monacoGlobal?.editor) {
      throw new Error('Monaco is not loaded');
    }
    const models = monacoGlobal.editor.getModels();
    if (!models.length) {
      throw new Error('No Monaco models found');
    }
    models[0].setValue(src);
  }, code);
}

/** Unique suffix so repeated suite runs never produce duplicate test data. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}`;
}

// --- Arrangement helpers (REST API, no UI) ---

/**
 * Create + publish a unique problem with one test case via the admin API.
 * Fresh problems keep "solved" assertions stable across suite re-runs.
 */
export async function createFreshProblem(
  admin: APIRequestContext,
  title: string,
  expectedOutput: string,
): Promise<{ id: string; slug: string; title: string }> {
  const created = await admin.post('/api/v1/admin/problems/', {
    data: {
      title,
      statement: `Output exactly: ${expectedOutput}`,
      difficulty: 'easy',
      time_ms: 1000,
      memory_mb: 256,
    },
  });
  expect(created.status(), 'create problem').toBe(201);
  const problem = (await created.json()) as { id: string; slug: string; title: string };

  const published = await admin.post(`/api/v1/admin/problems/${problem.slug}/publish/`);
  expect(published.status(), 'publish problem').toBeLessThan(300);

  const testCase = await admin.post(`/api/v1/admin/problems/${problem.slug}/tests/`, {
    // input must be non-blank after trimming (DRF CharField trims); solutions
    // for these tasks never read stdin, so the marker value is irrelevant.
    data: { input: '.', expected_output: expectedOutput, is_sample: true, order: 0 },
  });
  expect(testCase.status(), 'add test case').toBe(201);

  return { id: problem.id, slug: problem.slug, title: problem.title };
}

export interface CourseApi {
  id: string;
  title: string;
}

export async function createCourse(
  ctx: APIRequestContext,
  title: string,
  opts: { description?: string; is_published?: boolean } = {},
): Promise<CourseApi> {
  const res = await ctx.post('/api/v1/education/courses/', {
    data: {
      title,
      description: opts.description ?? 'Created by E2E arrangement',
      is_published: opts.is_published ?? false,
    },
  });
  expect(res.status(), 'create course').toBe(201);
  return (await res.json()) as CourseApi;
}

export async function createModule(
  ctx: APIRequestContext,
  courseId: string,
  title: string,
): Promise<{ id: string }> {
  const res = await ctx.post(`/api/v1/education/courses/${courseId}/modules/`, {
    data: { title, order: 0 },
  });
  expect(res.status(), 'create module').toBe(201);
  return (await res.json()) as { id: string };
}

export async function createLesson(
  ctx: APIRequestContext,
  courseId: string,
  moduleId: string,
  title: string,
): Promise<{ id: string }> {
  const res = await ctx.post(
    `/api/v1/education/courses/${courseId}/modules/${moduleId}/lessons/`,
    { data: { title, content: `# ${title}\n\nУчебный материал.`, order: 0, is_published: true } },
  );
  expect(res.status(), 'create lesson').toBe(201);
  return (await res.json()) as { id: string };
}

export async function linkProblem(
  ctx: APIRequestContext,
  courseId: string,
  moduleId: string,
  lessonId: string,
  problemId: string,
  isRequired: boolean,
): Promise<void> {
  const res = await ctx.post(
    `/api/v1/education/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/problems/`,
    { data: { problem: problemId, order: 0, is_required: isRequired } },
  );
  expect(res.status(), 'link problem to lesson').toBe(201);
}

export async function getProblemBySlug(
  ctx: APIRequestContext,
  slug: string,
): Promise<{ id: string; title: string; slug: string }> {
  const res = await ctx.get(`/api/v1/problems/${slug}/`);
  expect(res.status(), `fetch problem ${slug}`).toBe(200);
  return (await res.json()) as { id: string; title: string; slug: string };
}

export interface ContestApi {
  id: number;
  title: string;
}

export async function createContest(
  ctx: APIRequestContext,
  title: string,
  startInMinutes = 0,
): Promise<ContestApi> {
  const start = new Date(Date.now() + startInMinutes * 60_000);
  const res = await ctx.post('/api/v1/contests/contests/', {
    data: {
      title,
      description: 'Created by E2E arrangement',
      contest_type: 'CF',
      start_time: start.toISOString(),
      duration_minutes: 120,
      is_public: true,
      is_published: false,
      is_rated: false,
    },
  });
  expect(res.status(), 'create contest').toBe(201);
  return (await res.json()) as ContestApi;
}

export async function addContestProblem(
  ctx: APIRequestContext,
  contestId: number,
  problemId: string,
  label: string,
  points: number,
): Promise<void> {
  const res = await ctx.post(`/api/v1/contests/contests/${contestId}/add_problem/`, {
    data: { problem: problemId, label, order: 0, points },
  });
  expect(res.status(), 'add contest problem').toBe(201);
}

export async function setContestPublish(
  ctx: APIRequestContext,
  contestId: number,
  published: boolean,
): Promise<void> {
  const action = published ? 'publish' : 'unpublish';
  const res = await ctx.post(`/api/v1/contests/contests/${contestId}/${action}/`);
  expect(res.status(), `${action} contest`).toBe(200);
}

export async function setContestStartTime(
  ctx: APIRequestContext,
  contestId: number,
  startTime: Date,
): Promise<void> {
  const res = await ctx.patch(`/api/v1/contests/contests/${contestId}/`, {
    data: { start_time: startTime.toISOString() },
  });
  expect(res.status(), 'patch contest start_time').toBe(200);
}

export async function registerStudentForContest(
  ctx: APIRequestContext,
  contestId: number,
): Promise<void> {
  const res = await ctx.post(`/api/v1/contests/contests/${contestId}/register/`);
  expect(res.status(), 'student contest registration').toBe(201);
}

/**
 * Wait for a submission's final verdict through the REST API.
 * The judge is asynchronous (Celery worker), so poll the persisted record.
 */
export async function waitForVerdict(
  ctx: APIRequestContext,
  submissionId: number,
  timeoutMs = 45_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastBody: { status?: string; verdict?: string | null } = {};
  while (Date.now() < deadline) {
    const res = await ctx.get(`/api/v1/submissions/${submissionId}/`);
    if (res.status() === 200) {
      lastBody = (await res.json()) as { status?: string; verdict?: string | null };
      if (lastBody.status === 'done' || lastBody.status === 'error') {
        return lastBody.verdict ?? 'error';
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Submission ${submissionId} did not reach a final verdict: ${JSON.stringify(lastBody)}`);
}

/** Submit code and wait for the final persisted verdict. */
export async function submitAndWaitVerdict(
  ctx: APIRequestContext,
  problemId: string,
  code: string,
  language: 'python' | 'cpp' | 'java' = 'python',
  contestId?: number,
): Promise<string> {
  const res = await ctx.post('/api/v1/submissions/', {
    data: contestId
      ? { problem: problemId, code, language, contest_id: contestId }
      : { problem: problemId, code, language },
  });
  expect(res.status(), 'create submission').toBe(201);
  const body = (await res.json()) as { id: number };
  return waitForVerdict(ctx, body.id);
}
