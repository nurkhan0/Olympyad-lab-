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
