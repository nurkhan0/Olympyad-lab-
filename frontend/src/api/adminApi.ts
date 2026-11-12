import type {
  AdminProblemDetail,
  AdminProblemFilters,
  AdminTestCase,
  CreateProblemPayload,
  CreateTestPayload,
  PaginatedAdminProblems,
  PaginatedAdminTests,
  UploadTestsResponse,
} from '../types/admin';
import api from './axios';

export const getAdminProblems = (p?: AdminProblemFilters) =>
  api.get<PaginatedAdminProblems>('/admin/problems/', { params: p });

export const getAdminProblem = (slug: string) =>
  api.get<AdminProblemDetail>(`/admin/problems/${slug}/`);

export const createProblem = (d: CreateProblemPayload) =>
  api.post<AdminProblemDetail>('/admin/problems/', d);

export const updateProblem = (slug: string, d: Partial<CreateProblemPayload>) =>
  api.patch<AdminProblemDetail>(`/admin/problems/${slug}/`, d);

export const deleteProblem = (slug: string) =>
  api.delete(`/admin/problems/${slug}/`);

export const publishProblem = (slug: string) =>
  api.post<{ slug: string; status: string }>(`/admin/problems/${slug}/publish/`);

export const draftProblem = (slug: string) =>
  api.post<{ slug: string; status: string }>(`/admin/problems/${slug}/draft/`);

export const getTests = (slug: string) =>
  api.get<PaginatedAdminTests | AdminTestCase[]>(`/admin/problems/${slug}/tests/`);

export const uploadTests = (
  slug: string,
  form: FormData,
  onProgress?: (percent: number) => void,
) =>
  api.post<UploadTestsResponse>(`/admin/problems/${slug}/tests/upload/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    },
  });

export const createTest = (slug: string, d: CreateTestPayload) =>
  api.post(`/admin/problems/${slug}/tests/`, d);

export const deleteTest = (slug: string, id: string) =>
  api.delete(`/admin/problems/${slug}/tests/${id}/`);

export function normalizeTests(
  data: PaginatedAdminTests | AdminTestCase[],
): AdminTestCase[] {
  return Array.isArray(data) ? data : data.results;
}
