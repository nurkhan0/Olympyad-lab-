import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { listCategories, listCourses, enrollCourse } from '../api/educationApi';
import { useAuthStore } from '../store/authStore';
import type { Category, CourseList } from '../types/education';

function CourseCard({ course, user }: { course: CourseList; user?: { role?: string } | null }) {
  const handleEnroll = async () => {
    try {
      await enrollCourse(course.id);
      toast.success('Запись на курс оформлена');
    } catch {
      toast.error('Не удалось записаться на курс');
    }
  };

  const isStudent = user?.role === 'student';
  const canEnroll = isStudent && course.is_published;

  return (
    <article key={course.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative h-48 overflow-hidden">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <div className="text-gray-400 text-sm font-medium">Нет изображения</div>
          </div>
        )}
        {!course.is_published && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="rounded bg-orange-900/90 px-2 py-1 text-[10px] font-semibold text-orange-100 uppercase">
              Не опубликован
            </span>
          </div>
        )}
        <button
          type="button"
          disabled={!canEnroll}
          className={`absolute top-2 right-2 z-10 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition-all ${
            canEnroll
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
          onClick={handleEnroll}
        >
          {canEnroll ? 'Записаться' : 'Запись закрыта'}
        </button>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          {course.category ? (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {course.category.title}
            </span>
          ) : null}
          {course.start_at && (
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 uppercase">
              по расписанию
            </span>
          )}
        </div>
        <Link
          to={`/courses/${course.id}`}
          className="text-lg font-bold text-gray-900 hover:text-indigo-600"
        >
          {course.title}
        </Link>
        <p className="mt-1 text-sm text-gray-600 line-clamp-2">
          {course.description}
        </p>

        <div className="mt-4 flex items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.294M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <span>{course.teacher_name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2m2 12H9a2 2 0 01-2-2v-6a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2zm0 0v2m0 6v-2m-6.569-2.34A2.487 2.487 0 0111.494 7h-2.99c-.489 0-.938.174-1.314.486a1.534 1.534 0 01-1.023-1.939l.728-1.168a.09.09 0 01.118-.012c.077.041.053.153.014.228l-1.172.704a1.534 1.534 0 01-1.939-1.023c.312-.376.744-.579 1.194-.579h2.99c.818 0 1.577.369 2.096 1.068l-.728 1.168a.09.09 0 00-.014.153c0 .048.019.095.057.131a2 2 0 01.046.339A2 2 0 0112 11a2 2 0 01-2 2v1.172c0 .538.214 1.027.565 1.396L11 14H9a2 2 0 01-2-2v-1a2 2 0 012-2h2a2 2 0 012 2zm-6.939.068A1.5 1.5 0 007 14h2a1.5 1.5 0 002.343-.46l1.172-.704a.09.09 0 00-.014-.153c0-.048-.019-.095-.057-.131A2 2 0 019 9V9a2 2 0 012-2h2a2 2 0 012 2v1a2 2 0 01-2 2h-2a1.5 1.5 0 00-2.343.46l-1.172.704a.09.09 0 00.014.153c0 .048.019.095.057.131a2 2 0 01-.046.339A2 2 0 017 11v1a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            {course.module_count} модулей
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 8.088 9.246 9 7.5 9S4.168 8.088 3 6.253m9.068 1.393l3 1.5c.75.375 1.047 1.28.909 2.062S17.48 11 16.5 11s-1.5-.625-1.5-1.5m0 0c-.253 0-.478-.142-.616-.363a.5.5 0 00-.247-.317c-.207-.11-.326-.265-.281-.416S9.23 8 9 8s-.5.31-.38.814c.021.09.064.172.118.247q.062.078.085.16l3 1.5c.75.375 1.047 1.28.909 2.062S13.48 13 12.5 13s-1.5-.625-1.5-1.5m0 0c-.253 0-.478-.142-.616-.363a.5.5 0 00-.247-.317c-.207-.11-.326-.265-.281-.416S9.23 8 9 8s-.5.31-.38.814c.021.09.064.172.118.247q.062.078.085.16l3 1.5c.75.375 1.047 1.28.909 2.062S13.48 13 12.5 13s-1.5-.625-1.5-1.5m0 0c-.253 0-.478-.142-.616-.363a.5.5 0 00-.247-.317c-.207-.11-.326-.265-.281-.416S10.23 8 10 8s-.5.31-.38.814c.021.09.064.172.118.247q.062.078.085.16l3 1.5c.75.375 1.047 1.28.909 2.062S13.48 13 12.5 13s-1.5-.625-1.5-1.5m0 0c-.253 0-.478-.142-.616-.363a.5.5 0 00-.247-.317c-.207-.11-.326-.265-.281-.416S11.23 8 11 8s-.5.31-.38.814c.021.09.064.172.118.247q.062.078.085.16l3 1.5c.75.375 1.047 1.28.909 2.062S13.48 13 12.5 13s-1.5-.625-1.5-1.5"
              />
            </svg>
            {course.total_lessons} занятий
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {course.enrollment_count} студентов
          </div>
        </div>
      </div>
    </article>
  );
}

export default function CoursesPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [searchInput, setSearchInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ['education-categories'],
    // DRF paginates this endpoint: accept both {results: [...]} and bare [...].
    queryFn: () => listCategories(),
  });

  const categoryParam = searchParams.get('category') ?? '';
  useEffect(() => {
    if (categoryParam && !selectedCategory) {
      setSelectedCategory(categoryParam);
    }
  }, [categoryParam, selectedCategory]);

  const { data, isLoading, isError, error } = useQuery<{ count: number; results: CourseList[] }>({
    queryKey: ['education-courses', selectedCategory, searchInput],
    queryFn: () => listCourses().then((res) => res.data),
    placeholderData: (prev) => prev,
  });

  const filtered = useMemo(() => {
    let items = data?.results ?? [];
    if (selectedCategory) {
      items = items.filter((c) => c.category?.id === selectedCategory);
    }
    if (searchInput) {
      const q = searchInput.toLowerCase();
      items = items.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.category?.title.toLowerCase().includes(q),
      );
    }
    return items;
  }, [data, selectedCategory, searchInput]);

  if (isLoading || categoriesLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Курсы</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <article key={i} className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse">
              <div className="h-48 bg-gray-200" />
              <div className="px-4 py-4 space-y-2">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-4 w-full rounded bg-gray-200" />
                <div className="h-4 w-1/2 rounded bg-gray-200" />
              </div>
            </article>
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

  const isTeacherOrAdmin = user?.role === 'teacher' || user?.role === 'admin';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Курсы</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} курсов{(data?.count ?? 0) > filtered.length ? ` (показано)` : ''}
          </p>
        </div>
        {isTeacherOrAdmin && (
          <Link
            to="/courses/create"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Создать курс
          </Link>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Все категории</option>
          {categories?.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.title}
            </option>
          ))}
        </select>

        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Поиск по названию курса..."
          className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:max-w-xs sm:flex-none"
        />
      </div>

      {filtered.length === 0 ? (
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Курсы не найдены</h3>
          <p className="text-gray-500">Попробуйте изменить поисковый запрос или фильтр категории.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((course) => (
            <CourseCard key={course.id} course={course} user={user} />
          ))}
        </div>
      )}
    </div>
  );
}
