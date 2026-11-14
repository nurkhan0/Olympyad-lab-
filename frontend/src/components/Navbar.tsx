import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { logout } from '../api/authApi';
import { useAuthStore } from '../store/authStore';

const navLinks = [
  { to: '/courses', label: 'Courses' },
  { to: '/problems', label: 'Problems' },
  { to: '/contests', label: 'Contests' },
  { to: '/submissions', label: 'Submissions', authOnly: true },
  { to: '/leaderboard', label: 'Leaderboard' },
];

export default function Navbar() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      useAuthStore.getState().clearAuth();
      navigate('/login');
    }
  };

  const authBlock = isAuthenticated ? (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
          {user?.handle?.[0]?.toUpperCase() ?? '?'}
        </span>
        <span className="hidden sm:inline">{user?.handle}</span>
        <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {dropdownOpen && (
        <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          <Link
            to={`/profile/${user?.handle}`}
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => setDropdownOpen(false)}
          >
            Мой профиль
          </Link>
          <Link
            to="/settings"
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => setDropdownOpen(false)}
          >
            Настройки
          </Link>
          {user?.role === 'admin' && (
            <Link
              to="/admin/problems"
              className="block px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50"
              onClick={() => setDropdownOpen(false)}
            >
              Admin ⚙
            </Link>
          )}
          {(user?.role === 'teacher' || user?.role === 'admin') && (
            <Link
              to="/teacher"
              className="block px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50"
              onClick={() => setDropdownOpen(false)}
            >
              Teacher Dashboard 📊
            </Link>
          )}
          {(user?.role === 'student' || user?.role === 'teacher' || user?.role === 'admin') && (
            <Link
              to="/my-learning"
              className="block px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50"
              onClick={() => setDropdownOpen(false)}
            >
              Моё обучение 🎓
            </Link>
          )}
          {(user?.role === 'student' || user?.role === 'teacher' || user?.role === 'admin') && (
            <Link
              to="/my-learning/analytics"
              className="block px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50"
              onClick={() => setDropdownOpen(false)}
            >
              Моя аналитика 📈
            </Link>
          )}
          {(user?.role === 'student' || user?.role === 'teacher' || user?.role === 'admin') && (
            <Link
              to="/contests"
              className="block px-4 py-2 text-sm text-indigo-600 hover:bg-gray-50"
              onClick={() => setDropdownOpen(false)}
            >
              Олимпиады 🏆
            </Link>
          )}
          <hr className="my-1 border-gray-100" />
          <button
            type="button"
            onClick={handleLogout}
            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
          >
            Выйти
          </button>
        </div>
      )}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link
        to="/login"
        className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
      >
        Войти
      </Link>
      <Link
        to="/register"
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Регистрация
      </Link>
    </div>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link to="/" className="text-lg font-bold text-gray-900">
🐍 python Olympiad Lab
          </Link>
          <nav className="hidden items-center gap-4 md:flex">
            {navLinks
              .filter((link) => !link.authOnly || isAuthenticated)
              .map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm font-medium text-gray-600 hover:text-indigo-600"
                >
                  {link.label}
                </Link>
              ))}
          </nav>
        </div>

        <div className="hidden md:block">{authBlock}</div>

        <button
          type="button"
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 flex h-full w-72 flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-4">
              <span className="font-bold text-gray-900">🐍 python Olympiad Lab</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 hover:bg-gray-100"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-4">
              {navLinks
                .filter((link) => !link.authOnly || isAuthenticated)
                .map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              {isAuthenticated ? (
                <>
                  <Link
                    to={`/profile/${user?.handle}`}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Мой профиль
                  </Link>
                  <Link
                    to="/settings"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Настройки
                  </Link>
                  {user?.role === 'admin' && (
                    <Link
                      to="/admin/problems"
                      className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-gray-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Admin ⚙
                    </Link>
                  )}
                  {(user?.role === 'teacher' || user?.role === 'admin') && (
                    <Link
                      to="/teacher"
                      className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-gray-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Teacher Dashboard 📊
                    </Link>
                  )}
                  {(user?.role === 'student' || user?.role === 'teacher' || user?.role === 'admin') && (
                    <Link
                      to="/my-learning"
                      className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-gray-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Моё обучение 🎓
                    </Link>
                  )}
                  {(user?.role === 'student' || user?.role === 'teacher' || user?.role === 'admin') && (
                    <Link
                      to="/my-learning/analytics"
                      className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-gray-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Моя аналитика 📈
                    </Link>
                  )}
                  {(user?.role === 'student' || user?.role === 'teacher' || user?.role === 'admin') && (
                    <Link
                      to="/contests"
                      className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-gray-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Олимпиады 🏆
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                    className="rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-gray-50"
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Войти
                  </Link>
                  <Link
                    to="/register"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-gray-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Регистрация
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
