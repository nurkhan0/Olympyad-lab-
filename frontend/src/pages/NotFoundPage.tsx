import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-300">404</h1>
      <p className="mt-4 text-xl text-gray-700">Страница не найдена</p>
      <Link to="/" className="mt-6 text-indigo-600 hover:text-indigo-500">
        На главную
      </Link>
    </div>
  );
}
