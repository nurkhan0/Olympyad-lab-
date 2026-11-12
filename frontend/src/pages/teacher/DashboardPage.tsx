import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { listCourses } from '../../api/educationApi';
import type { CourseList } from '../../types/education';

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className={`rounded-lg p-3 ${color}-100 text-${color}-600`}>{icon}</div>
      </div>
    </div>
  );
}

function SvgIcon({ className }: { className?: string }) {
  return (
    <svg className={`h-6 w-6 ${className ?? ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();

  const { data: courses, isLoading } = useQuery<{ count: number; results: CourseList[] }>({
    queryKey: ['teacher-courses-overview'],
    queryFn: () => listCourses().then((res) => res.data),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Панель преподавателя</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm animate-pulse">
              <div className="h-4 w-1/3 rounded bg-gray-200 mb-4" />
              <div className="h-10 w-full rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const teacherCourses = courses?.results ?? [];
  const totalCourses = teacherCourses.length;
  const totalStudents = teacherCourses.reduce((sum, c) => sum + c.enrollment_count, 0);
  const totalModules = teacherCourses.reduce((sum, c) => sum + c.module_count, 0);
  const totalLessons = teacherCourses.reduce((sum, c) => sum + c.total_lessons, 0);
  const publishedCourses = teacherCourses.filter((c) => c.is_published).length;
  const draftCourses = totalCourses - publishedCourses;

  const handleCreateCourse = () => {
    navigate('/courses/create');
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Панель преподавателя</h1>
          <p className="text-sm text-gray-500">
            Управляйте своими курсами, модулями, занятиями и студентами.
          </p>
        </div>
        <button
          onClick={handleCreateCourse}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all"
        >
          Создать курс
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Курсов"
          value={totalCourses}
          subtitle={`${publishedCourses} опубликовано, ${draftCourses} черновиков`}
          icon={<SvgIcon className="text-blue-600" />}
          color="blue"
        />
        <StatCard
          title="Студентов"
          value={totalStudents}
          subtitle="Всех записей на ваши курсы"
          icon={<svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        }
          color="green"
        />
        <StatCard
          title="Модулей"
          value={totalModules}
          subtitle="Глав тем во всех курсах"
          icon={<svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        }
          color="indigo"
        />
        <StatCard
          title="Занятий"
          value={totalLessons}
          subtitle="Всего уроков во всех курсах"
          icon={<svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        }
          color="purple"
        />
      </div>

      {/* Recent courses */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Недавние курсы
          </h2>
          <Link
            to="/teacher/courses"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Все курсы →
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {teacherCourses.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m-6 4h6m-6 4h6M9 16V9m0 0V0m0 12h9m-9 4H9m-3 0v9m0-9H0m12 0h9m-9 4H3"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">У вас пока нет курсов</h3>
              <p className="text-gray-500">Создайте свой первый курс, чтобы начать преподавание.</p>
              <button
                onClick={handleCreateCourse}
                className="mt-4 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all"
              >
                Создать курс
              </button>
            </div>
          ) : (
            teacherCourses.slice(0, 5).map((course) => (
              <div key={course.id} className="px-6 py-4 hover:bg-gray-50 last:border-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/teacher/courses/${course.id}/modules`}
                      className="font-medium text-gray-900 hover:text-indigo-600 transition-colors"
                    >
                      {course.title}
                    </Link>
                    <p className="mt-1 text-sm text-gray-500">
                      {course.module_count} модулей • {course.total_lessons} занятий • {course.enrollment_count} студентов
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!course.is_published && (
                      <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 uppercase tracking-tighter">
                        Черновик
                      </span>
                    )}
                    {course.is_published && (
                      <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 uppercase tracking-tighter">
                        Опубликован
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
