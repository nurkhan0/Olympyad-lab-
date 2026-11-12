import api from './axios';

export type SubmissionLanguage = 'python' | 'cpp' | 'java';

export interface SubmissionListItem {
  id: number;
  problem: string;
  problem_title: string;
  problem_slug: string;
  language: string;
  status: 'pending' | 'judging' | 'done' | 'error';
  verdict: string | null;
  time_ms: number | null;
  memory_kb: number | null;
  created_at: string;
}

export interface SubmissionDetail extends SubmissionListItem {
  user: string;
  code: string;
}

export interface PaginatedSubmissions {
  count: number;
  next: string | null;
  previous: string | null;
  results: SubmissionListItem[];
}

export interface SubmissionFiltersParams {
  problem_id?: string;
  language?: string;
  page?: number;
}

export const getSubmissions = (params?: SubmissionFiltersParams) =>
  api.get<PaginatedSubmissions>('/submissions/', { params }).then((res) => res.data);

export const getSubmission = (id: number) =>
  api.get<SubmissionDetail>(`/submissions/${id}/`).then((res) => res.data);

export const createSubmission = (data: {
  problem: string;
  code: string;
  language: SubmissionLanguage;
  contest_id?: number;
}) => api.post<SubmissionDetail>('/submissions/', data).then((res) => res.data);