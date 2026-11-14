import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import {
  getContest,
  getContestProblemStatement,
  listContestProblems,
  listContestRegistrations,
  type ContestProblem,
  type ContestRegistration,
} from '../api/contestsApi';
import { createSubmission } from '../api/submissionsApi';
import CodeEditor, { DEFAULT_SNIPPETS, type EditorLanguage } from '../components/CodeEditor';
import { useAuthStore } from '../store/authStore';
import SampleTests from '../components/SampleTests';
import SubmissionStatus from '../components/SubmissionStatus';

function ContestActiveSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <aside className="lg:col-span-1">
            <div className="h-96 rounded-xl border border-gray-200 bg-white" />
          </aside>
          <div className="lg:col-span-2">
            <div className="h-[560px] rounded-xl border border-gray-200 bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContestActivePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();
  const [selectedProblem, setSelectedProblem] = useState<ContestProblem | null>(null);
  const [language, setLanguage] = useState<EditorLanguage>('cpp');
  const [code, setCode] = useState(DEFAULT_SNIPPETS.cpp);
  const [activeSubmissionId, setActiveSubmissionId] = useState<number | null>(null);

  const contestId = Number(id);
  const { data: contest, isLoading: contestLoading, error: contestError } = useQuery({
    queryKey: ['contest', contestId],
    queryFn: () => getContest(contestId),
    enabled: !!contestId,
  });

  const { data: problems, isLoading: problemsLoading } = useQuery({
    queryKey: ['contestProblems', contestId],
    queryFn: () => listContestProblems(contestId),
    enabled: !!contestId,
  });

  // Contest-only problems are deliberately absent from /problems/, so the arena
  // reads each statement through the contest-scoped endpoint.
  const {
    data: statement,
    isLoading: statementLoading,
    error: statementError,
  } = useQuery({
    queryKey: ['contestProblemStatement', contestId, selectedProblem?.problem],
    queryFn: () => getContestProblemStatement(contestId, selectedProblem!.problem),
    enabled: !!contestId && !!selectedProblem,
    retry: false,
  });

  // The registrations list endpoint is teacher/admin-only; per-user state
  // comes from the contest payload below.
  const isManager = user?.role === 'teacher' || user?.role === 'admin';
  const { data: registrations } = useQuery({
    queryKey: ['contestRegistrations', contestId],
    queryFn: () => listContestRegistrations(contestId),
    enabled: !!contestId && isManager,
  });

  // NOTE: every hook must be declared before any early return below.
  const submitMutation = useMutation({
    mutationFn: () => {
      if (!selectedProblem) throw new Error('No problem selected');
      return createSubmission({
        problem: selectedProblem.problem,
        code,
        language,
        contest_id: contestId,
      });
    },
    onSuccess: (response) => {
      setActiveSubmissionId(response.id);
      queryClient.invalidateQueries({ queryKey: ['contestProblems', contestId] });
      toast.success('Решение отправлено');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Ошибка отправки');
    },
  });

  // Reset the editor when the picked problem changes (never during render).
  useEffect(() => {
    if (selectedProblem) {
      setCode(DEFAULT_SNIPPETS[language]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProblem?.id]);

  if (contestLoading || problemsLoading) return <ContestActiveSkeleton />;

  if (contestError || !contest) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-7xl px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Контест не найден</h1>
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
  const isRunning = startTime <= now && endTime > now;

  // Check if user is registered
  // Per-user state comes from the contest payload; the registrations list
  // endpoint is teacher/admin-only and must not gate the student arena.
  const isRegistered = (contest?.is_registered ?? registrations?.some((r: ContestRegistration) => r.user === user?.id)) || false;

  // Redirect if not registered or contest not running
  if (!isAuthenticated || user?.role !== 'student' || !isRegistered || !isRunning) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-7xl px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">
              {isRegistered ? 'Контест не активен' : 'Вы не зарегистрированы на этот контест'}
            </h1>
            <Link
              to={`/contests/${contestId}`}
              className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              К контесту
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const timeRemaining = endTime.getTime() - now.getTime();
  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  const sortedProblems = [...(problems || [])].sort((a, b) => a.order - b.order);

  const handleLanguageChange = (lang: string) => {
    const next = lang as EditorLanguage;
    if (next === language) return;
    if (window.confirm('Сбросить код?')) {
      setLanguage(next);
      setCode(DEFAULT_SNIPPETS[next]);
    }
  };

  const handleSubmit = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!selectedProblem) {
      toast.error('Выберите задачу');
      return;
    }
    submitMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header with timer */}
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
            <h1 className="text-2xl font-bold text-gray-900">{contest.title}</h1>
          </div>
          <div className="shrink-0">
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-xs text-gray-500">Осталось времени</p>
                <p className="font-mono text-2xl font-bold text-red-600">
                  {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
                </p>
              </div>
              <Link
                to={`/contests/${contestId}/standings`}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Таблица результатов
              </Link>
            </div>
          </div>
        </div>

        {/* Contest info bar */}
        <div className="mb-6 rounded-lg bg-indigo-50 p-4 text-sm text-indigo-800">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {sortedProblems.length} задач
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {contest.duration_minutes} минут
            </span>
            <span className="flex items-center gap-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {contest.participant_count} участников
            </span>
          </div>
        </div>

        {/* Problems grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Problem list sidebar */}
          <aside className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Задачи</h3>
              <div className="space-y-2">
                {sortedProblems.map((problem) => (
                  <button
                    key={problem.id}
                    onClick={() => setSelectedProblem(problem)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedProblem?.id === problem.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold">
                        {problem.label}
                      </span>
                      <span className="text-sm font-medium text-gray-700">{problem.points} баллов</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-600">{problem.problem_title}</p>
                    <p className="text-xs text-gray-500">{problem.problem_difficulty}</p>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Problem detail / Editor */}
          <div className="lg:col-span-2">
            {selectedProblem ? (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Задача {selectedProblem.label}</p>
                      <h3 className="font-semibold text-gray-900">{selectedProblem.problem_title}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span className="font-medium text-indigo-700">{selectedProblem.points} баллов</span>
                      <span className="rounded-full bg-gray-200 px-2 py-0.5">{selectedProblem.problem_difficulty}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    {statementLoading ? (
                      <p className="text-sm text-gray-500">Загрузка условия…</p>
                    ) : statementError ? (
                      <p className="text-sm text-red-600">Не удалось загрузить условие задачи.</p>
                    ) : statement ? (
                      <>
                        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
                          <span>
                            Лимит времени: <span className="font-medium">{statement.time_ms} мс</span>
                          </span>
                          <span>
                            Память: <span className="font-medium">{statement.memory_mb} МБ</span>
                          </span>
                          <span>
                            Баллы: <span className="font-medium">{statement.points}</span>
                          </span>
                        </div>
                        <div
                          className="prose prose-pre:bg-slate-900 prose-pre:text-slate-100 max-w-none"
                          dangerouslySetInnerHTML={{ __html: statement.statement_html }}
                        />
                        {statement.sample_test_cases.length > 0 && (
                          <div className="mt-4">
                            <p className="mb-2 text-sm font-medium text-gray-700">Примеры</p>
                            <SampleTests tests={statement.sample_test_cases} />
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                  <CodeEditor
                    value={code}
                    onChange={setCode}
                    language={language}
                    onLanguageChange={handleLanguageChange}
                    onSubmit={handleSubmit}
                  />
                  {!isAuthenticated && (
                    <p className="text-center text-sm text-gray-500">
                      <Link to="/login" className="text-indigo-600 hover:text-indigo-700">
                        Войдите
                      </Link>
                      {' '}чтобы отправить решение
                    </p>
                  )}
                  {submitMutation.isPending && (
                    <p className="text-center text-sm text-gray-500">Отправка…</p>
                  )}
                  {activeSubmissionId && (
                    <SubmissionStatus submissionId={activeSubmissionId} />
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">Выберите задачу</h3>
                <p className="mt-1 text-gray-500">Нажмите на задачу слева, чтобы начать решение</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}