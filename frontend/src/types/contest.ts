export interface ContestProblem {
  id: number;
  problem: string;
  problem_title: string;
  problem_slug: string;
  problem_difficulty: string;
  label: string;
  order: number;
  points: number;
}

export interface ContestList {
  id: number;
  title: string;
  description: string;
  contest_type: string;
  start_time: string;
  duration_minutes: number;
  end_time: string;
  registration_start: string | null;
  registration_end: string | null;
  is_public: boolean;
  is_published: boolean;
  is_rated: boolean;
  is_registration_open: boolean;
  is_running: boolean;
  is_upcoming: boolean;
  rules: string;
  problem_count: number;
  participant_count: number;
  max_participants: number | null;
  created_by_handle: string;
  created_at: string;
}

export interface ContestDetail extends ContestList {
  rules: string;
  is_registered: boolean;
  problems: ContestProblem[];
}

export interface ContestFilters {
  status?: 'upcoming' | 'active' | 'completed';
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface PaginatedContests {
  count: number;
  next: string | null;
  previous: string | null;
  results: ContestList[];
}

export interface ContestStanding {
  rank: number;
  user_id: string;
  handle: string;
  total_score: number;
  solved_count: number;
  penalty_time: number;
  problems: Array<{
    problem_id: string;
    problem_title: string;
    label: string | null;
    points: number;
    solved: boolean;
    attempts: number;
    first_ac_time: string | null;
  }>;
}

export interface ContestRegistration {
  id: string;
  contest: number;
  user: string;
  user_handle: string;
  registered_at: string;
}

export interface ContestSubmission {
  id: string;
  problem_id: string;
  problem_title: string;
  user_id: string;
  user_handle: string;
  language: string;
  status: string;
  verdict: string;
  time_ms: number | null;
  memory_kb: number | null;
  created_at: string;
}

export interface PaginatedContestSubmissions {
  count: number;
  next: string | null;
  previous: string | null;
  results: ContestSubmission[];
}

export interface CreateContestDto {
  title: string;
  description: string;
  rules: string;
  contest_type: string;
  start_time: string;
  duration_minutes: number;
  registration_start?: string;
  registration_end?: string;
  is_public: boolean;
  is_published: boolean;
  is_rated: boolean;
  max_participants?: number;
}

export interface AddProblemDto {
  problem: string;
  label: string;
  /** Omitted lets the API pick the next free slot. */
  order?: number;
  points: number;
}