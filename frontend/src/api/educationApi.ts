import api from './axios';
import type {
  Category,
  CreateCategoryDto,
  CreateCourseDto,
  CourseDetail,
  CourseList,
  CourseAnalytics,
  Enrollment,
  Lesson,
  LessonProgressItem,
  LessonProblem,
  Material,
  Module,
  StudentAnalytics,
} from '../types/education';

/**
 * DRF paginates list endpoints ({count, next, previous, results}) by default.
 * Normalize to a plain array so every consumer works with one honest shape.
 */
function unwrapList<T>(data: T[] | { results?: T[] } | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
}

// --- Categories ---

export const listCategories = async (): Promise<Category[]> =>
  unwrapList<Category>(
    (await api.get<Category[] | { results: Category[] }>('/education/categories/')).data,
  );

export const getCategory = (id: string) =>
  api.get<Category>(`/education/categories/${id}/`);

export const createCategory = (dto: CreateCategoryDto) =>
  api.post<Category>('/education/categories/', dto);

export const updateCategory = (id: string, dto: Partial<CreateCategoryDto>) =>
  api.patch<Category>(`/education/categories/${id}/`, dto);

export const deleteCategory = (id: string) =>
  api.delete(`/education/categories/${id}/`);

// --- Courses ---

export const listCourses = () =>
  api.get<{ count: number; results: CourseList[] }>('/education/courses/');

export const getCourse = (id: string) => api.get<CourseDetail>(`/education/courses/${id}/`);

export const createCourse = (dto: CreateCourseDto) =>
  api.post<CourseDetail>('/education/courses/', dto);

export const updateCourse = (id: string, dto: Partial<CreateCourseDto>) =>
  api.patch<CourseDetail>(`/education/courses/${id}/`, dto);

export const deleteCourse = (id: string) =>
  api.delete(`/education/courses/${id}/`);

export const enrollCourse = (id: string) =>
  api.post(`/education/courses/${id}/enroll/`);

export const unenrollCourse = (id: string) =>
  api.post(`/education/courses/${id}/unenroll/`);

export const courseProgress = (id: string) =>
  api.get(`/education/courses/${id}/my_progress/`);

// --- Modules ---

export const listModules = async (courseId: string): Promise<Module[]> =>
  unwrapList<Module>(
    (await api.get<Module[] | { results: Module[] }>(`/education/courses/${courseId}/modules/`)).data,
  );

export const getModule = (courseId: string, moduleId: string) =>
  api.get<Module>(`/education/courses/${courseId}/modules/${moduleId}/`);

export const createModule = (courseId: string, dto: { title: string; description?: string; order?: number }) =>
  api.post<Module>(`/education/courses/${courseId}/modules/`, dto);

export const updateModule = (courseId: string, moduleId: string, dto: Partial<{ title: string; description: string; order: number }>) =>
  api.patch<Module>(`/education/courses/${courseId}/modules/${moduleId}/`, dto);

export const deleteModule = (courseId: string, moduleId: string) =>
  api.delete(`/education/courses/${courseId}/modules/${moduleId}/`);

// --- Lessons ---

export const listLessons = async (courseId: string, moduleId: string): Promise<Lesson[]> =>
  unwrapList<Lesson>(
    (await api.get<Lesson[] | { results: Lesson[] }>(
      `/education/courses/${courseId}/modules/${moduleId}/lessons/`,
    )).data,
  );

export const getLesson = (courseId: string, moduleId: string, lessonId: string) =>
  api.get<Lesson>(`/education/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/`);

export const createLesson = (courseId: string, moduleId: string, dto: { title: string; content?: string; order?: number; estimated_minutes?: number; is_published?: boolean }) =>
  api.post<Lesson>(`/education/courses/${courseId}/modules/${moduleId}/lessons/`, dto);

export const updateLesson = (courseId: string, moduleId: string, lessonId: string, dto: Partial<{ title: string; content: string; order: number; estimated_minutes: number; is_published: boolean }>) =>
  api.patch<Lesson>(`/education/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/`, dto);

export const deleteLesson = (courseId: string, moduleId: string, lessonId: string) =>
  api.delete(`/education/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/`);

// --- Materials ---

export const listMaterials = async (
  courseId: string,
  moduleId: string,
  lessonId: string,
): Promise<Material[]> =>
  unwrapList<Material>(
    (await api.get<Material[] | { results: Material[] }>(
      `/education/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/materials/`,
    )).data,
  );

// The backend serializer expects `material_type`; the UI pages send `type`.
export function materialPayload(dto: {
  title?: string;
  type?: string;
  url?: string;
  content?: string;
  order?: number;
}) {
  const { type, ...rest } = dto;
  return { ...rest, material_type: type };
}

export const createMaterial = (
  courseId: string,
  moduleId: string,
  lessonId: string,
  dto: { title: string; type: string; url?: string; content?: string; order?: number },
) =>
  api.post<Material>(
    `/education/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/materials/`,
    materialPayload(dto),
  );

export const updateMaterial = (
  courseId: string,
  moduleId: string,
  lessonId: string,
  materialId: string,
  dto: { title?: string; type?: string; url?: string; content?: string; order?: number },
) =>
  api.patch<Material>(
    `/education/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/materials/${materialId}/`,
    materialPayload(dto),
  );

export const deleteMaterial = (courseId: string, moduleId: string, lessonId: string, materialId: string) =>
  api.delete(`/education/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/materials/${materialId}/`);

// --- Enrollments ---

export const listEnrollments = async (): Promise<Enrollment[]> =>
  unwrapList<Enrollment>(
    (await api.get<Enrollment[] | { results: Enrollment[] }>('/education/enrollments/')).data,
  );

// --- Lesson Progress ---

export const listLessonProgress = async (enrollmentId: string): Promise<LessonProgressItem[]> =>
  unwrapList<LessonProgressItem>(
    (await api.get<LessonProgressItem[] | { results: LessonProgressItem[] }>(
      `/education/enrollments/${enrollmentId}/progress/`,
    )).data,
  );

export const startLessonProgress = (enrollmentId: string, progressId: string) =>
  api.post<LessonProgressItem>(
    `/education/enrollments/${enrollmentId}/progress/${progressId}/start/`,
  );

export const completeLessonProgress = (enrollmentId: string, progressId: string) =>
  api.post<LessonProgressItem>(
    `/education/enrollments/${enrollmentId}/progress/${progressId}/complete/`,
  );

// --- Lesson Problems ---

export const listLessonProblems = async (
  courseId: string,
  moduleId: string,
  lessonId: string,
): Promise<LessonProblem[]> =>
  unwrapList<LessonProblem>(
    (await api.get<LessonProblem[] | { results: LessonProblem[] }>(
      `/education/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/problems/`,
    )).data,
  );

// --- Analytics ---

export const getStudentAnalytics = () =>
  api.get<StudentAnalytics>('/education/enrollments/my-stats/');

export const getCourseAnalytics = (courseId: string) =>
  api.get<CourseAnalytics>(`/education/courses/${courseId}/analytics/`);
