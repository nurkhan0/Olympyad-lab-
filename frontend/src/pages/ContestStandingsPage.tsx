import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import {
  getContest,
  getContestStandings,
  listContestRegistrations,
  type ContestRegistration,
} from '../api/contestsApi';
import FullPageSpinner from '../components/FullPageSpinner';
import { useAuthStore } from '../store/authStore';

export default function ContestStandingsPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();

  const contestId = Number(id);
  const { data: contest, isLoading: contestLoading, error: contestError } = useQuery({
    queryKey: ['contest', contestId],
    queryFn: () => getContest(contestId),
    enabled: !!contestId,
  });

  const { data: standings, isLoading: standingsLoading, error: standingsError } = useQuery({
    queryKey: ['contestStandings', contestId],
    queryFn: () => getContestStandings(contestId),
    enabled: !!contestId,
  });

  const { data: registrations } = useQuery({
    queryKey: ['contestRegistrations', contestId],
    queryFn: () => listContestRegistrations(contestId),
    enabled: !!contestId,
  });

  const now = new Date();
  const startTime = contest ? new Date(contest.start_time) : null;
  const endTime = contest ? new Date(contest.end_time) : null;
  const isUpcoming = startTime && startTime > now;
  const isRunning = startTime && endTime && startTime <= now && endTime > now;
  const isCompleted = endTime && endTime <= now;

  if (contestLoading || standingsLoading) return <FullPageSpinner />;

  if (contestError || standingsError || !contest) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-7xl px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Не удалось загрузить таблицу результатов</h1>
            <Link
              to="/contests"
              className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              К списку контестов
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isRegistered = registrations?.some((r: ContestRegistration) => r.user === user?.id) || false;
  const isTeacherOrAdmin = user && (user.role === 'teacher' || user.role === 'admin');

  // Allow viewing standings if: contest is running/completed, or user is teacher/admin/owner, or user is registered
  const canViewStandings = isRunning || isCompleted || isTeacherOrAdmin || isRegistered;

  if (!canViewStandings && isUpcoming) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-7xl px-4 py-12">
          <div className="text-center">
            <Link
              to={`/contests/${contestId}`}
              className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              К контесту
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">{contest.title}</h1>
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="mt-4 text-xl font-semibold text-gray-900">Таблица результатов недоступна</h2>
              <p className="mt-2 text-gray-600">Результаты станут доступны после начала контеста.</p>
              <Link
                to={`/contests/${contestId}`}
                className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-3 text-base font-medium text-white hover:bg-indigo-700"
              >
                Вернуться к контесту
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link
              to={`/contests/${contestId}`}
              className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              К контесту
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{contest.title} — Таблица результатов</h1>
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-indigo-50 p-4 text-sm text-indigo-800">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {standings?.length || 0} участников
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {contest.duration_minutes} минут
            </span>
            {(isRunning || isCompleted) && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                {isRunning ? 'Контест активен' : 'Контест завершён'}
              </span>
            )}
          </div>
        </div>

        {standings && standings.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Пока нет результатов</h3>
            <p className="mt-1 text-gray-500">Никто ещё не решил ни одной задачи.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-16 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Место</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Участник</th>
                    <th className="w-24 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Балл</th>
                    <th className="w-24 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Решено</th>
                    <th className="w-28 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Штраф</th>
                    {contest.problems.length > 0 && (
                      <>
                        {contest.problems
                          .sort((a, b) => a.order - b.order)
                          .map((cp) => (
                            <th key={cp.id} className="w-16 px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {cp.label} ({cp.points})
                            </th>
                          ))}
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {standings?.map((standing, index) => (
                    <tr key={standing.user_id} className={index === 0 ? 'bg-yellow-50' : index === 1 ? 'bg-gray-50' : index === 2 ? 'bg-amber-50' : ''}>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">
                        {standing.rank === 1 && <span className="text-yellow-600">🥇</span>}
                        {standing.rank === 2 && <span className="text-gray-500">🥈</span>}
                        {standing.rank === 3 && <span className="text-amber-700">🥉</span>}
                        {standing.rank > 3 && standing.rank}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/profile/${standing.handle}`}
                          className="font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          {standing.handle}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">{standing.total_score}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700">{standing.solved_count}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm text-gray-600">{standing.penalty_time} мин</td>
                      {contest.problems.length > 0 && (
                        <>
                          {contest.problems
                            .sort((a, b) => a.order - b.order)
                            .map((cp) => {
                              const pdata = standing.problems.find((p) => p.problem_id === cp.problem);
                              if (!pdata) return <td key={cp.id} className="px-2 py-3 text-center text-gray-300">—</td>;
                              if (pdata.solved) {
                                const minutes = pdata.first_ac_time
                                  ? Math.floor((new Date(pdata.first_ac_time).getTime() - new Date(contest.start_time).getTime()) / 60000)
                                  : 0;
                                return (
                                  <td key={cp.id} className="px-2 py-3 text-center text-green-700 font-medium">
                                    +{pdata.attempts > 0 ? minutes + pdata.attempts * 20 : minutes}
                                  </td>
                                );
                              }
                              return pdata.attempts > 0 ? (
                                <td key={cp.id} className="px-2 py-3 text-center text-red-600 font-medium">
                                  -{pdata.attempts}
                                </td>
                              ) : (
                                <td key={cp.id} className="px-2 py-3 text-center text-gray-300">—</td>
                              );
                            })}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {standings && standings.length > 0 && (
          <div className="mt-6 text-sm text-gray-500">
            <p>Показано участников: {standings.length}</p>
          </div>
        )}
      </main>
    </div>
  );
}