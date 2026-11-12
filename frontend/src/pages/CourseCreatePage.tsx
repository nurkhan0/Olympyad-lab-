import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { listCategories, createCourse } from '../api/educationApi';
import { useAuthStore } from '../store/authStore';
import type { Category, CreateCourseDto } from '../types/education';

export default function CourseCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState<CreateCourseDto>({
    title: '',
    description: '',
    category: undefined,
    is_published: false,
    start_at: undefined,
    end_at: undefined,
  });

  const loadCategories = async () => {
    try {
      setCategories(await listCategories());
    } catch {
      toast.error('Не удалось загрузить категории');
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    const target = e.target as HTMLInputElement;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? target.checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const dto: CreateCourseDto = {
        title: form.title,
        description: form.description,
        category: form.category || undefined,
        is_published: Boolean(form.is_published),
        start_at: form.start_at || undefined,
        end_at: form.end_at || undefined,
      };
      await createCourse(dto);
      toast.success('Курс создан');
      // Teachers land where they can immediately manage the new course.
      navigate('/teacher/courses');
    } catch {
      toast.error('Не удалось создать курс');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900">Доступ запрещён</h1>
        <p className="mt-2 text-gray-500">Только преподаватели и администраторы могут создавать курсы.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Создать курс</h1>
        <p className="mt-1 text-gray-500">Создайте новый образовательный курс.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Название курса</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Введите название курса"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Категория</label>
              <select
                name="category"
                value={form.category ?? ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Без категории</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Описание</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Описание курса"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Дата открытия (по расписанию)</label>
              <input
                name="start_at"
                type="datetime-local"
                value={form.start_at ?? ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500">Оставьте пустым, если курс открыт сразу.</p>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Дата закрытия</label>
              <input
                name="end_at"
                type="datetime-local"
                value={form.end_at ?? ''}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500">Оставьте пустым, если нет ограничения.</p>
            </div>
          </div>

          <div className="mt-6 flex items-start gap-3">
            <input
              id="is_published"
              name="is_published"
              type="checkbox"
              checked={Boolean(form.is_published)}
              onChange={handleChange}
              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="is_published" className="text-sm text-gray-700">
              Опубликовать курс (доступно студентам)
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/courses')}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isLoading || !form.title}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Создание...' : 'Создать курс'}
          </button>
        </div>
      </form>
    </div>
  );
}
