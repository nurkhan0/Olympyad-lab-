import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { listLessons, createLesson, updateLesson, deleteLesson } from '../../api/educationApi';
import type { Lesson } from '../../types/education';

export default function LessonManagePage() {
  const { courseId, moduleId } = useParams<{ courseId: string; moduleId: string }>();
  const navigate = useNavigate();

  const [newLesson, setNewLesson] = useState({
    title: '',
    content: '',
    order: 0,
    estimated_minutes: 0,
    is_published: true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    content: '',
    order: 0,
    estimated_minutes: 0,
    is_published: true,
  });

  const { data: lessons, isLoading } = useQuery<Lesson[]>({
    queryKey: ['module-lessons', courseId, moduleId],
    queryFn: () => listLessons(courseId!, moduleId!),
    enabled: Boolean(courseId && moduleId),
  });

  const handleCreateLesson = async () => {
    if (!courseId || !moduleId || !newLesson.title.trim()) return;
    try {
      await createLesson(courseId, moduleId, {
        title: newLesson.title,
        content: newLesson.content,
        order: newLesson.order,
        estimated_minutes: newLesson.estimated_minutes,
        is_published: newLesson.is_published,
      });
      setNewLesson({
        title: '',
        content: '',
        order: 0,
        estimated_minutes: 0,
        is_published: true,
      });
      toast.success('Занятие создано');
      window.location.reload();
    } catch {
      toast.error('Не удалось создать занятие');
    }
  };

  const handleEditClick = (lesson: Lesson) => {
    setEditingId(lesson.id);
    setEditForm({
      title: lesson.title,
      content: lesson.content,
      order: lesson.order,
      estimated_minutes: lesson.estimated_minutes,
      is_published: lesson.is_published,
    });
  };

  const handleSaveEdit = async () => {
    if (!courseId || !moduleId || !editingId || !editForm.title.trim()) return;
    try {
      await updateLesson(courseId, moduleId, editingId, {
        title: editForm.title,
        content: editForm.content,
        order: editForm.order,
        estimated_minutes: editForm.estimated_minutes,
        is_published: editForm.is_published,
      });
      setEditingId(null);
      toast.success('Занятие обновлено');
      window.location.reload();
    } catch {
      toast.error('Не удалось обновить занятие');
    }
  };

  const handleDelete = async (lessonId: string, title: string) => {
    if (!courseId || !moduleId) return;
    if (!window.confirm(`Удалить занятие "${title}"? Все материалы в нём также будут удалены.`)) {
      return;
    }
    try {
      await deleteLesson(courseId, moduleId, lessonId);
      toast.success('Занятие удалено');
      window.location.reload();
    } catch {
      toast.error('Не удалось удалить занятие');
    }
  };

  const handleTogglePublish = async (lesson: Lesson) => {
    if (!courseId || !moduleId) return;
    try {
      await updateLesson(courseId, moduleId, lesson.id, {
        title: lesson.title,
        content: lesson.content,
        order: lesson.order,
        estimated_minutes: lesson.estimated_minutes,
        is_published: !lesson.is_published,
      });
      toast.success(lesson.is_published ? 'Занятие снято с публикации' : 'Занятие опубликовано');
      window.location.reload();
    } catch {
      toast.error('Не удалось изменить статус публикации');
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Занятия модуля</h1>
        <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
          <div className="h-4 w-1/3 rounded bg-gray-200 mb-4" />
          <div className="h-4 w-full rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const lessonList = lessons ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Занятия модуля</h1>
          <p className="text-sm text-gray-500">
            Управляйте занятиями, содержанием и публикацией.
          </p>
        </div>
        <button
          onClick={() => navigate(`/teacher/courses/${courseId}/modules`)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← К модулям
        </button>
      </div>

      {/* Create lesson form */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Добавить занятие
          </h2>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleCreateLesson(); }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500 uppercase">Название</label>
              <input
                name="title"
                value={newLesson.title}
                onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Название занятия"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500 uppercase">Порядок</label>
              <input
                name="order"
                type="number"
                value={newLesson.order}
                onChange={(e) => setNewLesson({ ...newLesson, order: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-500 uppercase">Описание / содержание</label>
            <textarea
              name="content"
              value={newLesson.content}
              onChange={(e) => setNewLesson({ ...newLesson, content: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Теория и объяснения занятия"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500 uppercase">Примерное время (мин.)</label>
              <input
                name="estimated_minutes"
                type="number"
                value={newLesson.estimated_minutes}
                onChange={(e) => setNewLesson({ ...newLesson, estimated_minutes: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500 uppercase">Статус</label>
              <select
                name="is_published"
                value={String(newLesson.is_published)}
                onChange={(e) => setNewLesson({ ...newLesson, is_published: e.target.value === 'true' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="true">Опубликовано</option>
                <option value="false">Черновик</option>
              </select>
            </div>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={!newLesson.title.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Добавить занятие
            </button>
          </div>
        </form>
      </div>

      {/* Lessons list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Существующие занятия ({lessonList.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {lessonList.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">В этом модуле пока нет занятий. Добавьте первое занятие выше.</p>
            </div>
          ) : (
            lessonList.map((lesson) => (
              <div key={lesson.id} className="px-6 py-4 hover:bg-gray-50 last:border-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                        {lesson.order}
                      </span>
                      {editingId === lesson.id ? (
                        <div className="space-y-2">
                          <input
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <textarea
                            value={editForm.content}
                            onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                            rows={2}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="block text-xs font-medium text-gray-500 uppercase">Порядок</label>
                              <input
                                name="order"
                                type="number"
                                value={editForm.order}
                                onChange={(e) => setEditForm({ ...editForm, order: parseInt(e.target.value) || 0 })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-xs font-medium text-gray-500 uppercase">Время (мин.)</label>
                              <input
                                name="estimated_minutes"
                                type="number"
                                value={editForm.estimated_minutes}
                                onChange={(e) => setEditForm({ ...editForm, estimated_minutes: parseInt(e.target.value) || 0 })}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                          <div className="flex items-end gap-2">
                            <button
                              onClick={handleSaveEdit}
                              disabled={!editForm.title.trim()}
                              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                            >
                              Сохранить
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h3 className="font-medium text-gray-900">{lesson.title}</h3>
                          {lesson.content && (
                            <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                              {lesson.content}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                            <span>{lesson.materials.length} материал(ов)</span>
                            <span>•</span>
                            <span>{lesson.estimated_minutes} мин.</span>
                            <span>•</span>
                            <span>{lesson.problem_count} задач</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!editingId || editingId !== lesson.id ? (
                      <>
                        <button
                          onClick={() => navigate(`/teacher/courses/${courseId}/modules/${moduleId}/lessons/${lesson.id}/materials`)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Материалы
                        </button>
                        <button
                          onClick={() => handleEditClick(lesson)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 text-indigo-600 hover:text-indigo-700"
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={() => handleTogglePublish(lesson)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                            lesson.is_published
                              ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                              : 'border-green-300 bg-white text-green-700 hover:bg-green-50'
                          }`}
                        >
                          {lesson.is_published ? 'Снять с публикации' : 'Опубликовать'}
                        </button>
                        <button
                          onClick={() => handleDelete(lesson.id, lesson.title)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 text-red-600 hover:text-red-700"
                        >
                          Удалить
                        </button>
                      </>
                    ) : null}
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
