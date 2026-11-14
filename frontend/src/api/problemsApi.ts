import type {
  Problem,
  ProblemDetail,
  ProblemFilters,
  ManageableProblem,
  ManageableProblemFilters,
  PaginatedManageableProblems,
  CreateManageableProblemPayload,
} from '../types/problem';
import api from './axios';

export interface PaginatedProblems {
  count: number;
  next: string | null;
  previous: string | null;
  results: Problem[];
}

export const getProblems = (f: ProblemFilters) =>
  api.get<PaginatedProblems>('/problems/', { params: f });

export const getProblem = (slug: string) =>
  api.get<ProblemDetail>(`/problems/${slug}/`);

export const bookmarkProblem = (slug: string) =>
  api.post(`/problems/${slug}/bookmark/`);

// --- Teacher/admin problem management (pick or create problems for a contest) ---

export const getManageableProblems = (f: ManageableProblemFilters = {}) =>
  api.get<PaginatedManageableProblems>('/problems/manage/', { params: f });

export const createManageableProblem = (dto: CreateManageableProblemPayload) =>
  api.post<ManageableProblem>('/problems/manage/', dto);
