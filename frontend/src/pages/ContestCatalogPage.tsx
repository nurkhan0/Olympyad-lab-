import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { listContests, type ContestList, type ContestFilters, type PaginatedContests } from '../api/contestsApi';
import { formatDateTime } from '../utils/date';
import Navbar from '../components/Navbar';
import FullPageSpinner from '../components/FullPageSpinner';

const statusLabels: Record<string, string> = {
  upcoming: 'Предстоящие',
  active: 'Активные',
  completed: 'Завершенные',
};

export default function ContestCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<'upcoming' | 'active' | 'completed' | ''>(
    (searchParams.get('status') as ContestFilters['status']) || ''
  );

  const filters: ContestFilters = { status: statusFilter || undefined, ordering: '-start_time' };

  const { data, isLoading, error } = useQuery({
    queryKey: ['contests', filters],
    queryFn: () => listContests(filters),
  });

  useEffect(() => {
    setSearchParams({ status: statusFilter || '' }, { replace: true });
  }, [statusFilter, setSearchParams]);

  const handleStatusChange = (newStatus: 'upcoming' | 'active' | 'completed' | '') => {
    setStatusFilter(newStatus);
  };

  if (isLoading) return <FullPageSpinner />;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Ошибка загрузки соревнований</h1>
            <p className="mt-2 text-gray-600">Попробуйте обновить страницу позже.</p>
          </div>
        </main>
      </div>
    );
  }

  const paginatedData = data as PaginatedContests | undefined;
  const contests = paginatedData?.results || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">🏆 Контесты</h1>
          <Link
            to="/teacher/contests"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Создать контест
          </Link>
        </div>

        <div className="mb-6 flex gap-2 flex-wrap">
          {(['upcoming', 'active', 'completed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {statusLabels[status]}
            </button>
          ))}
          {statusFilter && (
            <button
              onClick={() => handleStatusChange('')}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50"
            >
              Все
            </button>
          )}
        </div>

        {contests.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Контестов не найдено</h3>
            <p className="mt-1 text-gray-500">
              {statusFilter
                ? `Нет ${statusLabels[statusFilter].toLowerCase()} контестов.`
                : 'Пока нет ни одного контеста. Стать первым!'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contests.map((contest) => (
              <ContestCard key={contest.id} contest={contest} />
            ))}
          </div>
        )}

        {paginatedData && (paginatedData.next || paginatedData.previous) && (
          <div className="mt-6 flex justify-center">
            <nav className="flex items-center gap-2">
              {paginatedData.previous && (
                <button
                  onClick={() => {
                    const url = new URL(paginatedData.previous!);
                    const page = url.searchParams.get('page');
                    setSearchParams({ ...Object.fromEntries(searchParams), page: page || '1' });
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Назад
                </button>
              )}
              <span className="px-4 py-2 text-sm font-medium text-gray-700">
                Страница {searchParams.get('page') || '1'}
              </span>
              {paginatedData.next && (
                <button
                  onClick={() => {
                    const url = new URL(paginatedData.next!);
                    const page = url.searchParams.get('page');
                    setSearchParams({ ...Object.fromEntries(searchParams), page: page || '1' });
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Вперёд
                </button>
              )}
            </nav>
          </div>
        )}
      </main>
    </div>
  );
}

function ContestCard({ contest }: { contest: ContestList }) {
  const now = new Date();
  const startTime = new Date(contest.start_time);
  const endTime = new Date(contest.end_time);
  const isUpcoming = startTime > now;
  const isRunning = startTime <= now && endTime > now;

  let statusBadge: React.ReactNode;
  if (isUpcoming) {
    statusBadge = <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">Предстоит</span>;
  } else if (isRunning) {
    statusBadge = <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Активен</span>;
  } else {
    statusBadge = <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">Завершён</span>;
  }

  const contestTypeLabels: Record<string, string> = {
    CF: 'Codeforces',
    ICPC: 'ICPC',
    IOI: 'IOI',
  };

  return (
    <Link
      to={`/contests/${contest.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-6 hover:shadow-lg hover:border-indigo-300 transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{contest.title}</h3>
            {statusBadge}
          </div>
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{contest.description}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDateTime(contest.start_time)}
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {contest.duration_minutes} мин
            </span>
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
              {contestTypeLabels[contest.contest_type] || contest.contest_type}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
        <span className="flex items-center gap-1">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {contest.participant_count} участн.
        </span>
        <span className="flex items-center gap-1">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          {contest.problem_count} задач
        </span>
      </div>
    </Link>
  );
}