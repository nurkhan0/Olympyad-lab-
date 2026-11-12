import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { listEnrollments } from '../../api/educationApi';
import type { Enrollment } from '../../types/education';

export default function StudentListPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'all' | 'active' | 'completed'>('all');

  const { data: enrollments, isLoading } = useQuery<Enrollment[]>({
    queryKey: ['teacher-enrollments'],
    queryFn: () => listEnrollments(),
  });

  const enrollmentList = enrollments ?? [];

  const filtered = enrollmentList.filter((e) => {
    if (viewMode === 'active') return e.status === 'active';
    if (viewMode === 'completed') return e.status === 'completed';
    return true;
  });

  const activeCount = enrollmentList.filter((e) => e.status === 'active').length;
  const completedCount = enrollmentList.filter((e) => e.status === 'completed').length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Студенты</h1>
          <p className="text-sm text-gray-500">
            Записанные студенты на ваши курсы.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              viewMode === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Все ({enrollmentList.length})
          </button>
          <button
            onClick={() => setViewMode('active')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              viewMode === 'active'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Активные ({activeCount})
          </button>
          <button
            onClick={() => setViewMode('completed')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              viewMode === 'completed'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Завершённые ({completedCount})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
            <div className="h-4 w-1/3 rounded bg-gray-200 mb-4" />
            <div className="h-4 w-full rounded bg-gray-200" />
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <div className="mx-auto flex h-32 w-32 flex-col items-center justify-center rounded-full bg-gray-100 mb-4">
            <span className="text-gray-400">👨‍🎓</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900">Нет студентов</h3>
          <p className="mt-1 text-sm text-gray-500">
            Пока нет записей на ваши курсы. Студенты появятся здесь после записи.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
              Список студентов ({filtered.length})
            </h2>
          </div>
          <table className="w-full text-sm divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Студент
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Курс
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Прогресс
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Записан
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {filtered.map((enrollment) => {
                const progress =
                  enrollment.progress > 0
                    ? Math.round(enrollment.progress)
                    : enrollment.lesson_progress.length > 0
                      ? Math.round(
                          enrollment.lesson_progress.filter(
                            (p) => p.status === 'completed',
                          ).length /
                            enrollment.lesson_progress.length *
                            100,
                        )
                      : 0;
                return (
                  <tr key={enrollment.id} className="hover:bg-gray-50 last:border-0">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
                          {(enrollment.student?.handle?.charAt(0) ||
                            '?').toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {enrollment.student?.handle ?? '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">
                        {enrollment.course.title}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          enrollment.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {enrollment.status === 'active'
                          ? '● Активен'
                          : '● Завершён'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {progress}%
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {enrollment.enrolled_at.slice(0, 10)}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <button
                          onClick={() =>
                            navigate(`/courses/${enrollment.course.id}`)
                          }
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      >
                        К курсу
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
