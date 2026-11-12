import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { getProblem } from '../api/problemsApi';
import { createSubmission } from '../api/submissionsApi';
import CodeEditor, { DEFAULT_SNIPPETS, type EditorLanguage } from '../components/CodeEditor';
import DifficultyBadge from '../components/DifficultyBadge';
import SampleTests from '../components/SampleTests';
import SubmissionStatus from '../components/SubmissionStatus';
import { useAuthStore } from '../store/authStore';

function DetailSkeleton() {
  return (
    <div className="grid animate-pulse gap-8 lg:grid-cols-[56%_44%]">
      <div className="space-y-4">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="h-8 w-3/4 rounded bg-gray-200" />
        <div className="h-5 w-48 rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-6 w-16 rounded-full bg-gray-200" />
          <div className="h-6 w-16 rounded-full bg-gray-200" />
        </div>
        <div className="h-px bg-gray-200" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-gray-200" />
          <div className="h-4 w-full rounded bg-gray-200" />
          <div className="h-4 w-2/3 rounded bg-gray-200" />
        </div>
        <div className="h-px bg-gray-200" />
        <div className="h-24 rounded bg-gray-200" />
      </div>
      <div className="h-[560px] rounded-xl bg-gray-200" />
    </div>
  );
}

export default function ProblemDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [language, setLanguage] = useState<EditorLanguage>('cpp');
  const [code, setCode] = useState(DEFAULT_SNIPPETS.cpp);
  const [activeSubmissionId, setActiveSubmissionId] = useState<number | null>(null);

  const handleLanguageChange = (lang: string) => {
    const next = lang as EditorLanguage;
    if (next === language) return;
    if (window.confirm('Сбросить код?')) {
      setLanguage(next);
      setCode(DEFAULT_SNIPPETS[next]);
    }
  };

  const { data: problem, isLoading, isError, error } = useQuery({
    queryKey: ['problem', slug],
    queryFn: () => getProblem(slug!).then((res) => res.data),
    enabled: Boolean(slug),
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      console.log('problem id:', problem?.id);
      console.log('language:', language);
      console.log('code length:', code.length);
      return createSubmission({
        problem: problem!.id,
        code,
        language,
      });
    },
    onSuccess: (response) => {
      setActiveSubmissionId(response.id);
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      toast.success('Solution submitted');
    },
    onError: () => {
      toast.error('Failed to submit solution');
    },
  });

  const handleSubmit = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!problem) {
      return;
    }
    submitMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <DetailSkeleton />
      </div>
    );
  }

  if (isError && isAxiosError(error) && error.response?.status === 404) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900">Задача не найдена</h1>
        <p className="mt-2 text-gray-500">Возможно, она была удалена или ещё не опубликована.</p>
        <Link
          to="/problems"
          className="mt-6 inline-block text-indigo-600 hover:text-indigo-700"
        >
          ← Назад к задачам
        </Link>
      </div>
    );
  }

  if (!problem) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[56%_44%]">
        <div>
          <button
            type="button"
            onClick={() => navigate('/problems')}
            className="mb-4 text-sm text-indigo-600 hover:text-indigo-700"
          >
            ← Назад к задачам
          </button>

          <h1 className="text-2xl font-bold text-gray-900">{problem.title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <DifficultyBadge difficulty={problem.difficulty} />
            <span>⏱ {problem.time_ms}ms</span>
            <span>💾 {problem.memory_mb}MB</span>
            {isAuthenticated && (
              <Link
                to={`/problems/${problem.slug}/submissions`}
                className="text-indigo-600 hover:text-indigo-700"
              >
                My submissions →
              </Link>
            )}
          </div>

          {problem.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {problem.tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => navigate(`/problems?tag=${tag.slug}`)}
                  className="rounded bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}

          <hr className="my-6 border-gray-200" />

          <div
            className="prose prose-pre:bg-slate-900 prose-pre:text-slate-100 max-w-none"
            dangerouslySetInnerHTML={{ __html: problem.statement_html }}
          />

          <hr className="my-6 border-gray-200" />

          <SampleTests tests={problem.sample_test_cases} />
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
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
            <p className="text-center text-sm text-gray-500">Submitting…</p>
          )}
          {activeSubmissionId && (
            <SubmissionStatus submissionId={activeSubmissionId} />
          )}
        </div>
      </div>
    </div>
  );
}
