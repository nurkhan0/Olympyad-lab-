import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getCourseAnalytics } from '../api/educationApi';
import type { CourseAnalytics } from '../types/education';

function CourseAnalyticsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900 animate-pulse mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 animate-pulse">
              <div className="h-4 w-full rounded bg-gray-200 mb-3" />
              <div className="h-8 w-3/4 rounded bg-gray-200" />
            </div>
          ))}
        </div>
        <div className="lg:col-span-8">
          <div className="rounded-xl border border-gray-200 bg-white h-96 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function CourseAnalyticsPage() {
  const { courseId } = useParams<{ courseId: string }>();

  const { data: analytics, isLoading, isError } = useQuery<CourseAnalytics>({
    queryKey: ['course-analytics', courseId],
    queryFn: () =>
      getCourseAnalytics(courseId!).then((res) => res.data),
    enabled: Boolean(courseId),
  });

  if (isLoading) {
    return <CourseAnalyticsSkeleton />;
  }

  if (isError || !analytics) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Не удалось загрузить аналитику курса
        </h1>
        <p className="mt-2 text-gray-500">Попробуйте обновить страницу позже.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Аналитика курса: {analytics.course_title}
          </h1>
          <p className="mt-1 text-gray-500">
            Все метрики подсчитаны из реальных посылок записанных студентов.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">
            Задач в курсе: {analytics.problem_count}
          </p>
          <p className="text-xs text-gray-500">Записано студентов: {analytics.students.length}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                Студент
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">
                Прогресс
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">
                Занятий
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">
                Посылок
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">
                Принято
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">
                Точность
              </th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">
                Решено задач
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {analytics.students.map((row) => (
              <tr key={row.student.id}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      <img
                        className="h-8 w-8 rounded-full bg-gray-200"
                        src={row.student.avatar_url || '/placeholder-avatar.svg'}
                        alt=""
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {row.student.handle}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {row.progress}%
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm text-gray-600">
                    {row.lessons_completed}/{row.lessons_total}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm text-gray-600">{row.attempts}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm text-gray-600">{row.accepted_submissions}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm text-gray-600">{row.accuracy}%</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="text-sm font-medium text-gray-900">
                    {row.solved_problems}
                  </span>
                </td>
              </tr>
            ))}
            {analytics.students.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Нет записанных студентов.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
