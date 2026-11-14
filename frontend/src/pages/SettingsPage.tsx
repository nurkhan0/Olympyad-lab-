import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import toast from 'react-hot-toast';

import { getMe, updateMe } from '../api/usersApi';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types/auth';

const settingsSchema = z.object({
  handle: z.string().min(3, 'Минимум 3 символа').max(20, 'Максимум 20 символов'),
  school: z.string().max(200, 'Максимум 200 символов').optional(),
  class_name: z.string().max(100, 'Максимум 100 символов').optional(),
});

type SettingsForm = z.infer<typeof settingsSchema>;

function SettingsSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Настройки профиля</h1>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 rounded bg-gray-200 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [serverError, setServerError] = useState('');

  const { data: me, isLoading } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => getMe().then((res) => res.data),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      handle: me?.handle ?? '',
      school: me?.school ?? '',
      class_name: me?.class_name ?? '',
    },
  });

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  const onSubmit = async (data: SettingsForm) => {
    setServerError('');
    try {
      const res = await updateMe(data);
      const currentToken = useAuthStore.getState().accessToken;
      if (currentToken) {
        setAuth(currentToken, res.data);
      }
      toast.success('Настройки сохранены');
    } catch (error: any) {
      if (error.response?.data) {
        const errData = error.response.data;
        if (typeof errData === 'object' && errData.handle) {
          setServerError(errData.handle[0] ?? 'Ошибка сохранения');
        } else if (typeof errData === 'string') {
          setServerError(errData);
        } else {
          setServerError('Ошибка сохранения настроек');
        }
      } else {
        setServerError('Ошибка сохранения настроек');
      }
    }
  };

  if (!me) {
    return null;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Настройки профиля</h1>

      {serverError && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={me.email}
            readOnly
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Почта используется для входа и не меняется в настройках профиля.
          </p>
        </div>

        <div>
          <label htmlFor="handle" className="mb-1 block text-sm font-medium text-gray-700">
            Имя пользователя (handle)
          </label>
          <input
            id="handle"
            type="text"
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            {...register('handle')}
          />
          {errors.handle && (
            <p className="mt-1 text-sm text-red-600">{errors.handle.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="school" className="mb-1 block text-sm font-medium text-gray-700">
            Школа
          </label>
          <input
            id="school"
            type="text"
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            {...register('school')}
          />
        </div>

        <div>
          <label htmlFor="class_name" className="mb-1 block text-sm font-medium text-gray-700">
            Класс
          </label>
          <input
            id="class_name"
            type="text"
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            {...register('class_name')}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSubmitting && (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          Сохранить
        </button>

        <div className="pt-4">
          <button
            type="button"
            onClick={() => navigate('/profile/' + me.handle)}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            ← К профилю
          </button>
        </div>
      </form>
    </div>
  );
}
