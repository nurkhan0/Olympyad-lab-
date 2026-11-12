import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getProblem, getProblems } from '../api/problemsApi';
import SubmissionModal from '../components/SubmissionModal';
import SubmissionsTable, { SubmissionsTableSkeleton } from '../components/SubmissionsTable';
import { useSubmissions } from '../hooks/useSubmissions';

const LANGUAGE_OPTIONS = [
  { value: '', label: 'All Languages' },
  { value: 'python', label: 'Python 3' },
  { value: 'cpp', label: 'C++17' },
  { value: 'java', label: 'Java 17' },
];

export default function SubmissionsPage() {
  const { slug: problemSlug } = useParams<{ slug?: string }>();
  const [problemFilter, setProblemFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: problemFromRoute } = useQuery({
    queryKey: ['problem', problemSlug],
    queryFn: () => getProblem(problemSlug!).then((response) => response.data),
    enabled: Boolean(problemSlug),
  });

  useEffect(() => {
    if (problemFromRoute?.id) {
      setProblemFilter(problemFromRoute.id);
    }
  }, [problemFromRoute?.id]);

  const { data: problemsData } = useQuery({
    queryKey: ['problems', 'filter-list'],
    queryFn: () => getProblems({ page: 1 }).then((response) => response.data),
  });

  const filters = useMemo(
    () => ({
      problemId: problemFilter || undefined,
      language: languageFilter || undefined,
    }),
    [problemFilter, languageFilter],
  );

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useSubmissions(filters);

  const submissions = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">My Submissions</h1>

      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={problemFilter}
          onChange={(event) => setProblemFilter(event.target.value)}
          disabled={Boolean(problemSlug)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
        >
          <option value="">All Problems</option>
          {problemsData?.results.map((problem) => (
            <option key={problem.id} value={problem.id}>
              {problem.title}
            </option>
          ))}
        </select>

        <select
          value={languageFilter}
          onChange={(event) => setLanguageFilter(event.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <option key={option.label} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <SubmissionsTableSkeleton />}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center">
          <p className="text-sm text-red-700">Failed to load submissions</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <SubmissionsTable
            submissions={submissions}
            onRowClick={(submission) => setSelectedSubmissionId(submission.id)}
          />
          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && (
            <p className="mt-4 text-center text-sm text-gray-500">Loading more…</p>
          )}
        </>
      )}

      <SubmissionModal
        submissionId={selectedSubmissionId}
        onClose={() => setSelectedSubmissionId(null)}
      />
    </div>
  );
}
