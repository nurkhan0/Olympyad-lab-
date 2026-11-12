import { useInfiniteQuery } from '@tanstack/react-query';

import { getSubmissions, type PaginatedSubmissions } from '../api/submissionsApi';

export interface SubmissionFilters {
  problemId?: string;
  language?: string;
}

export function useSubmissions(filters: SubmissionFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['submissions', filters],
    queryFn: ({ pageParam }) =>
      getSubmissions({
        problem_id: filters.problemId,
        language: filters.language,
        page: pageParam,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: PaginatedSubmissions, allPages) =>
      lastPage.next ? allPages.length + 1 : undefined,
  });
}
