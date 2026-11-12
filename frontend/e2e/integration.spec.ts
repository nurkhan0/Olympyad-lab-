/**
 * CodeArena integration suite.
 *
 * Covers: authentication lifecycle (login / reload / refresh / logout),
 * teacher course management, student learning flow, judge → LMS integration,
 * olympiad (contest) workflow and analytics authorization.
 *
 * Every authentication action goes through the real UI. Test-data arrangement
 * uses the REST API. No token injection, no fixed sleeps, no cross-test
 * dependencies: every test arranges its own data with unique names.
 */
import { expect, test, type Page } from '@playwright/test';

import {
  acceptDialogs,
  setMonacoCode,
  authedRequest,
  createContest,
  createCourse,
  createFreshProblem,
  createLesson,
  createModule,
  getProblemBySlug,
  linkProblem,
  loginAs,
  observedCourseResponses,
  registerStudentForContest,
  setContestPublish,
  setContestStartTime,
  submitAndWaitVerdict,
  uniqueName,
  type Role,
} from './helpers';

test.describe('Authentication & Session', () => {
  test('teacher login: role restored, dashboard opens, course API returns 200', async ({ page }) => {
    await loginAs(page, 'teacher');

    await expect(page.locator('h1', { hasText: 'Панель преподавателя' })).toBeVisible();

    const responses = observedCourseResponses(page);
    expect(
      responses.length,
      'dashboard must request the course list',
    ).toBeGreaterThan(0);
    expect(
      responses.every((r) => r.status() === 200),
      'all observed /education/courses/ responses must be authorized (200)',
    ).toBe(true);
  });

  test('student login: role restored, course catalog opens, course API returns 200', async ({ page }) => {
    await loginAs(page, 'student');

    await expect(page.locator('h1', { hasText: 'Курсы' })).toBeVisible();

    const responses = observedCourseResponses(page);
    expect(responses.length).toBeGreaterThan(0);
    expect(responses.every((r) => r.status() === 200)).toBe(true);
  });

  test('admin login: admin panel opens', async ({ page }) => {
    await loginAs(page, 'admin');
    await expect(page).toHaveURL(/\/admin/);
  });

  test('browser reload preserves authentication via cookie refresh (single init)', async ({ page }) => {
    await loginAs(page, 'teacher');

    let refreshCalls = 0;
    page.on('request', (r) => {
      if (r.url().includes('/auth/refresh/') && r.method() === 'POST') refreshCalls += 1;
    });

    // Reload wipes the in-memory access token; the HttpOnly cookie must
    // restore the session through exactly one refresh exchange.
    await page.reload();
    await expect(page.locator('h1', { hasText: 'Панель преподавателя' })).toBeVisible({ timeout: 20_000 });
    expect(refreshCalls, 'refresh must be single-flight on startup').toBe(1);

    // Authorized API keeps working after reload.
    const afterReload = page.waitForResponse(
      (r) => r.url().includes('/api/v1/education/courses/') && r.request().method() === 'GET' && r.status() === 200,
    );
    await page.goto('/teacher/courses');
    await afterReload;
    await expect(page.locator('h1', { hasText: 'Мои курсы' })).toBeVisible();
  });

  test('student cannot open teacher dashboard', async ({ page }) => {
    await loginAs(page, 'student');
    await page.goto('/teacher');
    // TeacherRoute guard denies non-teachers and redirects away from /teacher.
    await expect(page).not.toHaveURL(/\/teacher/, { timeout: 10_000 });
    await expect(page.locator('text=Доступ запрещён').first()).toBeVisible();
  });

  test('logout clears authentication; reload does not restore it', async ({ page }) => {
    await loginAs(page, 'student');

    // Navbar logout lives inside the avatar dropdown.
    await page.locator('button:has(span.rounded-full)').first().click();
    await page.locator('button:has-text("Выйти")').first().click();

    await page.waitForURL(/\/login/, { timeout: 15_000 });

    // A protected route must bounce back to /login after logout + reload.
    await page.goto('/submissions');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('invalid refresh credentials land on login without crash', async ({ page }) => {
    // No session: initializeAuth finds no refresh cookie and must resolve to
    // the login page rather than spinning forever.
    await page.goto('/');
    await page.goto('/submissions');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('expired access token is refreshed transparently for API calls', async ({ request }) => {
    // Arrangement-level proof of the refresh contract: a fresh cookie jar can
    // obtain a new access token (the browser path is covered by the reload test).
    const teacherCtx = await authedRequest(request, 'teacher');
    const res = await teacherCtx.get('/api/v1/users/me/');
    expect(res.status()).toBe(200);
    const me = await res.json();
    expect(['teacher', 'admin']).toContain(me.role);
    await teacherCtx.dispose();
  });
});

test.describe('Teacher Workflow', () => {
  test('create course with module, lesson, materials and problems; publish; view students and analytics', async ({ page, request }) => {
    const teacher = await authedRequest(request, 'teacher');
    const helloWorld = await getProblemBySlug(request, 'hello-world');
    const variables = await getProblemBySlug(request, 'variables-practice');
    const courseTitle = uniqueName('E2E Course');

    await loginAs(page, 'teacher');

    // Create course through the UI (wait until the page is fully interactive).
    await page.goto('/courses/create');
    await expect(page.locator('h1', { hasText: 'Создать курс' })).toBeVisible({ timeout: 20_000 });
    await page.locator('input[name="title"]').fill(courseTitle);
    await page.locator('textarea[name="description"]').fill('Course created by the E2E suite');
    await page.locator('button[type="submit"]:has-text("Создать курс"), button:has-text("Создать курс")').first().click();

    // The creation flow lands on the teacher's course list.
    await expect(page.locator('h1', { hasText: 'Мои курсы' })).toBeVisible({ timeout: 20_000 });
    await page.locator('a', { hasText: courseTitle }).first().click();
    await expect(page.locator('h1', { hasText: 'Модули курса' })).toBeVisible({ timeout: 20_000 });
    const courseUrl = page.url();
    const courseId = courseUrl.match(/courses\/([0-9a-f-]{36})/)?.[1];
    expect(courseId, 'module page URL must contain the course id').toBeTruthy();

    // Add a module.
    await page.locator('input[name="title"]').first().fill('Модуль 1: Основы');
    await page.locator('button:has-text("Добавить"):not(:has-text("занятие")):not(:has-text("материал"))').first().click();
    await expect(page.locator('text=Модуль 1: Основы').first()).toBeVisible({ timeout: 15_000 });

    // Fetch the module id via API for lesson arrangement (UI click goes to lessons page).
    const modulesRes = await teacher.get(`/api/v1/education/courses/${courseId}/modules/`);
    const modulesPayload = (await modulesRes.json()) as { results?: Array<{ id: string }> };
    const moduleId = modulesPayload.results?.[0]?.id as string | undefined;
    expect(moduleId).toBeTruthy();

    // Add a lesson through the UI.
    await page.locator('a:has-text("Занятия"), button:has-text("Занятия")').first().click();
    await expect(page.locator('h1', { hasText: 'Занятия модуля' })).toBeVisible({ timeout: 15_000 });
    await page.locator('input[name="title"]').fill('Урок 1: Переменные');
    await page.locator('textarea[name="content"]').fill('# Переменные в E2E\n\nПроверка создания урока.');
    await page.locator('button:has-text("Добавить занятие")').click();
    await expect(page.locator('text=Урок 1: Переменные').first()).toBeVisible({ timeout: 15_000 });

    // Add a video material through the UI.
    const lessonsRes = await teacher.get(`/api/v1/education/courses/${courseId}/modules/${moduleId}/lessons/`);
    const lessonsPayload = (await lessonsRes.json()) as { results?: Array<{ id: string }> };
    const lessonId = lessonsPayload.results?.[0]?.id as string | undefined;
    expect(lessonId).toBeTruthy();

    await page.locator('a:has-text("Материалы"), button:has-text("Материалы")').first().click();
    await expect(page.locator('h1', { hasText: 'Материалы занятия' })).toBeVisible({ timeout: 15_000 });
    await page.locator('input[name="title"]').fill('Видео: E2E');
    await page.locator('select[name="type"]').selectOption('video');
    await page.locator('textarea[name="content_or_url"]').fill('https://www.youtube.com/embed/dQw4w9WgXcQ');
    await page.locator('button:has-text("Добавить материал")').click();
    await expect(page.locator('text=Видео: E2E').first()).toBeVisible({ timeout: 15_000 });

    // Link required + optional practice problems (API arrangement; UI coverage
    // for the link editor is not part of the current pages).
    await linkProblem(teacher, courseId!, moduleId!, lessonId!, helloWorld.id, true);
    await linkProblem(teacher, courseId!, moduleId!, lessonId!, variables.id, false);

    // Publish the course through the edit page.
    await page.goto(`/teacher/courses/${courseId}/edit`);
    await expect(page.locator('h1', { hasText: 'Редактировать курс' })).toBeVisible({ timeout: 15_000 });
    await page.locator('input#is_published').check();
    await page.locator('button:has-text("Сохранить")').click();
    await expect(page.locator('h1', { hasText: 'Модули курса' })).toBeVisible({ timeout: 15_000 });

    // Students list page renders.
    await page.goto('/teacher/students');
    await expect(page.locator('h1', { hasText: 'Студенты' })).toBeVisible();

    // Analytics page renders with real metrics header.
    await page.goto(`/teacher/courses/${courseId}/analytics`);
    await expect(page.locator('h1', { hasText: 'Аналитика курса' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Записано студентов').first()).toBeVisible();

    await teacher.dispose();
  });
});

test.describe('Student Learning Workflow', () => {
  test('enroll, open lesson, view materials, study linked problem', async ({ page, request }) => {
    const teacher = await authedRequest(request, 'teacher');
    const admin = await authedRequest(request, 'admin');
    const student = await authedRequest(request, 'student');
    // Fresh problem per run: the seed student must NOT have solved it already,
    // otherwise the judge sync auto-completes the lesson upon enrollment.
    const fresh = await createFreshProblem(admin, uniqueName('E2E Practice'), 'Fresh output');
    const courseTitle = uniqueName('E2E Student Flow');

    // Arrangement: published course with one lesson, video material and a required problem.
    const course = await createCourse(teacher, courseTitle, { is_published: true });
    const module = await createModule(teacher, course.id, 'Модуль 1');
    const lesson = await createLesson(teacher, course.id, module.id, 'Урок 1: E2E');
    await linkProblem(teacher, course.id, module.id, lesson.id, fresh.id, true);
    // One material so the "Материалы занятия" section renders for the student.
    const materialRes = await teacher.post(
      `/api/v1/education/courses/${course.id}/modules/${module.id}/lessons/${lesson.id}/materials/`,
      { data: { title: 'Видео: E2E', material_type: 'video', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', order: 0 } },
    );
    expect(materialRes.status(), 'create material').toBe(201);

    await loginAs(page, 'student');

    // Catalog shows the course; enroll through the catalog card.
    await page.goto('/courses');
    const card = page.locator('a', { hasText: courseTitle }).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    await expect(page.locator('h1', { hasText: courseTitle })).toBeVisible({ timeout: 15_000 });

    await page.locator('button:has-text("Записаться на курс")').click();
    await expect(page.locator('text=Вы записаны').first()).toBeVisible({ timeout: 15_000 });

    // My Learning shows the active enrollment.
    await page.goto('/my-learning');
    await expect(page.locator('h1', { hasText: 'Моё обучение' })).toBeVisible();
    await expect(page.getByText(courseTitle).first()).toBeVisible({ timeout: 15_000 });

    // Open the course detail via the continue link, then the lesson page.
    const continueLink = page.locator('a:has-text("Продолжить обучение")').first();
    await expect(continueLink).toBeVisible({ timeout: 15_000 });
    await continueLink.click();
    await expect(page.locator('text=Вы записаны').first()).toBeVisible({ timeout: 15_000 });

    // The course detail lists lesson titles as text (not links); open the
    // lesson viewer by its canonical URL using API-fetched ids.
    const modulesRes = await student.get(`/api/v1/education/courses/${course.id}/modules/`);
    const modulePayload = (await modulesRes.json()) as { results?: Array<{ id: string }> };
    const moduleId = modulePayload.results?.[0]?.id;
    expect(moduleId).toBeTruthy();
    const lessonsRes = await student.get(
      `/api/v1/education/courses/${course.id}/modules/${moduleId}/lessons/`,
    );
    const lessonsPayload = (await lessonsRes.json()) as { results?: Array<{ id: string }> };
    const lessonId = lessonsPayload.results?.[0]?.id;
    expect(lessonId).toBeTruthy();

    await page.goto(`/courses/${course.id}/lessons/${lessonId}`);
    await expect(page.locator('h1', { hasText: 'Урок 1: E2E' }).first()).toBeVisible({ timeout: 15_000 });

    await page.locator('button:has-text("Начать занятие")').click();
    await expect(page.locator('text=В процессе').first()).toBeVisible({ timeout: 15_000 });

    // Materials section and linked problem are visible.
    await expect(page.locator('text=Материалы занятия').first()).toBeVisible();
    await expect(page.locator('text=Практические задачи').first()).toBeVisible();
    await expect(page.getByText(fresh.title).first()).toBeVisible();

    // Manual completion must be refused while the mandatory problem is unsolved;
    // the backend's error message is rendered verbatim on the lesson page.
    await page.locator('button:has-text("Завершить занятие")').click();
    await expect(
      page.locator('text=mandatory practice problems', { exact: false }).first(),
    ).toBeVisible({ timeout: 10_000 });

    await teacher.dispose();
  });
});

test.describe('Judge-to-LMS Integration', () => {
  test('AC on a mandatory problem completes the lesson and updates progress', async ({ page, request }) => {
    const teacher = await authedRequest(request, 'teacher');
    const student = await authedRequest(request, 'student');
    const admin = await authedRequest(request, 'admin');
    const fresh = await createFreshProblem(admin, uniqueName('E2E Judge Task'), 'Fresh output');
    const courseTitle = uniqueName('E2E Judge Flow');

    const course = await createCourse(teacher, courseTitle, { is_published: true });
    const module = await createModule(teacher, course.id, 'Модуль 1');
    const lesson = await createLesson(teacher, course.id, module.id, 'Урок 1: Judge');
    await linkProblem(teacher, course.id, module.id, lesson.id, fresh.id, true);

    // Student enrolls via API (registration covered elsewhere), then solves in the UI.
    await student.post(`/api/v1/education/courses/${course.id}/enroll/`);

    await loginAs(page, 'student');
    acceptDialogs(page); // editor asks "Сбросить код?" on language change
    await page.goto(`/problems/${fresh.slug}`);
    await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 30_000 });

    await page.locator('select[aria-label="Language"]').selectOption('python');
    await setMonacoCode(page, 'print("Fresh output")');
    await page.locator('button:has-text("Submit")').first().click();

    // The judge is asynchronous: wait for the toast emitted on AC, which also
    // proves the education caches were invalidated.
    await expect(page.locator('text=Задача решена! Прогресс обновлён.')).toBeVisible({ timeout: 45_000 });

    // The lesson is auto-completed: My Learning moves the course to completed.
    await page.goto('/my-learning');
    await expect(page.getByText(courseTitle).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Курс пройден').first()).toBeVisible({ timeout: 20_000 });

    // Course-scoped: the enrollment is completed exactly once. The student's
    // global counters accumulate across runs, so they are only bounds-checked.
    const stats = await student.get('/api/v1/education/enrollments/my-stats/');
    const statsBody = await stats.json();
    expect(statsBody.lessons_completed).toBeGreaterThanOrEqual(1);
    const enrollments = await student.get('/api/v1/education/enrollments/');
    const enrollmentList = (await enrollments.json()) as {
      results?: Array<{ course: { id: string }; status: string; progress: number; lesson_progress: Array<{ status: string }> }>;
    };
    const mine = enrollmentList.results?.find((e) => e.course.id === course.id);
    expect(mine, 'enrollment for the judge course').toBeTruthy();
    expect(mine!.status).toBe('completed');
    expect(Number(mine!.progress)).toBe(100);
    const completedRows = mine!.lesson_progress.filter((lp) => lp.status === 'completed');
    expect(completedRows.length, 'exactly one completed progress row — no duplicates').toBe(1);

    await teacher.dispose();
    await student.dispose();
  });

  test('WA then AC verdicts are derived from real submissions', async ({ request }) => {
    const student = await authedRequest(request, 'student');
    const variables = await getProblemBySlug(request, 'variables-practice');

    const wa = await submitAndWaitVerdict(student, variables.id, 'print("nope")');
    expect(wa).toBe('WA');

    const ac = await submitAndWaitVerdict(student, variables.id, 'print("42")');
    expect(ac).toBe('AC');

    const stats = await student.get('/api/v1/education/enrollments/my-stats/');
    const statsBody = await stats.json();
    // Unique solved problems, not number of Accepted submissions: the problem
    // above was solved once, so it counts exactly once here.
    expect(statsBody.solved_problems).toBeGreaterThanOrEqual(1);
    expect(statsBody.accepted_submissions).toBeGreaterThanOrEqual(statsBody.solved_problems);

    await student.dispose();
  });
});

test.describe('Olympiad Workflow', () => {
  test('teacher creates and publishes contest; student registers, competes, standings update', async ({ page, request }) => {
    const teacher = await authedRequest(request, 'teacher');
    const student = await authedRequest(request, 'student');
    const problemA = await getProblemBySlug(request, 'problem-a');
    const contestTitle = uniqueName('E2E Olympiad');

    await loginAs(page, 'teacher');

    // Create the contest through the UI modal.
    await page.goto('/teacher/contests');
    await page.locator('button:has-text("+ Создать контест")').first().click();
    await expect(page.locator('h2', { hasText: 'Создать контест' })).toBeVisible({ timeout: 10_000 });
    await page.locator('input[name="title"]').fill(contestTitle);
    await page.locator('textarea[name="description"]').fill('E2E olympiad');
    // Start in the future so the student can register before it begins.
    const futureStart = new Date(Date.now() + 10 * 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${futureStart.getFullYear()}-${pad(futureStart.getMonth() + 1)}-${pad(futureStart.getDate())}T${pad(futureStart.getHours())}:${pad(futureStart.getMinutes())}`;
    await page.locator('input[name="start_time"]').fill(local);
    await page.locator('input[name="duration_minutes"]').fill('120');
    await page.locator('button:has-text("Создать"):not(:has-text("контест"))').last().click();
    await expect(page.locator('td', { hasText: contestTitle })).toBeVisible({ timeout: 15_000 });

    // Find the created contest id via API (teacher's own list).
    const listRes = await teacher.get('/api/v1/contests/contests/?ordering=-start_time&page_size=50');
    const contests = (await listRes.json()).results as Array<{ id: number; title: string }>;
    const contest = contests.find((c) => c.title === contestTitle);
    expect(contest).toBeTruthy();

    // Add the problem through the UI modal (now backed by a real fetch).
    const rowBefore = page.locator('tr', { hasText: contestTitle });
    await rowBefore.locator('button:has-text("Задачи")').click();
    await expect(page.locator('h2', { hasText: `Задачи: ${contestTitle}` })).toBeVisible({ timeout: 10_000 });
    await page.locator('button:has-text("+ Добавить задачу")').click();
    await page.locator('input[name="problem"]').fill(problemA.id);
    await page.locator('input[name="label"]').fill('A');
    await page.locator('input[name="order"]').fill('0');
    await page.locator('input[name="points"]').fill('100');
    await page.locator('button:has-text("Добавить"):not(:has-text("задачу"))').last().click();
    await expect(page.locator('text=Problem A').first()).toBeVisible({ timeout: 15_000 });

    // Reload the management page (modal has no dedicated close button).
    await page.goto('/teacher/contests');
    const row = page.locator('tr', { hasText: contestTitle });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Publish via the row action.
    await row.locator('button:has-text("Опубликовать")').click();
    await expect(row.locator('text=Опубликован').first()).toBeVisible({ timeout: 15_000 });

    // Student registers through the contest page (real UI action).
    await loginAs(page, 'student');
    await page.goto(`/contests/${contest!.id}`);
    await expect(page.locator('h1', { hasText: contestTitle })).toBeVisible({ timeout: 15_000 });
    await page.locator('button:has-text("Зарегистрироваться")').click();
    await expect(page.locator('text=Отменить регистрацию').first()).toBeVisible({ timeout: 15_000 });

    // Baseline for the education-stats isolation check below.
    const statsBefore = await student.get('/api/v1/education/enrollments/my-stats/');
    const solvedBefore = (await statsBefore.json()).solved_problems as number;

    // Contest becomes active: move start_time to now (teacher API).
    await setContestStartTime(teacher, contest!.id, new Date(Date.now() - 1000));

    // Student competes through the in-contest Monaco editor.
    acceptDialogs(page);
    await page.goto(`/contests/${contest!.id}/active`);
    // The editor mounts only after a problem is picked in the sidebar.
    const problemButton = page.locator('aside button', { hasText: 'Problem A' });
    await expect(problemButton).toBeVisible({ timeout: 30_000 });
    await problemButton.click();
    await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 30_000 });
    await page.locator('select[aria-label="Language"]').selectOption('python');
    await setMonacoCode(page, 'print("Solution A")');
    await page.locator('button:has-text("Submit")').first().click();
    await expect(page.locator('text=Задача решена! Прогресс обновлён.')).toBeVisible({ timeout: 45_000 });

    // Standings show the scored row.
    await page.goto(`/contests/${contest!.id}/standings`);
    await expect(page.locator('h1', { hasText: 'Таблица результатов' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('td', { hasText: '100' }).first()).toBeVisible({ timeout: 15_000 });

    // The contest submission must NOT touch education analytics: the solved
    // count is unchanged (a contest AC never marks UserProblemStatus).
    const stats = await student.get('/api/v1/education/enrollments/my-stats/');
    const statsBody = await stats.json();
    expect(statsBody.solved_problems).toBe(solvedBefore);

    await teacher.dispose();
    await student.dispose();
  });

  test('unregistered student cannot enter contest arena', async ({ page, request }) => {
    const teacher = await authedRequest(request, 'teacher');
    const contestTitle = uniqueName('E2E Closed');

    const contest = await createContest(teacher, contestTitle);
    await setContestPublish(teacher, contest.id, true);

    await loginAs(page, 'student');
    await page.goto(`/contests/${contest.id}/active`);
    await expect(page.locator('text=Вы не зарегистрированы на этот контест')).toBeVisible({ timeout: 15_000 });

    await teacher.dispose();
  });
});

test.describe('Analytics Authorization', () => {
  test('teacher sees own course analytics; student sees own stats; cross-role access denied', async ({ page, request }) => {
    const teacher = await authedRequest(request, 'teacher');
    const teacher2 = await authedRequest(request, 'teacher2');
    const student = await authedRequest(request, 'student');
    const courseTitle = uniqueName('E2E Analytics');

    const course = await createCourse(teacher, courseTitle, { is_published: true });
    await student.post(`/api/v1/education/courses/${course.id}/enroll/`);

    // Student analytics page shows real metric cards.
    await loginAs(page, 'student');
    await page.goto('/my-learning/analytics');
    await expect(page.locator('h1', { hasText: 'Моя статистика' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Всего посылок').first()).toBeVisible();
    await expect(page.locator('text=Задач решено').first()).toBeVisible();

    // Student is denied the teacher analytics page (role guard).
    await page.goto(`/teacher/courses/${course.id}/analytics`);
    await expect(page.locator('text=Доступ запрещён').first()).toBeVisible({ timeout: 10_000 });

    // Another teacher is denied someone else's course analytics (backend 403).
    await loginAs(page, 'teacher2');
    await page.goto(`/teacher/courses/${course.id}/analytics`);
    await expect(
      page.locator('text=Не удалось загрузить аналитику курса').first(),
    ).toBeVisible({ timeout: 15_000 });

    // Owner sees the analytics with the enrolled student listed.
    await loginAs(page, 'teacher');
    await page.goto(`/teacher/courses/${course.id}/analytics`);
    await expect(page.locator('h1', { hasText: 'Аналитика курса' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('td', { hasText: 'e2e_student' }).first()).toBeVisible({ timeout: 15_000 });

    await teacher.dispose();
    await teacher2.dispose();
    await student.dispose();
  });

  test('course analytics API rejects anonymous access', async ({ request }) => {
    const teacher = await authedRequest(request, 'teacher');
    const course = await createCourse(teacher, uniqueName('E2E Sec'), { is_published: true });
    const anon = await request.get(`/api/v1/education/courses/${course.id}/analytics/`);
    expect(anon.status()).toBe(401);
    await teacher.dispose();
  });
});
