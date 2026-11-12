import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { getCourse, enrollCourse } from '../api/educationApi';
import { useAuthStore } from '../store/authStore';
import type { CourseDetail, Material, Module } from '../types/education';

function ContentSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="h-4 w-1/3 rounded bg-gray-200 animate-pulse mb-4" />
      <div className="h-4 w-3/4 rounded bg-gray-200 animate-pulse mb-6" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mb-4">
          <div className="h-4 w-1/2 rounded bg-gray-200 animate-pulse mb-2" />
          <div className="h-4 w-full rounded bg-gray-200 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function getYouTubeId(url: string): string | null {
  const match =
    url.match(/(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/) ||
    url.match(/^[a-zA-Z0-9_-]{11}$/);
  return match ? match[1] : null;
}

function firstPublishedLesson(modules: Module[]): string | string {
  for (const module of modules) {
    const lesson = module.lessons.find((l) => l.is_published);
    if (lesson) return lesson.id;
  }
  return modules[0]?.lessons[0]?.id ?? '';
}

function MaterialItem({ material }: { material: Material }) {
  const isVideo = material.type === 'video';
  const youtubeId = isVideo && material.url ? getYouTubeId(material.url) : null;

  return (
    <div key={material.id} className="border border-gray-200 rounded-xl overflow-hidden hover:border-indigo-200 transition-colors">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start gap-3 bg-gray-50">
        <div className="mt-1 flex-shrink-0">
          {isVideo ? (
            <span className="flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Видео
            </span>
          ) : material.type === 'link' ? (
            <span className="flex items-center gap-1 rounded bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4l6 6-6 6"
                />
              </svg>
              Ссылка
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m-6 4h6m-6 4h6M9 16V9m0 0V0m0 12h9m-9 4H9m-3 0v9m0-9H0m12 0h9m-9 4H3"
                />
              </svg>
              {material.type}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 leading-tight">{material.title}</div>
          {youtubeId ? (
            <div className="mt-3 w-full aspect-video rounded-lg border border-gray-200 overflow-hidden bg-black">
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${youtubeId}?rel=0`}
                title={material.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          ) : material.url ? (
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-indigo-600 text-sm font-medium hover:underline hover:text-indigo-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4l6 6-6 6"
                />
              </svg>
              Открыть ссылку
            </a>
          ) : material.content ? (
            <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
              {material.content}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CourseHeaderBar({ course, userRole, isTeacher }: { course: CourseDetail; userRole: string | undefined; isTeacher: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleBack = () => {
    navigate('/courses');
  };

  const handleEnroll = async () => {
    try {
      await enrollCourse(course.id);
      // Refresh the course payload so enrollment state and counters update.
      queryClient.invalidateQueries({ queryKey: ['education-course', course.id] });
      toast.success('Запись на курс оформлена');
    } catch {
      toast.error('Не удалось записаться на курс');
    }
  };

  return (
    <div className="mb-6">
      {/* Top nav bar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-indigo-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Курсы
        </button>
        <span className="h-3 w-px bg-gray-300" />
        <span className="text-sm text-gray-500">{course.title}</span>
      </div>

      {/* Category + status badges */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {course.category && (
          <span className="inline-flex items-center gap-1 rounded bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 uppercase tracking-tighter">
            {course.category.title}
          </span>
        )}
        {course.start_at && (
          <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 uppercase tracking-tighter">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Открыт по расписанию
          </span>
        )}
        {!course.is_published && (
          <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 uppercase tracking-tighter">
            Не опубликован
          </span>
        )}
      </div>

      {/* Course title */}
      <h1 className="text-3xl font-bold text-gray-900 mb-2 leading-tight">{course.title}</h1>
      <p className="text-gray-600 mb-6 max-w-2xl leading-relaxed">{course.description}</p>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Автор</div>
          <div className="mt-1 text-sm font-medium text-gray-900">{course.teacher.handle}</div>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Модулей</div>
          <div className="mt-1 text-sm font-medium text-gray-900">{course.modules.length}</div>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Занятий</div>
          <div className="mt-1 text-sm font-medium text-gray-900">
            {course.modules.reduce((sum, m) => sum + m.lessons.length, 0)}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">Студентов</div>
          <div className="mt-1 text-sm font-medium text-gray-900">{course.enrollment_count}</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {userRole === 'student' && !course.is_enrolled && course.is_published ? (
          <button
            type="button"
            onClick={handleEnroll}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all"
          >
            Записаться на курс
          </button>
        ) : (
          <>
            {userRole === 'student' && course.is_enrolled && (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-100 px-4 py-2.5 text-xs font-semibold text-green-700 uppercase tracking-tighter">
                  Вы записаны
                </span>
                {course.modules.length > 0 && (
                  <Link
                    to={`/courses/${course.id}/lessons/${firstPublishedLesson(course.modules)}`}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Продолжить обучение
                  </Link>
                )}
              </>
            )}
            {isTeacher && (
              <button
                type="button"
                onClick={() => navigate(`/teacher/courses/${course.id}/edit`)}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-400 transition-all"
              >
                Редактировать курс
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery<CourseDetail>({
    queryKey: ['education-course', id],
    queryFn: () => getCourse(id!).then((res) => res.data),
    enabled: Boolean(id),
  });

  if (isLoading) return <ContentSkeleton />;
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 17V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2zM15 17a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Курс не найден</h1>
          <p className="text-gray-500">Курс с таким идентификатором не существует.</p>
          <button
            type="button"
            onClick={() => navigate('/courses')}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Вернуться к курсам
          </button>
        </div>
      </div>
    );
  }

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <CourseHeaderBar course={data} userRole={user?.role} isTeacher={isTeacher} />

      {/* Progress overview */}
      {data.is_enrolled || user?.role === 'teacher' || user?.role === 'admin' ? (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Прогресс курса</h2>
            <span className="text-xs font-medium text-gray-500">
              {data.user_progress?.progress ?? 0}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(Math.max(data.user_progress?.progress ?? 0, 0), 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Modules */}
      <div className="space-y-6">
        {data.modules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m-6 4h6m-6 4h6M9 16V9m0 0V0m0 12h9m-9 4H9m-3 0v9m0-9H0m12 0h9m-9 4H3"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">В этом курсе пока нет модулей</h3>
            <p className="text-gray-500">Преподаватель еще не добавил занятия и материалы.</p>
          </div>
        ) : (
          data.modules.map((module) => (
            <div key={module.id} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold">
                    {module.order ?? ''}
                  </span>
                  <h2 className="font-semibold text-gray-900">{module.title}</h2>
                </div>
                <span className="text-xs font-medium text-gray-500">
                  {module.lessons.length} занятий
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {module.lessons.map((lesson) => (
                  <div key={lesson.id} className="px-5 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {lesson.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span>{lesson.materials.length} материал(ов)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {lesson.materials.length > 0 && (
                          <span className="flex items-center gap-1 rounded bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-700 border border-indigo-100">
                            {lesson.materials.length}
                          </span>
                        )}
                      </div>
                    </div>
                    {lesson.materials.map((mat) => (
                      <MaterialItem key={mat.id} material={mat} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {!data.is_published && (
        <div className="mt-8 rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 w-5 h-5 text-orange-500">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-orange-900 mb-1">Курс не опубликован</h4>
              <p className="text-sm text-orange-800">
                Этот курс не опубликован и недоступен студентам.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
