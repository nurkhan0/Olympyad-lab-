import { Link, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-gray-50">
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-5">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold text-gray-900">
🐍 python Olympiad Lab
            <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Admin
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <Link
            to="/admin/problems"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            📝 Задачи
          </Link>
          <span
            className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400"
            title="Phase 5"
          >
            👥 Пользователи
            <span className="ml-auto text-[10px] uppercase">Phase 5</span>
          </span>
        </nav>

        <div className="border-t border-gray-200 px-4 py-4">
          <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-700">
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
