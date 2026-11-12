import type { Difficulty, Tag } from './problem';

export type ProblemStatus = 'draft' | 'published';

export interface AdminProblem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  status: ProblemStatus;
  solver_count: number;
  tags: Tag[];
  created_at: string;
}

export interface AdminProblemDetail extends AdminProblem {
  time_ms: number;
  memory_mb: number;
  statement: string;
  statement_html: string;
}

export interface AdminProblemFilters {
  status?: ProblemStatus;
  search?: string;
  page?: number;
  difficulty?: Difficulty;
}

export interface AdminTestCase {
  id: string;
  input: string;
  expected_output: string;
  is_sample: boolean;
  order: number;
  created_at: string;
}

export interface PaginatedAdminProblems {
  count: number;
  next: string | null;
  previous: string | null;
  results: AdminProblem[];
}

export interface PaginatedAdminTests {
  count: number;
  next: string | null;
  previous: string | null;
  results: AdminTestCase[];
}

export interface CreateProblemPayload {
  title: string;
  difficulty: Difficulty;
  time_ms: number;
  memory_mb: number;
  statement: string;
  tags: string[];
}

export interface CreateTestPayload {
  input: string;
  expected_output: string;
  is_sample: boolean;
  order?: number;
}

export interface UploadTestsResponse {
  created: number;
  samples: number;
  errors: string[];
}
