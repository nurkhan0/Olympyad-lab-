import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { listEnrollments, unenrollCourse } from '../api/educationApi';
import type { Enrollment } from '../types/education';

function EnrollmentSkeleton() {
  return (
    <div className="h-20 animate-pulse rounded-xl border border-gray-200 bg-gray-100 overflow-hidden flex">
      <div className="w-48 h-full bg-gray-200" />
      <div className="flex-1 p-4 space-y-3">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-4 w-1/2 rounded bg-gray-200" />
        <div className="h-4 w-1/3 rounded bg-gray-200" />
        <div className="h-4 w-1/4 rounded bg-gray-200" />
      </div>
    </div>
  );
}

function statusBadge(status: Enrollment['status']) {
  const variants: Record<Enrollment['status'], string> = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-indigo-100 text-indigo-700',
    dropped: 'bg-gray-100 text-gray-700',
  };
  const labels: Record<Enrollment['status'], string> = {
    active: 'Активно',
    completed: 'Завершено',
    dropped: 'Отменено',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${variants[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function MyLearningPage() {
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery<Enrollment[]>({
    queryKey: ['student-enrollments'],
    queryFn: () => listEnrollments(),
  });

  const handleUnenroll = async (courseId: string) => {
    if (!window.confirm('Вы действительно хотите отписаться от этого курса?')) {
      return;
    }
    try {
      await unenrollCourse(courseId);
      toast.success('Вы отписались от курса');
      navigate(0);
    } catch {
      toast.error('Не удалось отписаться от курса');
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Моё обучение</h1>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <EnrollmentSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Не удалось загрузить курсы</h1>
          <p className="text-gray-500">
            {error instanceof Error ? error.message : 'Попробуйте обновить страницу'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  const activeEnrollments = (data ?? []).filter((e) => e.status === 'active');
  const completedEnrollments = (data ?? []).filter((e) => e.status === 'completed');
  const droppedEnrollments = (data ?? []).filter((e) => e.status === 'dropped');

  if (data?.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 42V5c0-2-1-4-3-4H7c-2 0-3 2-3 4v37m0 0l3 10m3-10L21 12m0 0l3 10m-3-10h-7.784a2 2 0 00-1.618-.78l-2.57-3.428a.5.5 0 00-.438-.27H7.362c-.347 0-.682.194-.85.551l-2.57 3.427a.5.5 0 00-.107.448M9 12l3 10m3-10 3 10m3-10 3 10m3-10 3 10"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Вы ещё не записаны на курсы</h1>
          <p className="text-gray-500 mb-6">
            Откройте каталог курсов и запишитесь на любой понравившийся.
          </p>
          <Link
            to="/courses"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Перейти к курсам
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Моё обучение</h1>

      {activeEnrollments.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            Активные курсы
          </h2>
          <div className="space-y-3">
            {activeEnrollments.map((enrollment) => (
              <EnrollmentCard
                key={enrollment.id}
                enrollment={enrollment}
                onUnenroll={handleUnenroll}
              />
            ))}
          </div>
        </section>
      )}

      {completedEnrollments.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            Завершённые курсы
          </h2>
          <div className="space-y-3">
            {completedEnrollments.map((enrollment) => (
              <EnrollmentCard
                key={enrollment.id}
                enrollment={enrollment}
                onUnenroll={handleUnenroll}
              />
            ))}
          </div>
        </section>
      )}

      {droppedEnrollments.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
            Отменённые курсы
          </h2>
          <div className="space-y-3">
            {droppedEnrollments.map((enrollment) => (
              <EnrollmentCard
                key={enrollment.id}
                enrollment={enrollment}
                onUnenroll={handleUnenroll}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function EnrollmentCard({
  enrollment,
  onUnenroll,
}: {
  enrollment: Enrollment;
  onUnenroll: (courseId: string) => void;
}) {
  const course = enrollment.course;
  const isActive = enrollment.status === 'active';
  const isCompleted = enrollment.status === 'completed';

  return (
    <article className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-medium">
            {course.thumbnail_url ? (
              <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover rounded" />
            ) : (
              '📚'
            )}
          </div>
          <div>
            <div className="font-medium text-gray-900">{course.title}</div>
            <div className="text-xs text-gray-500">{course.teacher_name}</div>
          </div>
        </div>
        {statusBadge(enrollment.status)}
      </div>

      <div className="px-4 py-3">
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs font-medium mb-1">
            <span className="text-gray-500">Прогресс</span>
            <span className="text-indigo-600">{Math.round(enrollment.progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.round(enrollment.progress)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-gray-500">
          <span>
            Записан: {new Date(enrollment.enrolled_at).toLocaleDateString('ru-RU')}
          </span>
          {isCompleted && enrollment.completed_at && (
            <span>
              Завершено: {new Date(enrollment.completed_at).toLocaleDateString('ru-RU')}
            </span>
          )}
          {enrollment.last_accessed && (
            <span>
              Последний визит: {new Date(enrollment.last_accessed).toLocaleDateString('ru-RU')}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
        {isActive && (
          <Link
            to={`/courses/${course.id}`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Продолжить обучение
          </Link>
        )}
        {isCompleted && (
          <span className="text-xs font-medium text-indigo-600">Курс пройден</span>
        )}
        <button
          type="button"
          onClick={() => onUnenroll(course.id)}
          className="text-xs text-red-600 hover:text-red-700 underline"
        >
          Отписаться
        </button>
      </div>
    </article>
  );
}
