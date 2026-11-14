import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { createManageableProblem, getManageableProblems } from '../../api/problemsApi';
import DifficultyBadge from '../../components/DifficultyBadge';
import TestCaseManager from '../../components/admin/TestCaseManager';
import useDebounce from '../../hooks/useDebounce';
import type {
  CreateManageableProblemPayload,
  ManageableProblem,
  ManageableProblemFilters,
  PaginatedManageableProblems,
  ProblemStatus,
} from '../../types/problem';

const STATUS_TABS: { value: 'all' | ProblemStatus; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'draft', label: 'Черновики' },
  { value: 'published', label: 'Опубликованные' },
];

const EMPTY_FORM: CreateManageableProblemPayload = {
  title: '',
  difficulty: 'easy',
  statement: '',
  time_ms: 1000,
  memory_mb: 256,
  tags: [],
};

export default function TeacherProblemsPage() {
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState<'all' | ProblemStatus>('all');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [active, setActive] = useState<ManageableProblem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateManageableProblemPayload>(EMPTY_FORM);
  const [tagsInput, setTagsInput] = useState('');

  const filters = useMemo<ManageableProblemFilters>(
    () => ({
      status: statusTab === 'all' ? undefined : statusTab,
      search: debouncedSearch || undefined,
    }),
    [statusTab, debouncedSearch],
  );

  const { data, isLoading } = useQuery({
    queryKey: ['manageableProblems', filters],
    queryFn: () => getManageableProblems(filters).then((res) => res.data as PaginatedManageableProblems),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateManageableProblemPayload) =>
      createManageableProblem(payload).then((res) => res.data),
    onSuccess: (problem) => {
      queryClient.invalidateQueries({ queryKey: ['manageableProblems'] });
      setForm(EMPTY_FORM);
      setTagsInput('');
      setShowCreate(false);
      setActive(problem);
      toast.success(`Задача «${problem.title}» создана. Загрузите тесты.`);
    },
    onError: (err: any) => {
      const data = err.response?.data;
      toast.error(data?.detail || data?.title?.[0] || data?.statement?.[0] || 'Не удалось создать задачу');
    },
  });

  const problems = data?.results ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      tags: tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мои задачи</h1>
          <p className="mt-1 text-sm text-gray-600">
            Здесь задачи, которые вы можете добавить в контест, и загрузка тестов для них.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((prev) => !prev)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          {showCreate ? 'Скрыть форму' : '+ Создать задачу'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Название *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Сложность *</label>
              <select
                value={form.difficulty}
                onChange={(e) =>
                  setForm({ ...form, difficulty: e.target.value as CreateManageableProblemPayload['difficulty'] })
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
                value={form.time_ms}
                onChange={(e) => setForm({ ...form, time_ms: Number(e.target.value) })}
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
                value={form.memory_mb}
                onChange={(e) => setForm({ ...form, memory_mb: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Условие (Markdown) *</label>
              <textarea
                value={form.statement}
                onChange={(e) => setForm({ ...form, statement: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Новая задача создаётся черновиком — опубликует её администратор.</p>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Создание…' : 'Создать'}
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Поиск по названию…"
          className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusTab(tab.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                statusTab === tab.value ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-500">Загрузка задач…</p>
      ) : problems.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
          Задач нет. Создайте первую — она появится в списке для контестов.
        </p>
      ) : (
        <div className="space-y-2">
          {problems.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setActive(active?.id === p.id ? null : p)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
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
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {p.slug} • {p.solver_count} решений
                    {p.tags.length > 0 && ` • ${p.tags.map((t) => t.name).join(', ')}`}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">UUID: {p.id.slice(0, 8)}…</span>
                  <button
                    type="button"
                    onClick={() => setActive(active?.id === p.id ? null : p)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {active?.id === p.id ? 'Скрыть тесты' : 'Тесты'}
                  </button>
                </div>
              </div>
              {active?.id === p.id && (
                <div className="mt-4 border-t border-gray-100 pt-4">
                  <TestCaseManager problemSlug={p.slug} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}