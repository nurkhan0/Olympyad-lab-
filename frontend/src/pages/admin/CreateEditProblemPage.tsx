import { zodResolver } from '@hookform/resolvers/zod';
import Editor from '@monaco-editor/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { Link, useNavigate, useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';
import { z } from 'zod';

import {
  createProblem,
  draftProblem,
  getAdminProblem,
  publishProblem,
  updateProblem,
} from '../../api/adminApi';
import TestCaseManager from '../../components/admin/TestCaseManager';

const problemSchema = z.object({
  title: z.string().min(1, 'Обязательное поле'),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']),
  time_ms: z.coerce.number().min(100, 'Минимум 100').max(10000, 'Максимум 10000'),
  memory_mb: z.coerce.number().min(16, 'Минимум 16').max(512, 'Максимум 512'),
  statement: z.string().min(1, 'Обязательное поле'),
});

type ProblemForm = z.infer<typeof problemSchema>;

type StatementTab = 'editor' | 'preview' | 'split';

export default function CreateEditProblemPage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(slug);

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [statementTab, setStatementTab] = useState<StatementTab>('editor');
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ProblemForm>({
    resolver: zodResolver(problemSchema),
    defaultValues: {
      title: '',
      difficulty: 'easy',
      time_ms: 1000,
      memory_mb: 256,
      statement: '',
    },
  });

  const statement = watch('statement');

  const { data: problem, isLoading } = useQuery({
    queryKey: ['admin-problem', slug],
    queryFn: () => getAdminProblem(slug!).then((res) => res.data),
    enabled: isEdit,
  });

  useEffect(() => {
    if (problem) {
      reset({
        title: problem.title,
        difficulty: problem.difficulty,
        time_ms: problem.time_ms,
        memory_mb: problem.memory_mb,
        statement: problem.statement,
      });
      setTags(problem.tags.map((tag) => tag.name));
    }
  }, [problem, reset]);

  const buildPayload = (data: ProblemForm) => ({
    title: data.title,
    difficulty: data.difficulty,
    time_ms: data.time_ms,
    memory_mb: data.memory_mb,
    statement: data.statement,
    tags,
  });

  const addTag = (raw: string) => {
    const value = raw.trim().replace(/,$/, '');
    if (value && !tags.includes(value)) {
      setTags((prev) => [...prev, value]);
    }
    setTagInput('');
  };

  const handleTagKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(tagInput);
    }
  };

  const handleSaveDraft = handleSubmit(async (data) => {
    setIsSaving(true);
    try {
      const payload = buildPayload(data);
      if (isEdit && slug) {
        await updateProblem(slug, payload);
        if (problem?.status === 'published') {
          await draftProblem(slug);
        }
        toast.success('Сохранено');
      } else {
        const res = await createProblem(payload);
        navigate(`/admin/problems/${res.data.slug}/edit`);
      }
    } catch {
      toast.error('Не удалось сохранить');
    } finally {
      setIsSaving(false);
    }
  });

  const handlePublish = handleSubmit(async (data) => {
    setIsSaving(true);
    try {
      const payload = buildPayload(data);
      let problemSlug = slug;

      if (isEdit && slug) {
        await updateProblem(slug, payload);
      } else {
        const res = await createProblem(payload);
        problemSlug = res.data.slug;
      }

      if (problemSlug) {
        await publishProblem(problemSlug);
        toast.success('Опубликовано');
        if (!isEdit) {
          navigate(`/admin/problems/${problemSlug}/edit`);
        }
      }
    } catch {
      toast.error('Не удалось опубликовать');
    } finally {
      setIsSaving(false);
    }
  });

  if (isEdit && isLoading) {
    return <p className="text-gray-500">Загрузка...</p>;
  }

  const statementTabs: { value: StatementTab; label: string }[] = [
    { value: 'editor', label: 'Редактор' },
    { value: 'preview', label: 'Предпросмотр' },
    { value: 'split', label: 'Разделить' },
  ];

  return (
    <form className="mx-auto max-w-4xl space-y-8">
      <div>
        <Link to="/admin/problems" className="text-sm text-indigo-600 hover:text-indigo-700">
          ← К списку задач
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">
          {isEdit ? 'Редактировать задачу' : 'Новая задача'}
        </h1>
      </div>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Основное</h2>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Название</label>
          <input
            {...register('title')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Сложность</label>
            <select
              {...register('difficulty')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Время (мс)</label>
            <input
              type="number"
              step={100}
              {...register('time_ms')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            {errors.time_ms && <p className="mt-1 text-xs text-red-600">{errors.time_ms.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Память (МБ)</label>
            <input
              type="number"
              {...register('memory_mb')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            {errors.memory_mb && (
              <p className="mt-1 text-xs text-red-600">{errors.memory_mb.message}</p>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Теги</h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-sm text-indigo-800"
            >
              {tag}
              <button
                type="button"
                onClick={() => setTags((prev) => prev.filter((item) => item !== tag))}
                className="text-indigo-600 hover:text-indigo-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
          onBlur={() => tagInput && addTag(tagInput)}
          placeholder="Добавить тег (Enter или запятая)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </section>

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Условие</h2>

        <div className="flex border-b border-gray-200">
          {statementTabs.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setStatementTab(item.value)}
              className={`px-4 py-2 text-sm font-medium ${
                statementTab === item.value
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {errors.statement && (
          <p className="text-xs text-red-600">{errors.statement.message}</p>
        )}

        {statementTab === 'editor' && (
          <div className="overflow-hidden rounded-lg border border-gray-700">
            <Editor
              height="400px"
              language="markdown"
              theme="vs-dark"
              value={statement}
              onChange={(value) => setValue('statement', value ?? '', { shouldValidate: true })}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        )}

        {statementTab === 'preview' && (
          <div className="prose max-w-none rounded-lg border border-gray-200 bg-white p-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{statement}</ReactMarkdown>
          </div>
        )}

        {statementTab === 'split' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-gray-700">
              <Editor
                height="400px"
                language="markdown"
                theme="vs-dark"
                value={statement}
                onChange={(value) => setValue('statement', value ?? '', { shouldValidate: true })}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
            <div className="prose max-w-none overflow-y-auto rounded-lg border border-gray-200 bg-white p-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{statement}</ReactMarkdown>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Тест-кейсы</h2>
        <TestCaseManager problemSlug={slug ?? null} />
      </section>

      <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-6">
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSaveDraft}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Сохранить как черновик
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={handlePublish}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Опубликовать
        </button>
        <Link
          to="/admin/problems"
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Отмена
        </Link>
      </div>
    </form>
  );
}
