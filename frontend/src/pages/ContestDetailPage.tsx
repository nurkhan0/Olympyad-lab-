import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  getContest,
  registerForContest,
  unregisterFromContest,
  publishContest,
  unpublishContest,
  listContestRegistrations,
  type ContestRegistration,
} from '../api/contestsApi';
import { formatDateTime } from '../utils/date';
import FullPageSpinner from '../components/FullPageSpinner';
import { useAuthStore } from '../store/authStore';

const contestTypeLabels: Record<string, string> = {
  CF: 'Codeforces (CF)',
  ICPC: 'ICPC',
  IOI: 'IOI',
};

export default function ContestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();
  const [showRules, setShowRules] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const contestId = Number(id);
  const { data: contest, isLoading, error } = useQuery({
    queryKey: ['contest', contestId],
    queryFn: () => getContest(contestId),
    enabled: !!contestId,
  });

  const isManager = user?.role === 'teacher' || user?.role === 'admin';
  const { data: registrations } = useQuery({
    queryKey: ['contestRegistrations', contestId],
    queryFn: () => listContestRegistrations(contestId),
    enabled: !!contestId && isManager, // endpoint is teacher/admin-only
  });

  const registerMutation = useMutation({
    mutationFn: () => registerForContest(contestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contest', contestId] });
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      // isRegistered is derived from the registrations list — refresh it too.
      queryClient.invalidateQueries({ queryKey: ['contestRegistrations', contestId] });
    },
    onError: (err: any) => {
      setRegistrationError(err.response?.data?.error || 'Ошибка регистрации');
    },
  });

  const unregisterMutation = useMutation({
    mutationFn: () => unregisterFromContest(contestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contest', contestId] });
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      queryClient.invalidateQueries({ queryKey: ['contestRegistrations', contestId] });
    },
    onError: (err: any) => {
      setRegistrationError(err.response?.data?.error || 'Ошибка отмены регистрации');
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishContest(contestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contest', contestId] });
      queryClient.invalidateQueries({ queryKey: ['contests'] });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: () => unpublishContest(contestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contest', contestId] });
      queryClient.invalidateQueries({ queryKey: ['contests'] });
    },
  });

  // Per-user state comes from the contest payload (works for every role);
  // the full registrations list is teacher/admin-only.
  const isRegistered = (contest?.is_registered ?? registrations?.some((r: ContestRegistration) => r.user === user?.id)) || false;
  const isOwner = user && contest && contest.created_by_handle === user.handle;
  const isTeacherOrAdmin = user && (user.role === 'teacher' || user.role === 'admin');

  if (isLoading) return <FullPageSpinner />;

  if (error || !contest) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-7xl px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Контест не найден</h1>
            <p className="mt-2 text-gray-600">Возможно, он был удалён или не существует.</p>
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

  const now = new Date();
  const startTime = new Date(contest.start_time);
  const endTime = new Date(contest.end_time);
  const isUpcoming = startTime > now;
  const isRunning = startTime <= now && endTime > now;
  const isCompleted = endTime <= now;

  let statusBadge: React.ReactNode;
  if (isUpcoming) {
    statusBadge = <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">Предстоит</span>;
  } else if (isRunning) {
    statusBadge = <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">Активен</span>;
  } else {
    statusBadge = <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">Завершён</span>;
  }

  const canRegister = isAuthenticated && user?.role === 'student' && contest.is_published && contest.is_public && !isRegistered && isUpcoming;
  const canUnregister = isAuthenticated && user?.role === 'student' && isRegistered && isUpcoming;
  const showManageButtons = isTeacherOrAdmin && (isOwner || user?.role === 'admin');

  const handleRegister = () => {
    setRegistrationError(null);
    registerMutation.mutate();
  };

  const handleUnregister = () => {
    setRegistrationError(null);
    unregisterMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              to="/contests"
              className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Назад к контестам
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{contest.title}</h1>
              {statusBadge}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showManageButtons && contest.is_published && (
              <button
                onClick={() => unpublishMutation.mutate()}
                disabled={unpublishMutation.isPending}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Снять с публикации
              </button>
            )}
            {showManageButtons && !contest.is_published && (
              <button
                onClick={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Опубликовать
              </button>
            )}
            {showManageButtons && (
              <Link
                to="/teacher/contests"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Редактировать
              </Link>
            )}
          </div>
        </div>

        {registrationError && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700" role="alert">
            {registrationError}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Описание</h2>
              <div className="prose prose-sm max-w-none text-gray-700">
                <p className="whitespace-pre-wrap">{contest.description}</p>
              </div>
            </section>

            {contest.rules && (
              <section className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Правила</h2>
                  <button
                    onClick={() => setShowRules((v) => !v)}
                    className="text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    {showRules ? 'Скрыть' : 'Показать'}
                  </button>
                </div>
                {showRules && (
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <p className="whitespace-pre-wrap">{contest.rules}</p>
                  </div>
                )}
              </section>
            )}

            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Задачи ({contest.problem_count})</h2>
              {contest.problems.length === 0 ? (
                <p className="text-gray-500">В этом контесте пока нет задач.</p>
              ) : (
                <div className="space-y-3">
                  {contest.problems
                    .sort((a, b) => a.order - b.order)
                    .map((cp) => (
                      <Link
                        key={cp.id}
                        to={`/problems/${cp.problem_slug}`}
                        className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold text-lg">
                            {cp.label}
                          </span>
                          <div>
                            <p className="font-medium text-gray-900">{cp.problem_title}</p>
                            <p className="text-sm text-gray-500">
                              {cp.points} баллов • {cp.problem_difficulty}
                            </p>
                          </div>
                        </div>
                        <svg className="h-5 w-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Информация</h3>
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-gray-500">Тип</dt>
                  <dd className="font-medium text-gray-900">{contestTypeLabels[contest.contest_type] || contest.contest_type}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Начало</dt>
                  <dd className="font-medium text-gray-900">{formatDateTime(contest.start_time)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Длительность</dt>
                  <dd className="font-medium text-gray-900">{contest.duration_minutes} минут</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Окончание</dt>
                  <dd className="font-medium text-gray-900">{formatDateTime(contest.end_time)}</dd>
                </div>
                {contest.registration_start && (
                  <div>
                    <dt className="text-gray-500">Регистрация с</dt>
                    <dd className="font-medium text-gray-900">{formatDateTime(contest.registration_start)}</dd>
                  </div>
                )}
                {contest.registration_end && (
                  <div>
                    <dt className="text-gray-500">Регистрация до</dt>
                    <dd className="font-medium text-gray-900">{formatDateTime(contest.registration_end)}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-gray-500">Участников</dt>
                  <dd className="font-medium text-gray-900">
                    {contest.participant_count}{' '}
                    {contest.max_participants ? `/ ${contest.max_participants}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Рейтинговый</dt>
                  <dd className="font-medium text-gray-900">{contest.is_rated ? 'Да' : 'Нет'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Организатор</dt>
                  <dd className="font-medium text-gray-900">{contest.created_by_handle}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Создан</dt>
                  <dd className="font-medium text-gray-900">{formatDateTime(contest.created_at)}</dd>
                </div>
              </dl>
            </div>

            {isAuthenticated && user?.role === 'student' && (
              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">Действия</h3>
                <div className="space-y-3">
                  {isUpcoming && !isRegistered && canRegister && (
                    <button
                      onClick={handleRegister}
                      disabled={registerMutation.isPending}
                      className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-base font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {registerMutation.isPending ? 'Регистрация...' : 'Зарегистрироваться'}
                    </button>
                  )}
                  {isUpcoming && isRegistered && canUnregister && (
                    <button
                      onClick={handleUnregister}
                      disabled={unregisterMutation.isPending}
                      className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-base font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {unregisterMutation.isPending ? 'Отмена...' : 'Отменить регистрацию'}
                    </button>
                  )}
                  {isRunning && isRegistered && (
                    <Link
                      to={`/contests/${contest.id}/active`}
                      className="w-full block rounded-lg bg-green-600 px-4 py-3 text-center text-base font-medium text-white hover:bg-green-700"
                    >
                      Перейти к контесту →
                    </Link>
                  )}
                  {(isCompleted || isRunning) && isRegistered && (
                    <Link
                      to={`/contests/${contest.id}/standings`}
                      className="w-full block rounded-lg border border-gray-300 bg-white px-4 py-3 text-center text-base font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Таблица результатов
                    </Link>
                  )}
                  {isRegistered && !isUpcoming && !isRunning && !isCompleted && (
                    <p className="text-center text-sm text-gray-500">Контест неактивен</p>
                  )}
                  {!isRegistered && !canRegister && !isUpcoming && (
                    <p className="text-center text-sm text-gray-500">
                      {isCompleted ? 'Контест завершён' : 'Регистрация закрыта'}
                    </p>
                  )}
                  {!isAuthenticated && (
                    <p className="text-center text-sm text-gray-500">
                      <Link to="/login" className="text-indigo-600 hover:underline">Войдите</Link>, чтобы участвовать
                    </p>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}