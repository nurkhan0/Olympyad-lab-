import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import {
  listMaterials,
  createMaterial,
  updateMaterial,
  deleteMaterial,
} from '../../api/educationApi';
import type { Material } from '../../types/education';

export default function MaterialManagePage() {
  const { courseId, moduleId, lessonId } = useParams<{
    courseId: string;
    moduleId: string;
    lessonId: string;
  }>();
  const navigate = useNavigate();

  const [newMaterial, setNewMaterial] = useState({
    title: '',
    type: 'link',
    url: '',
    content: '',
    order: 0,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    type: 'link',
    url: '',
    content: '',
    order: 0,
  });

  const { data: materials, isLoading } = useQuery<Material[]>({
    queryKey: ['lesson-materials', courseId, moduleId, lessonId],
    queryFn: () =>
      listMaterials(courseId!, moduleId!, lessonId!),
    enabled: Boolean(courseId && moduleId && lessonId),
  });

  const handleCreateMaterial = async () => {
    if (!courseId || !moduleId || !lessonId || !newMaterial.title.trim()) return;
    try {
      await createMaterial(courseId, moduleId, lessonId, {
        title: newMaterial.title,
        type: newMaterial.type,
        url: newMaterial.url,
        content: newMaterial.content,
        order: newMaterial.order,
      });
      setNewMaterial({ title: '', type: 'link', url: '', content: '', order: 0 });
      toast.success('Материал создан');
      window.location.reload();
    } catch {
      toast.error('Не удалось создать материал');
    }
  };

  const handleEditClick = (material: Material) => {
    setEditingId(material.id);
    setEditForm({
      title: material.title,
      type: material.type,
      url: material.url ?? '',
      content: material.content ?? '',
      order: material.order,
    });
  };

  const handleSaveEdit = async () => {
    if (!courseId || !moduleId || !lessonId || !editingId || !editForm.title.trim()) {
      return;
    }
    try {
      await updateMaterial(courseId, moduleId, lessonId, editingId, {
        title: editForm.title,
        type: editForm.type,
        url: editForm.url,
        content: editForm.content,
        order: editForm.order,
      });
      setEditingId(null);
      toast.success('Материал обновлён');
      window.location.reload();
    } catch {
      toast.error('Не удалось обновить материал');
    }
  };

  const handleDelete = async (materialId: string, title: string) => {
    if (!courseId || !moduleId || !lessonId) return;
    if (!window.confirm(`Удалить материал "${title}"?`)) return;
    try {
      await deleteMaterial(courseId, moduleId, lessonId, materialId);
      toast.success('Материал удалён');
      window.location.reload();
    } catch {
      toast.error('Не удалось удалить материал');
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Материалы занятия</h1>
        <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6">
          <div className="h-4 w-1/3 rounded bg-gray-200 mb-4" />
          <div className="h-4 w-full rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const materialList = materials ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Материалы занятия</h1>
          <p className="text-sm text-gray-500">
            Прикрепите PDF, видео, ссылки, текстовые фрагменты и примеры кода.
          </p>
        </div>
        <button
          onClick={() =>
            navigate(`/teacher/courses/${courseId}/modules/${moduleId}/lessons`)
          }
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← К занятиям
        </button>
      </div>

      {/* Create material form */}
      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Добавить материал
          </h2>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); handleCreateMaterial(); }} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-500 uppercase">Название</label>
            <input
              name="title"
              value={newMaterial.title}
              onChange={(e) => setNewMaterial({ ...newMaterial, title: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Название материала"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500 uppercase">Тип</label>
              <select
                name="type"
                value={newMaterial.type}
                onChange={(e) => setNewMaterial({ ...newMaterial, type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="link">Ссылка</option>
                <option value="video">Видео</option>
                <option value="pdf">PDF</option>
                <option value="text">Текст</option>
                <option value="code">Код</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-500 uppercase">Порядок</label>
              <input
                name="order"
                type="number"
                value={newMaterial.order}
                onChange={(e) => setNewMaterial({ ...newMaterial, order: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-500 uppercase">
              {newMaterial.type === 'text' || newMaterial.type === 'code'
                ? 'Содержание'
                : 'Ссылка / URL'}
            </label>
            <textarea
              name="content_or_url"
              value={newMaterial.type === 'link' || newMaterial.type === 'video' || newMaterial.type === 'pdf' ? newMaterial.url : newMaterial.content}
              onChange={(e) => {
                const val = e.target.value;
                if (
                  newMaterial.type === 'link' ||
                  newMaterial.type === 'video' ||
                  newMaterial.type === 'pdf'
                ) {
                  setNewMaterial({ ...newMaterial, url: val });
                } else {
                  setNewMaterial({ ...newMaterial, content: val });
                }
              }}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder={newMaterial.type === 'text' || newMaterial.type === 'code' ? 'Введите текст...' : 'https://example.com'}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={!newMaterial.title.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Добавить материал
            </button>
          </div>
        </form>
      </div>

      {/* Materials list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
            Существующие материалы ({materialList.length})
          </h2>
        </div>
        <div className="divide-y divide-gray-100">
          {materialList.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">
                В этом занятии пока нет материалов. Добавьте первый материал выше.
              </p>
            </div>
          ) : (
            materialList.map((material) => (
              <div key={material.id} className="px-6 py-4 hover:bg-gray-50 last:border-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                        {material.order}
                      </span>
                      {editingId === material.id ? (
                        <div className="space-y-2">
                          <input
                            value={editForm.title}
                            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <div className="space-y-2">
                            <label className="block text-xs font-medium text-gray-500 uppercase">Тип</label>
                            <select
                              name="type"
                              value={editForm.type}
                              onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                              <option value="link">Ссылка</option>
                              <option value="video">Видео</option>
                              <option value="pdf">PDF</option>
                              <option value="text">Текст</option>
                              <option value="code">Код</option>
                            </select>
                          </div>
                          <textarea
                            value={editForm.type === 'link' || editForm.type === 'video' || editForm.type === 'pdf' ? editForm.url : editForm.content}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (
                                editForm.type === 'link' ||
                                editForm.type === 'video' ||
                                editForm.type === 'pdf'
                              ) {
                                setEditForm({ ...editForm, url: val });
                              } else {
                                setEditForm({ ...editForm, content: val });
                              }
                            }}
                            rows={2}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
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
                          <h3 className="font-medium text-gray-900">{material.title}</h3>
                          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                            <span
                              className={`rounded-full px-2 py-0.5 ${
                                material.type === 'video'
                                  ? 'bg-blue-100 text-blue-700'
                                  : material.type === 'pdf'
                                    ? 'bg-red-100 text-red-700'
                                    : material.type === 'link'
                                      ? 'bg-green-100 text-green-700'
                                      : material.type === 'text'
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {material.type}
                            </span>
                            <span>•</span>
                            <span>{material.order}</span>
                          </div>
                          {material.url && (
                            <p className="mt-1 text-sm text-gray-500 break-all truncate max-w-[250px]">
                              {material.url}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!editingId || editingId !== material.id ? (
                      <>
                        <button
                          onClick={() => handleEditClick(material)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 text-indigo-600 hover:text-indigo-700"
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={() => handleDelete(material.id, material.title)}
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
