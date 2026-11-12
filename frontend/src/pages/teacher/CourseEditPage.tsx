import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { getCourse, updateCourse, listCategories } from '../../api/educationApi';
import { useAuthStore } from '../../store/authStore';
import type { Category, CourseDetail } from '../../types/education';

export default function TeacherCourseEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    is_published: false,
    thumbnail_url: '',
    start_at: '',
    end_at: '',
  });

  const loadCourse = async () => {
    if (!id) return;
    try {
      const res = await getCourse(id);
      setCourse(res.data);
      setForm({
        title: res.data.title,
        description: res.data.description,
        category: res.data.category?.id ?? '',
        is_published: res.data.is_published,
        thumbnail_url: res.data.thumbnail_url ?? '',
        start_at: res.data.start_at ?? '',
        end_at: res.data.end_at ?? '',
      });
    } catch {
      toast.error('Не удалось загрузить курс');
      navigate('/teacher/courses');
    }
  };

  const loadCategories = async () => {
    try {
      setCategories(await listCategories());
    } catch {
      toast.error('Не удалось загрузить категории');
    }
  };

  useEffect(() => {
    loadCourse();
    loadCategories();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = e.target instanceof HTMLInputElement ? e.target.checked : undefined;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await updateCourse(id, {
        title: form.title,
        description: form.description,
        category: form.category || undefined,
        is_published: form.is_published,
        thumbnail_url: form.thumbnail_url || undefined,
        start_at: form.start_at || undefined,
        end_at: form.end_at || undefined,
      });
      toast.success('Курс обновлён');
      navigate(`/teacher/courses/${id}/modules`);
    } catch {
      toast.error('Не удалось обновить курс');
    } finally {
      setSaving(false);
    }
  };

  if (!course) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center sm:px-6">
        <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
          <div className="h-4 w-1/3 rounded bg-gray-200 mb-4" />
          <div className="h-4 w-full rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const isOwner =
    user &&
    (user.role === 'admin' || course.teacher.id === user.id);

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900">Доступ запрещён</h1>
        <p className="mt-2 text-gray-500">Вы не можете редактировать этот курс.</p>
        <button
          onClick={() => navigate('/teacher/courses')}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          К моим курсам
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Редактировать курс</h1>
        <p className="mt-1 text-gray-500">{course.title}</p>
        <Link
          to={`/teacher/courses/${course.id}/analytics`}
          className="inline-flex items-center gap-2 mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          Аналитика курса
        </Link>
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
                value={form.category}
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
              <label className="block text-sm font-medium text-gray-700">URL обложки</label>
              <input
                name="thumbnail_url"
                type="url"
                value={form.thumbnail_url}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Дата открытия (по расписанию)</label>
              <input
                name="start_at"
                type="datetime-local"
                value={form.start_at}
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
                value={form.end_at}
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
            onClick={() => navigate(`/teacher/courses/${id}/modules`)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={saving}
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving || !form.title}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  );
}
