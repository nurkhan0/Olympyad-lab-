import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { getUserProfile } from '../api/usersApi';
import type { PublicProfile } from '../types/auth';

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
          <div className="h-4 w-24 rounded bg-gray-200 animate-pulse" />
        </div>
      </div>
      <div className="mt-6 grid gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 rounded bg-gray-200 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { handle } = useParams<{ handle: string }>();

  const { data, isLoading, isError } = useQuery<PublicProfile>({
    queryKey: ['profile', handle],
    queryFn: () => getUserProfile(handle!).then((res) => res.data),
    enabled: Boolean(handle),
  });

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900">Профиль не найден</h1>
        <p className="mt-2 text-gray-500">
          Пользователь с таким именем не существует или был удалён.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="flex flex-col md:flex-row items-start gap-8">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl font-bold">
            {data.handle.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.handle}</h1>
            <p className="text-sm text-gray-500">
              {data.role === 'admin' ? 'Администратор' : data.role === 'teacher' ? 'Преподаватель' : 'Участник'}
              {data.is_verified ? ' · Верифицировано' : ''}
            </p>
          </div>
        </div>

        <div className="md:ml-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-lg border border-gray-200 bg-white">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Рейтинг</div>
            <div className="text-2xl font-bold text-gray-900">{data.rating}</div>
          </div>
          <div className="p-4 rounded-lg border border-gray-200 bg-white">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Решено задач</div>
            <div className="text-2xl font-bold text-gray-900">{data.solved_count}</div>
          </div>
          <div className="p-4 rounded-lg border border-gray-200 bg-white">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Роль</div>
            <div className="text-sm font-medium text-gray-700 capitalize">{data.role}</div>
          </div>
          <div className="p-4 rounded-lg border border-gray-200 bg-white">
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Присоединился</div>
            <div className="text-sm font-medium text-gray-700">
              {new Date(data.created_at).toLocaleDateString('ru-RU')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
