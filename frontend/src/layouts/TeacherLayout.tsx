import { Link, Outlet, useNavigate } from 'react-router-dom';

import { logout } from '../api/authApi';
import { useAuthStore } from '../store/authStore';

export default function TeacherLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout(); // revokes the refresh token server-side and clears the cookie
    } catch {
      // Even if the backend is unreachable, the local session must end.
    }
    useAuthStore.getState().clearAuth();
    navigate('/login');
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-gray-50">
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-5">
          <Link to="/teacher" className="flex items-center gap-2 text-lg font-bold text-gray-900">
            🐍 python Olympiad Lab
            <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Teacher
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <Link
            to="/teacher"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            📊 Панель управления
          </Link>
          <Link
            to="/teacher/courses"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            📚 Мои курсы
          </Link>
          <Link
            to="/teacher/students"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            👥 Студенты
          </Link>
        </nav>

        <div className="border-t border-gray-200 px-4 py-4">
          <button
            onClick={handleLogout}
            className="w-full text-sm text-red-600 hover:text-red-700"
          >
            Выйти
          </button>
          <Link to="/" className="block mt-2 text-sm text-indigo-600 hover:text-indigo-700">
            ← На сайт
          </Link>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
