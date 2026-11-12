import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import {
  deleteProblem,
  draftProblem,
  getAdminProblems,
  publishProblem,
} from '../../api/adminApi';
import DifficultyBadge from '../../components/DifficultyBadge';
import useDebounce from '../../hooks/useDebounce';
import type { AdminProblem, AdminProblemFilters, PaginatedAdminProblems, ProblemStatus } from '../../types/admin';

type StatusTab = 'all' | ProblemStatus;

const STATUS_TABS: { value: StatusTab; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'draft', label: 'Черновик' },
  { value: 'published', label: 'Опубликовано' },
];

function StatusBadge({ status }: { status: ProblemStatus }) {
  const styles =
    status === 'published'
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-gray-100 text-gray-600';

  const label = status === 'published' ? 'Опубликовано' : 'Черновик';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}

export default function AdminProblemsPage() {
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);

  const filters = useMemo<AdminProblemFilters>(() => ({
    status: statusTab === 'all' ? undefined : statusTab,
    search: debouncedSearch || undefined,
  }), [statusTab, debouncedSearch]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-problems', filters],
    queryFn: () => getAdminProblems(filters).then((res) => res.data),
  });

  const updateCache = (slug: string, updater: (item: AdminProblem) => AdminProblem) => {
    queryClient.setQueriesData<PaginatedAdminProblems>(
      { queryKey: ['admin-problems'] },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          results: old.results.map((item) => (item.slug === slug ? updater(item) : item)),
        };
      },
    );
  };

  const publishMutation = useMutation({
    mutationFn: publishProblem,
    onMutate: async (slug) => {
      await queryClient.cancelQueries({ queryKey: ['admin-problems'] });
      updateCache(slug, (item) => ({ ...item, status: 'published' }));
    },
    onSuccess: () => toast.success('Задача опубликована'),
    onError: () => toast.error('Не удалось опубликовать'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin-problems'] }),
  });

  const draftMutation = useMutation({
    mutationFn: draftProblem,
    onMutate: async (slug) => {
      await queryClient.cancelQueries({ queryKey: ['admin-problems'] });
      updateCache(slug, (item) => ({ ...item, status: 'draft' }));
    },
    onSuccess: () => toast.success('Задача переведена в черновик'),
    onError: () => toast.error('Не удалось перевести в черновик'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin-problems'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProblem,
    onSuccess: () => {
      toast.success('Задача удалена');
      queryClient.invalidateQueries({ queryKey: ['admin-problems'] });
    },
    onError: () => toast.error('Не удалось удалить задачу'),
  });

  const handleDelete = (problem: AdminProblem) => {
    if (window.confirm(`Удалить задачу «${problem.title}»?`)) {
      deleteMutation.mutate(problem.slug);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Задачи</h1>
          {data && (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">
              {data.count}
            </span>
          )}
        </div>
        <Link
          to="/admin/problems/create"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          + Новая задача
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 bg-white p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusTab(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                statusTab === tab.value
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Поиск по названию..."
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Название</th>
              <th className="px-4 py-3">Сложность</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Тестов</th>
              <th className="px-4 py-3">Решили</th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse border-b border-gray-100">
                  <td colSpan={6} className="px-4 py-4">
                    <div className="h-4 w-full rounded bg-gray-200" />
                  </td>
                </tr>
              ))
            ) : data?.results.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                  Задачи не найдены
                </td>
              </tr>
            ) : (
              data?.results.map((problem) => (
                <tr key={problem.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{problem.title}</td>
                  <td className="px-4 py-3">
                    <DifficultyBadge difficulty={problem.difficulty} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={problem.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">—</td>
                  <td className="px-4 py-3 text-gray-600">{problem.solver_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to={`/admin/problems/${problem.slug}/edit`}
                        className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                        title="Редактировать"
                      >
                        ✏
                      </Link>
                      {problem.status === 'draft' ? (
                        <button
                          type="button"
                          onClick={() => publishMutation.mutate(problem.slug)}
                          className="rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                        >
                          ↑ Опубликовать
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => draftMutation.mutate(problem.slug)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          ↓ В черновик
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(problem)}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        title="Удалить"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
