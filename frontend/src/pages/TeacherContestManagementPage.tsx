import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
import { formatDateTime } from '../utils/date';
import Navbar from '../components/Navbar';
import FullPageSpinner from '../components/FullPageSpinner';
import { useAuthStore } from '../store/authStore';

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
  const [problemsError, setProblemsError] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['teacherContests'],
    queryFn: () => listContests({ ordering: '-start_time', page_size: 50 }),
  });

  const createMutation = useMutation({
    mutationFn: (dto: CreateContestDto) => createContest(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherContests'] });
      queryClient.invalidateQueries({ queryKey: ['contests'] });
      setShowCreateModal(false);
      setCreateError(null);
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

  const addProblemMutation = useMutation({
    mutationFn: ({ contestId, dto }: { contestId: number; dto: AddProblemDto }) => addContestProblem(contestId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contestProblems', showProblemsModal?.id] });
      queryClient.invalidateQueries({ queryKey: ['teacherContests'] });
      setProblemsError(null);
    },
    onError: (err: any) => {
      setProblemsError(err.response?.data?.error || 'Ошибка добавления задачи');
    },
  });

  const removeProblemMutation = useMutation({
    mutationFn: ({ contestId, problemId }: { contestId: number; problemId: string }) => removeContestProblem(contestId, problemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contestProblems', showProblemsModal?.id] });
      queryClient.invalidateQueries({ queryKey: ['teacherContests'] });
    },
  });

  if (isLoading) return <FullPageSpinner />;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
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
      <Navbar />
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
              : createMutation.mutate}
            isPending={editingContest ? updateMutation.isPending : createMutation.isPending}
            error={editingContest ? editError : createError}
          />
        )}

        {/* Problems Modal */}
        {showProblemsModal && (
          <ProblemsModal
            contest={showProblemsModal}
            onClose={() => setShowProblemsModal(null)}
            onAddProblem={addProblemMutation.mutate}
            onRemoveProblem={removeProblemMutation.mutate}
            addPending={addProblemMutation.isPending}
            removePending={removeProblemMutation.isPending}
            error={problemsError}
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
  onSubmit: (dto: CreateContestDto) => void;
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
    onSubmit(dto);
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

function ProblemsModal({
  contest,
  onClose,
  onAddProblem,
  onRemoveProblem,
  addPending,
  removePending,
  error,
}: {
  contest: ContestList;
  onClose: () => void;
  onAddProblem: ({ contestId, dto }: { contestId: number; dto: AddProblemDto }) => void;
  onRemoveProblem: ({ contestId, problemId }: { contestId: number; problemId: string }) => void;
  addPending: boolean;
  removePending: boolean;
  error: string | null;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddProblemDto>({
    problem: '',
    label: '',
    order: 0,
    points: 100,
  });
  const [addError, setAddError] = useState<string | null>(null);

  // Real fetch: the modal must always show the contest's current problems.
  const {
    data: problems = [],
    isLoading: problemsLoading,
  } = useQuery({
    queryKey: ['contestProblems', contest.id],
    queryFn: () => listContestProblems(contest.id),
  });

  const handleAddProblem = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    onAddProblem({ contestId: contest.id, dto: addForm });
    setAddForm({ problem: '', label: '', order: 0, points: 100 });
    setShowAddForm(false);
  };

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

        {(error || addError) && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-700 text-sm">{error || addError}</div>
        )}

        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowAddForm(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Добавить задачу
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddProblem} className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
            <h3 className="font-medium text-gray-900">Добавить задачу</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Problem ID (UUID) *</label>
                <input
                  type="text"
                  name="problem"
                  value={addForm.problem}
                  onChange={(e) => setAddForm({ ...addForm, problem: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Метка (A, B, C...) *</label>
                <input
                  type="text"
                  name="label"
                  value={addForm.label}
                  onChange={(e) => setAddForm({ ...addForm, label: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  required
                  maxLength={5}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Порядок *</label>
                <input
                  type="number"
                  name="order"
                  value={addForm.order}
                  onChange={(e) => setAddForm({ ...addForm, order: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  required
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Баллы *</label>
                <input
                  type="number"
                  name="points"
                  value={addForm.points}
                  onChange={(e) => setAddForm({ ...addForm, points: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  required
                  min={1}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={addPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {addPending ? 'Добавление...' : 'Добавить'}
              </button>
            </div>
          </form>
        )}

        {problemsLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Загрузка задач…</p>
          </div>
        ) : problems.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Задач пока нет. Нажмите «Добавить задачу».</p>
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
                    onClick={() => onRemoveProblem({ contestId: contest.id, problemId: String(p.problem) })}
                    disabled={removePending}
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