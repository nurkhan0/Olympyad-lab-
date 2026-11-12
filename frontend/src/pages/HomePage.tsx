import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div className="bg-gradient-to-b from-indigo-50 to-white">
      <section className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 sm:py-32">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
          Code. Compete. Improve.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          Платформа для соревновательного программирования — решай задачи, участвуй в контестах и расти в рейтинге.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/problems"
            className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-700"
          >
            Начать решать →
          </Link>
          <Link
            to="/register"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Зарегистрироваться
          </Link>
        </div>
        <div className="mx-auto mt-16 grid max-w-lg grid-cols-2 gap-6 sm:max-w-xl">
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
            <p className="text-2xl font-bold text-indigo-600">150</p>
            <p className="text-sm text-gray-500">задач</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
            <p className="text-2xl font-bold text-indigo-600">1200</p>
            <p className="text-sm text-gray-500">пользователей</p>
          </div>
        </div>
      </section>
    </div>
  );
}
