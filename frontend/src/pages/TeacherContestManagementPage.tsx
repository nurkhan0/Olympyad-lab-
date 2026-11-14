import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import {
  listContests,
  createContest,
  updateContest,
  deleteContest,
  publishContest,
  unpublishContest,
  addContestProblem,
  removeContestProblem,
  listContestProblems,
  listContestRegistrations,
  getContestStandings,
  type ContestList,
  type ContestRegistration,
  type ContestStanding,
  type CreateContestDto,
  type AddProblemDto,
} from '../api/contestsApi';
import { getManageableProblems } from '../api/problemsApi';
import DifficultyBadge from '../components/DifficultyBadge';
import { formatDateTime } from '../utils/date';
import FullPageSpinner from '../components/FullPageSpinner';
import useDebounce from '../hooks/useDebounce';
import { useAuthStore } from '../store/authStore';
import type { Difficulty, ManageableProblem } from '../types/problem';

/**
 * Inline problem composer. Submitted with the contest's add_problem endpoint,
 * which creates the problem as contest-only instead of adding it to the public
 * problem bank.
 */
type InlineCreateForm = {
  title: string;
  difficulty: Difficulty;
  statement: string;
  time_ms: number;
  memory_mb: number;
};

/** A problem being composed in the create-contest form. */
type ProblemDraft = InlineCreateForm & {
  points: number;
};

/** A composed problem, attached to the contest once it exists. */
type PendingProblem = ProblemDraft & {
  key: string;
  label: string;
};

const contestTypeLabels: Record<string, string> = {
  CF: 'Codeforces (CF)',
  ICPC: 'ICPC',
  IOI: 'IOI',
};

export default function TeacherContestManagementPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingContest, setEditingContest] = useState<ContestList | null>(null);
  const [showProblemsModal, setShowProblemsModal] = useState<ContestList | null>(null);
  const [showRegistrationsModal, setShowRegistrationsModal] = useState<ContestList | null>(null);
  const [showStandingsModal, setShowStandingsModal] = useState<ContestList | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['teacherContests'],
    queryFn: () => listContests({ ordering: '-start_time', page_size: 50 }),
  });

  const createMutation = useMutation({
    // The contest is created first so problems can reference it, then every
    // composed problem is attached. Problems are created contest-only, so a
    // failure here never leaks a half-configured contest into the problem bank.
    mutationFn: async ({ dto, problems }: { dto: CreateContestDto; problems: PendingProblem[] }) => {
      const created = await createContest(dto);
      const failed: string[] = [];
      for (const [index, problem] of problems.entries()) {
        try {
          await addContestProblem(created.id, {
            label: problem.label || String.fromCharCode(65 + index),
            points: problem.points,
            title: problem.title,
            statement: problem.statement,
            difficulty: problem.difficulty,
            time_ms: problem.time_ms,
            memory_mb: problem.memory_mb,
          });
        } catch (err: any) {
          failed.push(problem.title || `задача ${index + 1}`);
        }
      }
      return { contest: created, failed };
    },
    onSuccess: ({ failed }) => {
      queryClient.invalidateQueries({ queryKey: ['teacherContests'] });
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      setShowCreateModal(false);
      setCreateError(null);
      if (failed.length > 0) {
        toast.error(`Контест создан, но не добавлены: ${failed.join(', ')}`);
      } else {
        toast.success('Контест создан');
      }
    },
    onError: (err: any) => {
      setCreateError(err.response?.data?.detail || 'Ошибка создания');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: number; dto: Partial<CreateContestDto> }) => updateContest(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherContests'] });
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      setEditingContest(null);
      setEditError(null);
    },
    onError: (err: any) => {
      setEditError(err.response?.data?.detail || 'Ошибка обновления');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteContest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherContests'] });
      queryClient.invalidateQueries({ queryKey: ['contests'] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: number) => publishContest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherContests'] });
      queryClient.invalidateQueries({ queryKey: ['contests'] });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: number) => unpublishContest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherContests'] });
      queryClient.invalidateQueries({ queryKey: ['contests'] });
    },
  });

  if (isLoading) return <FullPageSpinner />;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="mx-auto max-w-7xl px-4 py-12">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Ошибка загрузки</h1>
            <p className="mt-2 text-gray-600">Попробуйте обновить страницу позже.</p>
          </div>
        </main>
      </div>
    );
  }

  const contests = data?.results || [];
  const myContests = contests.filter((c) => c.created_by_handle === user?.handle);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">🏆 Управление контестами</h1>
            <p className="mt-1 text-gray-600">Создавайте, редактируйте и управляйте своими соревнованиями</p>
          </div>
          <button
            onClick={() => {
              setCreateError(null);
              setShowCreateModal(true);
            }}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Создать контест
          </button>
        </div>

        {myContests.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">У вас пока нет контестов</h3>
            <p className="mt-1 text-gray-500">Создайте свой первый контест, нажав кнопку выше.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-1/3 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Контест</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Даты</th>
                  <th className="w-32 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Участники</th>
                  <th className="w-24 px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Задачи</th>
                  <th className="w-48 px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {myContests.map((contest) => (
                  <ContestRow
                    key={contest.id}
                    contest={contest}
                    onEdit={setEditingContest}
                    onProblems={setShowProblemsModal}
                    onRegistrations={setShowRegistrationsModal}
                    onStandings={setShowStandingsModal}
                    onPublish={publishMutation.mutate}
                    onUnpublish={unpublishMutation.mutate}
                    onDelete={deleteMutation.mutate}
                    publishPending={publishMutation.isPending}
                    unpublishPending={unpublishMutation.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || editingContest) && (
          <ContestFormModal
            contest={editingContest}
            onClose={() => {
              setShowCreateModal(false);
              setEditingContest(null);
              setCreateError(null);
              setEditError(null);
            }}
            onSubmit={editingContest
              ? (dto) => updateMutation.mutate({ id: editingContest.id, dto })
              : (dto, problems) => createMutation.mutate({ dto, problems })}
            isPending={editingContest ? updateMutation.isPending : createMutation.isPending}
            error={editingContest ? editError : createError}
          />
        )}

        {/* Problems Modal */}
        {showProblemsModal && (
          <ProblemsModal
            contest={showProblemsModal}
            onClose={() => setShowProblemsModal(null)}
          />
        )}

        {/* Registrations Modal */}
        {showRegistrationsModal && (
          <RegistrationsModal
            contest={showRegistrationsModal}
            onClose={() => setShowRegistrationsModal(null)}
          />
        )}

        {/* Standings Modal */}
        {showStandingsModal && (
          <StandingsModal
            contest={showStandingsModal}
            onClose={() => setShowStandingsModal(null)}
          />
        )}
      </main>
    </div>
  );
}

