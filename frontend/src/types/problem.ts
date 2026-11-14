export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type UserStatus = 'solved' | 'attempted' | 'todo' | null;

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface Problem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  tags: Tag[];
  solver_count: number;
  user_status: UserStatus;
}

export interface ProblemFilters {
  difficulty?: Difficulty;
  tag?: string;
  search?: string;
  page?: number;
}

export interface TestCasePublic {
  input: string;
  expected_output: string;
}

export interface ProblemDetail extends Problem {
  statement_html: string;
  time_ms: number;
  memory_mb: number;
  sample_test_cases: TestCasePublic[];
}

export type ProblemStatus = 'draft' | 'published';

/** Problem row visible to teachers/admins when composing a contest. */
export interface ManageableProblem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  status: ProblemStatus;
  solver_count: number;
  tags: Tag[];
  is_author: boolean;
  created_at: string;
}

export interface ManageableProblemFilters {
  status?: ProblemStatus;
  difficulty?: Difficulty;
  search?: string;
  page?: number;
}

export interface PaginatedManageableProblems {
  count: number;
  next: string | null;
  previous: string | null;
  results: ManageableProblem[];
}

export interface CreateManageableProblemPayload {
  title: string;
  difficulty: Difficulty;
  statement: string;
  time_ms: number;
  memory_mb: number;
  tags: string[];
  /** Admins may publish immediately; teachers are always forced to draft. */
  status?: ProblemStatus;
}
