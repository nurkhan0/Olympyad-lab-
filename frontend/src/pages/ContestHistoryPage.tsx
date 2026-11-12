import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { listContests, type ContestList, type ContestFilters } from '../api/contestsApi';
import { formatDateTime } from '../utils/date';
import FullPageSpinner from '../components/FullPageSpinner';

export default function ContestHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page')) || 1;

  const filters: ContestFilters = { status: 'completed', ordering: '-start_time', page };

  const { data, isLoading, error } = useQuery({
    queryKey: ['contests', filters],
    queryFn: () => listContests(filters),
  });

  if (isLoading) return <FullPageSpinner />;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-7xl px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Ошибка загрузки истории</h1>
            <p className="mt-2 text-gray-600">Попробуйте обновить страницу позже.</p>
          </div>
        </main>
      </div>
    );
  }

  const contests = data?.results || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">📜 История контестов</h1>
          <p className="mt-1 text-gray-600">Завершённые соревнования и их результаты</p>
        </div>

        {contests.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.759 1.037a4.974 4.974 0 010 7.926C14.08 19.598 13.11 20 12 20s-2.08-.402-2.759-1.037a4.974 4.974 0 010-7.926C7.92 10.402 8.89 10 10 10z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">История пуста</h3>
            <p className="mt-1 text-gray-500">Пока не было завершённых контестов.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {contests.map((contest) => (
              <ContestHistoryCard key={contest.id} contest={contest} />
            ))}
          </div>
        )}

        {data && (data.next || data.previous) && (
          <div className="mt-6 flex justify-center">
            <nav className="flex items-center gap-2">
              {data.previous && page > 1 && (
                <button
                  onClick={() => setSearchParams({ page: String(page - 1) })}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Назад
                </button>
              )}
              <span className="px-4 py-2 text-sm font-medium text-gray-700">
                Страница {page}
              </span>
              {data.next && (
                <button
                  onClick={() => setSearchParams({ page: String(page + 1) })}
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

function ContestHistoryCard({ contest }: { contest: ContestList }) {
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
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">Завершён</span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{contest.description}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDateTime(contest.start_time)} — {formatDateTime(contest.end_time)}
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
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Link
            to={`/contests/${contest.id}/standings`}
            className="rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            Результаты
          </Link>
          <div className="flex items-center gap-2 text-sm text-gray-500">
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
        </div>
      </div>
    </Link>
  );
}