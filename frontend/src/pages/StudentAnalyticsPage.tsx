import { useQuery } from '@tanstack/react-query';

import { getStudentAnalytics } from '../api/educationApi';
import type { StudentAnalytics } from '../types/education';

function StudentAnalyticsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 animate-pulse">
            <div className="h-4 w-1/2 rounded bg-gray-200 mb-3" />
            <div className="h-8 w-1/3 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudentAnalyticsPage() {
  const { data: stats, isLoading, isError } = useQuery<StudentAnalytics>({
    queryKey: ['student-analytics'],
    queryFn: () => getStudentAnalytics().then((res) => res.data),
  });

  if (isLoading) {
    return <StudentAnalyticsSkeleton />;
  }

  if (isError || !stats) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900">Не удалось загрузить статистику</h1>
        <p className="mt-2 text-gray-500">Попробуйте обновить страницу позже.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Моя статистика</h1>
        <p className="mt-1 text-gray-500">
          Все метрики подсчитаны из реальных посылок и прогресса обучения.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Всего посылок"
          value={stats.total_submissions}
          subtitle="Попыток отправки решений"
        />
        <StatCard
          title="Принято (AC)"
          value={stats.accepted_submissions}
          subtitle="Решений с вердиктом Accepted"
          variant="success"
        />
        <StatCard
          title="Точность"
          value={`${stats.accuracy}%`}
          subtitle="Соотношения принятых к общему числу"
        />
        <StatCard
          title="Задач решено"
          value={stats.solved_problems}
          subtitle="Уникальных задач со статусом solved"
          variant="success"
        />
        <StatCard
          title="Активных курсов"
          value={stats.active_courses}
          subtitle="Курсов со статусом active"
        />
        <StatCard
          title="Занятий завершено"
          value={stats.lessons_completed}
          subtitle="Занятий со статусом completed"
          variant="success"
        />
      </div>

      <div className="mt-12 rounded-xl border border-gray-200 bg-white shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          Краткая сводка
        </h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            Вы отправили <strong>{stats.total_submissions}</strong> посылок, из них{' '}
            <strong>{stats.accepted_submissions}</strong> принято.
          </p>
          <p>
            Решено уникальных задач: <strong>{stats.solved_problems}</strong>.
          </p>
            <p>
              Активных записей на курсы: <strong>{stats.active_courses}</strong>, завершено занятий: <strong>{stats.lessons_completed}</strong>.
            </p>
          <p>
            Общая точность: <strong>{stats.accuracy}%</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  variant = 'default',
}: {
  title: string;
  value: number | string;
  subtitle: string;
  variant?: 'default' | 'success';
}) {
  const borderColor =
    variant === 'success' ? 'border-emerald-100' : 'border-gray-200';
  const bgColor = variant === 'success' ? 'bg-emerald-50' : 'bg-white';
  const iconColor = variant === 'success' ? 'text-emerald-600' : 'text-indigo-600';

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-6`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`flex items-center gap-2 ${iconColor}`}>
          {variant === 'success' ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          )}
          <span className="text-sm font-semibold">{title}</span>
        </div>
      </div>
      <div className={`text-2xl font-bold ${variant === 'success' ? 'text-emerald-700' : 'text-gray-900'}`}>{value}</div>
      <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
    </div>
  );
}