function ContestRow({
  contest,
  onEdit,
  onProblems,
  onRegistrations,
  onStandings,
  onPublish,
  onUnpublish,
  onDelete,
  publishPending,
  unpublishPending,
}: {
  contest: ContestList;
  onEdit: (c: ContestList) => void;
  onProblems: (c: ContestList) => void;
  onRegistrations: (c: ContestList) => void;
  onStandings: (c: ContestList) => void;
  onPublish: (id: number) => void;
  onUnpublish: (id: number) => void;
  onDelete: (id: number) => void;
  publishPending: boolean;
  unpublishPending: boolean;
}) {
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

  const publishedBadge = contest.is_published ? (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">Опубликован</span>
  ) : (
    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700">Черновик</span>
  );

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-4">
        <div>
          <p className="font-medium text-gray-900">{contest.title}</p>
          <p className="text-sm text-gray-500 truncate max-w-xs">{contest.description}</p>
          <div className="mt-1 flex items-center gap-2">
            {publishedBadge}
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
              {contestTypeLabels[contest.contest_type] || contest.contest_type}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">{statusBadge}</td>
      <td className="px-4 py-4 text-sm text-gray-700">
        <div>{formatDateTime(contest.start_time)}</div>
        <div className="text-gray-500">{formatDateTime(contest.end_time)}</div>
      </td>
      <td className="px-4 py-4 text-center text-sm text-gray-700">
        {contest.participant_count}{' '}
        {contest.max_participants && <span className="text-gray-400">/ {contest.max_participants}</span>}
      </td>
      <td className="px-4 py-4 text-center text-sm text-gray-700">{contest.problem_count}</td>
      <td className="px-4 py-4">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onEdit(contest)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Редактировать
          </button>
          <button
            onClick={() => onProblems(contest)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Задачи
          </button>
          <button
            onClick={() => onRegistrations(contest)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Регистрации
          </button>
          <button
            onClick={() => onStandings(contest)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Результаты
          </button>
          {contest.is_published ? (
            <button
              onClick={() => onUnpublish(contest.id)}
              disabled={unpublishPending}
              className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
            >
              Снять с публикации
            </button>
          ) : (
            <button
              onClick={() => onPublish(contest.id)}
              disabled={publishPending}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              Опубликовать
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('Удалить этот контест? Это действие необратимо.')) {
                onDelete(contest.id);
              }
            }}
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            Удалить
          </button>
        </div>
      </td>
    </tr>
  );
}

function ContestFormModal({
  contest,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  contest: ContestList | null;
  onClose: () => void;
  onSubmit: (dto: CreateContestDto, problems: PendingProblem[]) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<CreateContestDto>({
    title: '',
    description: '',
    rules: '',
    contest_type: 'CF',
    start_time: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    duration_minutes: 120,
    registration_start: '',
    registration_end: '',
    is_public: true,
    is_published: false,
    is_rated: true,
    max_participants: undefined,
  });

  // Problems composed while creating a contest. They are attached right after
  // the contest row is created, and stay contest-only.
  const [draft, setDraft] = useState<ProblemDraft>(EMPTY_DRAFT);
  const [pendingProblems, setPendingProblems] = useState<PendingProblem[]>([]);
  const [draftError, setDraftError] = useState<string | null>(null);

  const nextLabel = useMemo(() => {
    const used = new Set(pendingProblems.map((problem) => problem.label));
    for (let index = 0; index < 26; index += 1) {
      const candidate = String.fromCharCode(65 + index);
      if (!used.has(candidate)) return candidate;
    }
    return '';
  }, [pendingProblems]);

  const addDraftProblem = () => {
    if (!draft.title.trim() || !draft.statement.trim()) {
      setDraftError('Введите название и условие задачи');
      return;
    }
    if (!nextLabel) {
      setDraftError('Максимум 26 задач в контесте');
      return;
    }
    setPendingProblems((prev) => [
      ...prev,
      { ...draft, key: `draft-${Date.now()}-${prev.length}`, label: nextLabel, points: 100 },
    ]);
    setDraft(EMPTY_DRAFT);
    setDraftError(null);
  };

  // Sync the form when editing an existing contest. Done in an effect (not
  // during render) so re-saving an edit preserves rules and is_published.
  useEffect(() => {
    if (!contest) return;
    setForm({
      title: contest.title,
      description: contest.description,
      rules: contest.rules ?? '',
      contest_type: contest.contest_type,
      start_time: new Date(contest.start_time).toISOString().slice(0, 16),
      duration_minutes: contest.duration_minutes,
      registration_start: contest.registration_start ? new Date(contest.registration_start).toISOString().slice(0, 16) : '',
      registration_end: contest.registration_end ? new Date(contest.registration_end).toISOString().slice(0, 16) : '',
      is_public: contest.is_public,
      is_published: contest.is_published,
      is_rated: contest.is_rated,
      max_participants: contest.max_participants || undefined,
    });
  }, [contest]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dto: CreateContestDto = {
      ...form,
      registration_start: form.registration_start || undefined,
      registration_end: form.registration_end || undefined,
      max_participants: form.max_participants,
    };
    onSubmit(dto, contest ? [] : pendingProblems);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">{contest ? 'Редактировать контест' : 'Создать контест'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-700 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Название *</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Описание</label>
            <textarea
              name="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Правила</label>
            <textarea
              name="rules"
              value={form.rules}
              onChange={(e) => setForm({ ...form, rules: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Тип *</label>
              <select
                name="contest_type"
                value={form.contest_type}
                onChange={(e) => setForm({ ...form, contest_type: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="CF">Codeforces (CF)</option>
                <option value="ICPC">ICPC</option>
                <option value="IOI">IOI</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Начало *</label>
              <input
                type="datetime-local"
                name="start_time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Длительность (мин) *</label>
              <input
                type="number"
                name="duration_minutes"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                min="1"
                max="1440"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Начало регистрации</label>
              <input
                type="datetime-local"
                name="registration_start"
                value={form.registration_start}
                onChange={(e) => setForm({ ...form, registration_start: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Окончание регистрации</label>
              <input
                type="datetime-local"
                name="registration_end"
                value={form.registration_end}
                onChange={(e) => setForm({ ...form, registration_end: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Макс. участников</label>
              <input
                type="number"
                name="max_participants"
                value={form.max_participants || ''}
                onChange={(e) => setForm({ ...form, max_participants: e.target.value ? Number(e.target.value) : undefined })}
                min="1"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_public"
                checked={form.is_public}
                onChange={(e) => setForm({ ...form, is_public: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Публичный</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_published"
                checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Опубликован</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_rated"
                checked={form.is_rated}
                onChange={(e) => setForm({ ...form, is_rated: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">Рейтинговый</span>
            </label>
          </div>

          {!contest && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Задачи контеста</h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Можно создать сразу. Такие задачи видны только внутри контеста и не попадут
                  в общий список задач, пока контест не закончится.
                </p>
              </div>

              {draftError && <p className="text-xs text-red-600">{draftError}</p>}

              {pendingProblems.length > 0 && (
                <ul className="space-y-2">
                  {pendingProblems.map((problem) => (
                    <li
                      key={problem.key}
                      className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">
                          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded bg-indigo-100 text-xs font-bold text-indigo-700">
                            {problem.label}
                          </span>
                          {problem.title}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {problem.difficulty} · {problem.time_ms} мс · {problem.memory_mb} МБ ·{' '}
                          {problem.points} баллов
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingProblems((prev) => prev.filter((item) => item.key !== problem.key))
                        }
                        className="shrink-0 text-xs text-red-600 hover:underline"
                      >
                        Удалить
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700">Название задачи</label>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Сложность</label>
                  <select
                    value={draft.difficulty}
                    onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as Difficulty })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Баллы</label>
                  <input
                    type="number"
                    min={1}
                    value={draft.points}
                    onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Лимит времени (мс)</label>
                  <input
                    type="number"
                    min={100}
                    max={10000}
                    value={draft.time_ms}
                    onChange={(e) => setDraft({ ...draft, time_ms: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Память (МБ)</label>
                  <input
                    type="number"
                    min={16}
                    max={512}
                    value={draft.memory_mb}
                    onChange={(e) => setDraft({ ...draft, memory_mb: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700">Условие (Markdown)</label>
                  <textarea
                    value={draft.statement}
                    onChange={(e) => setDraft({ ...draft, statement: e.target.value })}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addDraftProblem}
                  className="rounded-lg border border-indigo-300 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                >
                  + Добавить задачу в контест
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? 'Сохранение...' : contest ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const EMPTY_CREATE_FORM: InlineCreateForm = {
  title: '',
  difficulty: 'easy',
  statement: '',
  time_ms: 1000,
  memory_mb: 256,
};

const EMPTY_DRAFT: ProblemDraft = {
  ...EMPTY_CREATE_FORM,
  points: 100,
};

function ProblemsModal({ contest, onClose }: { contest: ContestList; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [mode, setMode] = useState<'pick' | 'create'>('pick');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [selected, setSelected] = useState<ManageableProblem | null>(null);
  const [form, setForm] = useState<AddProblemDto>({ problem: '', label: '', points: 100 });
  const [createForm, setCreateForm] = useState<InlineCreateForm>(EMPTY_CREATE_FORM);
  const [tagsInput, setTagsInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invalidateContestProblems = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['contestProblems', contest.id] }),
      queryClient.invalidateQueries({ queryKey: ['teacherContests'] }),
      queryClient.invalidateQueries({ queryKey: ['contests'] }),
    ]);

  const { data: problems = [], isLoading: problemsLoading } = useQuery({
    queryKey: ['contestProblems', contest.id],
    queryFn: () => listContestProblems(contest.id),
  });

  const { data: availablePage, isLoading: availableLoading } = useQuery({
    queryKey: ['manageableProblems', debouncedSearch],
    queryFn: () =>
      getManageableProblems({ search: debouncedSearch || undefined }).then((res) => res.data),
  });
  const available = availablePage?.results ?? [];
  // The picker shows a single page: tell the teacher when the list is cut off.
  const availableTruncated = (availablePage?.count ?? 0) > available.length;

  const removeMutation = useMutation({
    mutationFn: (problemId: string) => removeContestProblem(contest.id, problemId),
    onSuccess: invalidateContestProblems,
    onError: (err: any) => setError(err.response?.data?.error || 'Не удалось удалить задачу'),
  });

  const nextLabel = useMemo(() => {
    const used = new Set(problems.map((p) => p.label));
    for (let i = 0; i < 26; i += 1) {
      const candidate = String.fromCharCode(65 + i);
      if (!used.has(candidate)) return candidate;
    }
    return '';
  }, [problems]);

  // Pre-fill the next free label without clobbering anything the teacher typed.
  useEffect(() => {
    setForm((prev) => (prev.label ? prev : { ...prev, label: nextLabel }));
  }, [nextLabel]);

  const resetForm = () => {
    setSelected(null);
    setCreateForm(EMPTY_CREATE_FORM);
    setTagsInput('');
    // Label is re-filled by the effect once the refreshed list arrives, so the
    // just-added label is not offered twice.
    setForm({ problem: '', label: '', points: 100 });
    setMode('pick');
    setSearchInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.label.trim()) {
      setError('Введите метку задачи');
      return;
    }

    // Pick mode addresses an existing problem; create mode composes a new one
    // inline. Inline problems are created contest-only, so they never show up in
    // the public problem bank while the tournament is running.
    let payload: AddProblemDto;
    if (mode === 'pick') {
      if (!selected?.id) {
        setError('Выберите задачу из списка');
        return;
      }
      payload = { ...form, problem: selected.id };
    } else {
      if (!createForm.title.trim() || !createForm.statement.trim()) {
        setError('Введите название и условие задачи');
        return;
      }
      payload = {
        ...form,
        title: createForm.title.trim(),
        statement: createForm.statement,
        difficulty: createForm.difficulty,
        time_ms: createForm.time_ms,
        memory_mb: createForm.memory_mb,
        tags: tagsInput
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      };
    }

    setIsSubmitting(true);
    try {
      await addContestProblem(contest.id, payload);
      await invalidateContestProblems();
      await queryClient.invalidateQueries({ queryKey: ['manageableProblems'] });
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка добавления задачи');
    } finally {
      setIsSubmitting(false);
    }
  };

  const testsHref = (slug: string) => (isAdmin ? `/admin/problems/${slug}/edit` : '/teacher/problems');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Задачи: {contest.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-700 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
            {([
              { value: 'pick', label: 'Выбрать из базы' },
              { value: 'create', label: 'Создать с нуля' },
            ] as const).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setMode(tab.value);
                  setError(null);
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  mode === tab.value ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode === 'pick' ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Поиск задачи</label>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Начните вводить название или slug…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
              />
              <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                {availableLoading ? (
                  <p className="p-3 text-sm text-gray-500">Загрузка задач…</p>
                ) : available.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500">
                    Задач не найдено. Переключитесь на «Создать с нуля».
                  </p>
                ) : (
                  available.map((p) => {
                    const isSelected = selected?.id === p.id;
                    const alreadyAdded = problems.some((cp) => cp.problem === p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => setSelected(p)}
                        className={`flex w-full items-start gap-3 p-3 text-left ${
                          isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                        } ${alreadyAdded ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            isSelected ? 'border-indigo-600' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <span className="h-2 w-2 rounded-full bg-indigo-600" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900">{p.title}</span>
                            <DifficultyBadge difficulty={p.difficulty} />
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                p.status === 'published'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {p.status === 'published' ? 'Опубликовано' : 'Черновик'}
                            </span>
                            {p.is_author && (
                              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                                Моя
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-gray-500">{p.slug}</span>
                        </span>
                        {alreadyAdded && <span className="text-xs text-gray-400">уже в контесте</span>}
                      </button>
                    );
                  })
                )}
              </div>
              {availableTruncated && (
                <p className="text-xs text-gray-500">
                  Показаны первые {available.length} из {availablePage?.count}. Уточните поиск, чтобы найти нужную задачу.
                </p>
              )}
              {selected?.status === 'draft' && (
                <p className="text-xs text-yellow-700">
                  Это черновик: без тестов задача не будет проверяться.{' '}
                  <Link to={testsHref(selected.slug)} className="underline" onClick={onClose}>
                    Загрузить тесты
                  </Link>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Название *</label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Сложность *</label>
                  <select
                    value={createForm.difficulty}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, difficulty: e.target.value as Difficulty })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Теги (через запятую)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="math, dp"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Лимит времени (мс) *</label>
                  <input
                    type="number"
                    min={100}
                    max={10000}
                    value={createForm.time_ms}
                    onChange={(e) => setCreateForm({ ...createForm, time_ms: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Память (МБ) *</label>
                  <input
                    type="number"
                    min={16}
                    max={512}
                    value={createForm.memory_mb}
                    onChange={(e) => setCreateForm({ ...createForm, memory_mb: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Условие (Markdown) *</label>
                  <textarea
                    value={createForm.statement}
                    onChange={(e) => setCreateForm({ ...createForm, statement: e.target.value })}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Задача будет создана только для этого контеста: в общем списке задач она не
                появится, пока контест не закончится. Тесты для проверки загружаются на
                странице задач после создания.
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Метка (A, B, C...) *</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                required
                maxLength={5}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Баллы *</label>
              <input
                type="number"
                min={1}
                value={form.points}
                onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {mode === 'pick'
                ? selected
                  ? `Выбрана: ${selected.title}`
                  : 'Задача не выбрана'
                : 'Будет создана новая задача для этого контеста'}
            </p>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSubmitting
                ? mode === 'pick'
                  ? 'Добавление…'
                  : 'Создание…'
                : mode === 'pick'
                  ? 'Добавить в контест'
                  : 'Создать и добавить'}
            </button>
          </div>
        </form>

        {problemsLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Загрузка задач…</p>
          </div>
        ) : problems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Задач пока нет. Выберите задачу из базы или создайте новую.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...problems]
              .sort((a, b) => a.order - b.order)
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold">{p.label}</span>
                    <div>
                      <p className="font-medium text-gray-900">{p.problem_title}</p>
                      <p className="text-sm text-gray-500">
                        Порядок: {p.order} • {p.points} баллов • {p.problem_difficulty}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMutation.mutate(String(p.problem))}
                    disabled={removeMutation.isPending}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Удалить
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RegistrationsModal({
  contest,
  onClose,
}: {
  contest: ContestList;
  onClose: () => void;
}) {
  const {
    data: registrations = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['contestRegistrations', contest.id],
    queryFn: () => listContestRegistrations(contest.id),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Регистрации: {contest.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {isLoading ? (
          <p className="text-gray-500">Загрузка регистраций…</p>
        ) : isError ? (
          <p className="text-red-600">Не удалось загрузить регистрации.</p>
        ) : registrations.length === 0 ? (
          <p className="text-gray-500">Пока никто не зарегистрировался.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {registrations.map((r: ContestRegistration) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <span className="font-medium text-gray-900">{r.user_handle}</span>
                <span className="text-sm text-gray-500">{formatDateTime(r.registered_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 text-sm text-gray-500">
          <p>Всего участников: {contest.participant_count}</p>
        </div>
      </div>
    </div>
  );
}

function StandingsModal({
  contest,
  onClose,
}: {
  contest: ContestList;
  onClose: () => void;
}) {
  const {
    data: standings = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['contestStandings', contest.id],
    queryFn: () => getContestStandings(contest.id),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Результаты: {contest.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {isLoading ? (
          <p className="text-gray-500">Загрузка результатов…</p>
        ) : isError ? (
          <p className="text-red-600">Не удалось загрузить результаты.</p>
        ) : standings.length === 0 ? (
          <p className="text-gray-500">Пока нет результатов.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="py-2 pr-4">Место</th>
                <th className="py-2 pr-4">Участник</th>
                <th className="py-2 pr-4">Балл</th>
                <th className="py-2 pr-4">Решено</th>
                <th className="py-2">Штраф</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s: ContestStanding) => (
                <tr key={s.user_id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-4 font-medium">{s.rank}</td>
                  <td className="py-2 pr-4">{s.handle}</td>
                  <td className="py-2 pr-4">{s.total_score}</td>
                  <td className="py-2 pr-4">{s.solved_count}</td>
                  <td className="py-2">{s.penalty_time} мин</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}