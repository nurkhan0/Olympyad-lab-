import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getProblems } from '../api/problemsApi';
import DifficultyBadge from '../components/DifficultyBadge';
import StatusIcon from '../components/StatusIcon';
import useDebounce from '../hooks/useDebounce';
import type { Difficulty, ProblemFilters } from '../types/problem';

const PAGE_SIZE = 20;

const DIFFICULTY_OPTIONS: { value: '' | Difficulty; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'expert', label: 'Expert' },
];

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-gray-100">
          <td className="px-4 py-4"><div className="h-4 w-6 rounded bg-gray-200" /></td>
          <td className="px-4 py-4"><div className="mx-auto h-4 w-4 rounded bg-gray-200" /></td>
          <td className="px-4 py-4"><div className="h-4 w-48 rounded bg-gray-200" /></td>
          <td className="px-4 py-4"><div className="h-5 w-16 rounded-full bg-gray-200" /></td>
          <td className="px-4 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
          <td className="px-4 py-4"><div className="h-4 w-12 rounded bg-gray-200" /></td>
        </tr>
      ))}
    </>
  );
}

export default function ProblemsPage() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<ProblemFilters>({ page: 1 });
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    const tag = searchParams.get('tag');
    if (tag) {
      setFilters((prev) => ({ ...prev, tag, page: 1 }));
    }
  }, [searchParams]);

  const queryFilters = useMemo<ProblemFilters>(() => ({
    ...filters,
    search: debouncedSearch || undefined,
  }), [filters, debouncedSearch]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['problems', queryFilters],
    queryFn: () => getProblems(queryFilters).then((res) => res.data),
    placeholderData: keepPreviousData,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;
  const hasActiveFilters = Boolean(
    filters.difficulty || filters.tag || debouncedSearch || (filters.page && filters.page > 1),
  );

  const resetFilters = () => {
    setSearchInput('');
    setFilters({ page: 1 });
  };

  const setDifficulty = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      difficulty: value ? (value as Difficulty) : undefined,
      page: 1,
    }));
  };

  const setPage = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>
        {data && (
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-medium text-indigo-700">
            {data.count}
          </span>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={filters.difficulty ?? ''}
          onChange={(e) => setDifficulty(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {DIFFICULTY_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="search"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setFilters((prev) => ({ ...prev, page: 1 }));
          }}
          placeholder="Поиск по названию..."
          className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:max-w-xs sm:flex-none"
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Название</th>
              <th className="px-4 py-3">Сложность</th>
              <th className="px-4 py-3">Теги</th>
              <th className="px-4 py-3">Решили</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton />
            ) : data?.results.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <p className="text-gray-500">Задачи не найдены</p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                    >
                      Сбросить фильтры
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              data?.results.map((problem, index) => {
                const rowNumber = ((filters.page ?? 1) - 1) * PAGE_SIZE + index + 1;
                const visibleTags = problem.tags.slice(0, 3);
                const extraTags = problem.tags.length - visibleTags.length;

                return (
                  <tr
                    key={problem.slug}
                    className="cursor-pointer border-b border-gray-100 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-gray-400">{rowNumber}</td>
                    <td className="px-4 py-3">
                      <StatusIcon status={problem.user_status} />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link to={`/problems/${problem.slug}`} className="hover:text-indigo-600">
                        {problem.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <DifficultyBadge difficulty={problem.difficulty} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {visibleTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                          >
                            {tag.name}
                          </span>
                        ))}
                        {extraTags > 0 && (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                            +{extraTags}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-gray-600">
                        <svg
                          className="h-4 w-4 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        {problem.solver_count}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && data && data.count > 0 && (
        <div className="mt-6 flex items-center justify-center gap-4 text-sm text-gray-600">
          <button
            type="button"
            disabled={(filters.page ?? 1) <= 1 || isFetching}
            onClick={() => setPage((filters.page ?? 1) - 1)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Назад
          </button>
          <span>
            Страница {filters.page ?? 1} из {totalPages}
          </span>
          <button
            type="button"
            disabled={(filters.page ?? 1) >= totalPages || isFetching}
            onClick={() => setPage((filters.page ?? 1) + 1)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
