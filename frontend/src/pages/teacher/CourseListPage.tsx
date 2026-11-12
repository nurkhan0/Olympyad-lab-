import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { listCourses, deleteCourse } from '../../api/educationApi';
import type { CourseList } from '../../types/education';

function StatusBadge({ isPublished }: { isPublished: boolean }) {
  return isPublished ? (
    <span className="inline-flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 uppercase tracking-tighter">
      Опубликован
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 uppercase tracking-tighter">
      Черновик
    </span>
  );
}

export default function TeacherCourseListPage() {
  const navigate = useNavigate();

  const { data, isLoading, isFetching } = useQuery<{ count: number; results: CourseList[] }>({
    queryKey: ['teacher-courses'],
    queryFn: () => listCourses().then((res) => res.data),
  });

  const courses = data?.results ?? [];

  const handleDelete = async (courseId: string, courseTitle: string) => {
    if (!window.confirm(`Удалить курс "${courseTitle}"? Это действие необратимо.`)) {
      return;
    }
    try {
      await deleteCourse(courseId);
      toast.success('Курс удалён');
      // Refetch courses
      window.location.reload();
    } catch {
      toast.error('Не удалось удалить курс');
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Мои курсы</h1>
        <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
          <div className="h-4 w-1/3 rounded bg-gray-200 mb-4" />
          <div className="h-4 w-full rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мои курсы</h1>
          <p className="text-sm text-gray-500">
            {courses.length} курс(ов){courses.length !== 1 ? 'а' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate('/courses/create')}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all"
        >
          Новый курс
        </button>
      </div>

      {isFetching && courses.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center animate-pulse">
          <div className="h-4 w-1/3 rounded bg-gray-200 mx-auto mb-4" />
          <div className="h-4 w-full rounded bg-gray-200" />
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m-6 4h6m-6 4h6M9 16V9m0 0V0m0 12h9m-9 4H9m-3 0v9m0-9H0m12 0h9m-9 4H3"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">У вас пока нет курсов</h3>
          <p className="text-gray-500">Создайте курс, чтобы начать добавлять модули и занятия.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Название</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Модулей</th>
                <th className="px-4 py-3">Занятий</th>
                <th className="px-4 py-3">Студентов</th>
                <th className="px-4 py-3 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {courses.map((course) => (
                <tr key={course.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link
                      to={`/teacher/courses/${course.id}/modules`}
                      className="hover:text-indigo-600"
                    >
                      {course.title}
                    </Link>
                    <p className="mt-1 text-xs text-gray-500">
                      {course.description?.slice(0, 80)}{course.description?.length > 80 ? '...' : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge isPublished={course.is_published} />
                  </td>
                  <td className="px-4 py-3 text-gray-700">{course.module_count}</td>
                  <td className="px-4 py-3 text-gray-700">{course.total_lessons}</td>
                  <td className="px-4 py-3 text-gray-700">{course.enrollment_count}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/teacher/courses/${course.id}/edit`)}
                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(course.id, course.title)}
                      className="ml-2 text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
