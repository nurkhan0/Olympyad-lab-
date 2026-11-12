import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { createTest, deleteTest, getTests, normalizeTests, uploadTests } from '../../api/adminApi';
import type { AdminTestCase } from '../../types/admin';

interface Props {
  problemSlug: string | null;
}

type Tab = 'zip' | 'manual' | 'list';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TestCaseManager({ problemSlug }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>('zip');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [manualInput, setManualInput] = useState('');
  const [manualOutput, setManualOutput] = useState('');
  const [isSample, setIsSample] = useState(false);

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ['tests', problemSlug],
    queryFn: async () => {
      const res = await getTests(problemSlug!);
      return normalizeTests(res.data);
    },
    enabled: Boolean(problemSlug),
  });

  const invalidateTests = () => {
    queryClient.invalidateQueries({ queryKey: ['tests', problemSlug] });
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return uploadTests(problemSlug!, form, setUploadProgress);
    },
    onSuccess: (res) => {
      toast.success(`Создано ${res.data.created} тестов (${res.data.samples} примеров)`);
      setZipFile(null);
      setUploadProgress(0);
      invalidateTests();
      setTab('list');
    },
    onError: () => {
      toast.error('Не удалось загрузить ZIP');
      setUploadProgress(0);
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createTest(problemSlug!, {
        input: manualInput,
        expected_output: manualOutput,
        is_sample: isSample,
        order: tests.length,
      }),
    onSuccess: () => {
      toast.success('Тест добавлен');
      setManualInput('');
      setManualOutput('');
      setIsSample(false);
      invalidateTests();
      setTab('list');
    },
    onError: () => toast.error('Не удалось добавить тест'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTest(problemSlug!, id),
    onSuccess: () => {
      toast.success('Тест удалён');
      invalidateTests();
    },
    onError: () => toast.error('Не удалось удалить тест'),
  });

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('Файл должен быть .zip');
      return;
    }
    setZipFile(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files[0] ?? null);
  };

  if (!problemSlug) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        Сначала сохраните задачу
      </div>
    );
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: 'zip', label: 'Загрузить ZIP' },
    { value: 'manual', label: 'Добавить вручную' },
    { value: 'list', label: `Тесты (${tests.length})` },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex border-b border-gray-200">
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={`px-4 py-3 text-sm font-medium ${
              tab === item.value
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'zip' && (
          <div className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 px-6 py-10 text-center transition hover:border-solid hover:border-indigo-400 hover:bg-indigo-50/30"
            >
              <p className="text-sm text-gray-600">
                Перетащи .zip сюда или нажми для выбора
              </p>
              {zipFile && (
                <p className="mt-2 text-sm font-medium text-gray-900">
                  {zipFile.name} ({formatFileSize(zipFile.size)})
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <details className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              <summary className="cursor-pointer font-medium text-gray-700">Формат ZIP</summary>
              <p className="mt-2 font-mono text-xs">
                1.in / 1.out, sample_1.in / sample_1.out
              </p>
            </details>

            {uploadMutation.isPending && (
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-indigo-600 transition-all"
                  style={{ width: `${uploadProgress || 30}%` }}
                />
              </div>
            )}

            <button
              type="button"
              disabled={!zipFile || uploadMutation.isPending}
              onClick={() => zipFile && uploadMutation.mutate(zipFile)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Загрузить
            </button>
          </div>
        )}

        {tab === 'manual' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Входные данные</label>
              <textarea
                rows={4}
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Ожидаемый вывод</label>
              <textarea
                rows={4}
                value={manualOutput}
                onChange={(e) => setManualOutput(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isSample}
                onChange={(e) => setIsSample(e.target.checked)}
                className="rounded border-gray-300"
              />
              Пример (виден пользователям)
            </label>
            <button
              type="button"
              disabled={!manualInput.trim() || !manualOutput.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Добавить тест
            </button>
          </div>
        )}

        {tab === 'list' && (
          <div className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-gray-500">Загрузка...</p>
            ) : tests.length === 0 ? (
              <p className="text-sm text-gray-500">
                Тестов нет. Загрузи ZIP для быстрого добавления.
              </p>
            ) : (
              tests.map((test: AdminTestCase, index) => (
                <div
                  key={test.id}
                  className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">#{index + 1}</span>
                      {test.is_sample && (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                          Sample
                        </span>
                      )}
                    </div>
                    <pre className="truncate font-mono text-xs text-gray-600">{test.input}</pre>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(test.id)}
                    className="shrink-0 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    title="Удалить"
                  >
                    🗑
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
