import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { listModules, createModule, updateModule, deleteModule } from '../../api/educationApi';
import type { Module } from '../../types/education';

export default function ModuleManagePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [newModule, setNewModule] = useState({ title: '', description: '', order: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', order: 0 });

  const { data: modules, isLoading } = useQuery<Module[]>({
    queryKey: ['course-modules', courseId],
    queryFn: () => listModules(courseId!),
    enabled: Boolean(courseId),
  });

  const handleCreateModule = async () => {
    if (!courseId || !newModule.title.trim()) return;
    try {
      await createModule(courseId, {
        title: newModule.title,
        description: newModule.description,
        order: newModule.order,
      });
      setNewModule({ title: '', description: '', order: 0 });
      toast.success('Модуль создан');
      window.location.reload();
    } catch {
      toast.error('Не удалось создать модуль');
    }
  };

  const handleEditClick = (module: Module) => {
    setEditingId(module.id);
    setEditForm({ title: module.title, description: module.description, order: module.order });
  };

  const handleSaveEdit = async () => {
    if (!courseId || !editingId || !editForm.title.trim()) return;
    try {
      await updateModule(courseId, editingId, {
        title: editForm.title,
        description: editForm.description,
        order: editForm.order,
      });
      setEditingId(null);
      toast.success('Модуль обновлён');
      window.location.reload();
    } catch {
      toast.error('Не удалось обновить модуль');
    }
  };

  const handleDelete = async (moduleId: string, title: string) => {
    if (!courseId) return;
    if (!window.confirm(`Удалить модуль "${title}"? Все занятия в нём также будут удалены.`)) {
      return;
    }
    try {
      await deleteModule(courseId, moduleId);
      toast.success('Модуль удалён');
      window.location.reload();
    } catch {
      toast.error('Не удалось удалить модуль');
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Модули курса</h1>
        <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
          <div className="h-4 w-1/3 rounded bg-gray-200 mb-4" />
          <div className="h-4 w-full rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const moduleList = modules ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Модули курса</h1>
          <p className="text-sm text-gray-500">
            Организуйте занятия по модулям (разделам).
          </p>
        </div>
        <button
          onClick={() => navigate(`/teacher/courses/${courseId}`)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← К курсу
        </button>
      </div>

      {/* Create module form */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Добавить модуль
          </h2>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleCreateModule(); }} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-500 uppercase">Название</label>
            <input
              name="title"
              value={newModule.title}
              onChange={(e) => setNewModule({ ...newModule, title: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Название модуля"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-500 uppercase">Описание</label>
            <input
              name="description"
              value={newModule.description}
              onChange={(e) => setNewModule({ ...newModule, description: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Краткое описание"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-500 uppercase">Порядок</label>
            <input
              name="order"
              type="number"
              value={newModule.order}
              onChange={(e) => setNewModule({ ...newModule, order: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={!newModule.title.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Добавить
            </button>
          </div>
        </form>
      </div>

      {/* Modules list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Существующие модули ({moduleList.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {moduleList.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">В этом курсе пока нет модулей. Добавьте первый модуль выше.</p>
            </div>
          ) : (
            moduleList.map((module) => (
              <div key={module.id} className="px-6 py-4 hover:bg-gray-50 last:border-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                        {module.order}
                      </span>
                      {editingId === module.id ? (
                        <div className="space-y-2">
                          <input
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            rows={2}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
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
                          <h3 className="font-medium text-gray-900">{module.title}</h3>
                          {module.description && (
                            <p className="mt-1 text-sm text-gray-500">{module.description}</p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                            <span>{module.lessons.length} занятий</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!editingId || editingId !== module.id ? (
                      <>
                        <button
                          onClick={() => navigate(`/teacher/courses/${courseId}/modules/${module.id}/lessons`)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Занятия
                        </button>
                        <button
                          onClick={() => handleEditClick(module)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 text-indigo-600 hover:text-indigo-700"
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={() => handleDelete(module.id, module.title)}
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
