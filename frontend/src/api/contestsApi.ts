import api from './axios';
import type {
  ContestList,
  ContestDetail,
  ContestFilters,
  PaginatedContests,
  ContestStanding,
  ContestRegistration,
  ContestSubmission,
  PaginatedContestSubmissions,
  CreateContestDto,
  AddProblemDto,
  ContestProblem,
} from '../types/contest';

// Re-export types for convenience
export type {
  ContestList,
  ContestDetail,
  ContestFilters,
  PaginatedContests,
  ContestStanding,
  ContestRegistration,
  ContestSubmission,
  PaginatedContestSubmissions,
  CreateContestDto,
  AddProblemDto,
  ContestProblem,
};

// --- Contests ---

export const listContests = (filters: ContestFilters = {}) =>
  api.get<PaginatedContests>('/contests/contests/', { params: filters }).then((res) => res.data);

export const getContest = (id: number) =>
  api.get<ContestDetail>(`/contests/contests/${id}/`).then((res) => res.data);

export const createContest = (dto: CreateContestDto) =>
  api.post<ContestDetail>('/contests/contests/', dto).then((res) => res.data);

export const updateContest = (id: number, dto: Partial<CreateContestDto>) =>
  api.patch<ContestDetail>(`/contests/contests/${id}/`, dto).then((res) => res.data);

export const deleteContest = (id: number) =>
  api.delete(`/contests/contests/${id}/`).then((res) => res.data);

export const publishContest = (id: number) =>
  api.post<{ status: string }>(`/contests/contests/${id}/publish/`).then((res) => res.data);

export const unpublishContest = (id: number) =>
  api.post<{ status: string }>(`/contests/contests/${id}/unpublish/`).then((res) => res.data);

export const listContestProblems = (id: number) =>
  api.get<ContestProblem[]>(`/contests/contests/${id}/problems/`).then((res) => res.data);

export const addContestProblem = (id: number, dto: AddProblemDto) =>
  api.post<ContestProblem>(`/contests/contests/${id}/add_problem/`, dto).then((res) => res.data);

export const removeContestProblem = (id: number, problemId: string) =>
  api.delete(`/contests/contests/${id}/remove_problem/`, {
    params: { problem_id: problemId },
  }).then((res) => res.data);

export const listContestRegistrations = (id: number) =>
  api.get<ContestRegistration[]>(`/contests/contests/${id}/registrations/`).then((res) => res.data);

export const getContestStandings = (id: number) =>
  api.get<ContestStanding[]>(`/contests/contests/${id}/standings/`).then((res) => res.data);

// --- Registration ---

export const registerForContest = (contestId: number) =>
  api.post<ContestRegistration>(`/contests/contests/${contestId}/register/`).then((res) => res.data);

export const unregisterFromContest = (contestId: number) =>
  api.delete(`/contests/contests/${contestId}/register/`).then((res) => res.data);

// --- Submissions ---

export const listContestSubmissions = (
  contestId: number,
  params?: { problem_id?: string; user_id?: string; page?: number }
) =>
  api.get<PaginatedContestSubmissions>(
    `/contests/contests/${contestId}/submissions/`,
    { params }
  ).then((res) => res.data);