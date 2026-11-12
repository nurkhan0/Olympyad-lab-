import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import {
  getCourse,
  getLesson,
  listEnrollments,
  listLessonProgress,
  listLessonProblems,
  startLessonProgress,
  completeLessonProgress,
} from '../api/educationApi';
import { useAuthStore } from '../store/authStore';
import type {
  CourseDetail,
  Enrollment,
  Lesson,
  LessonProgressItem,
  LessonProblem,
  Material,
} from '../types/education';

function LessonSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="h-4 w-1/3 rounded bg-gray-200 animate-pulse mb-4" />
      <div className="h-4 w-3/4 rounded bg-gray-200 animate-pulse mb-6" />
      <div className="h-96 rounded-xl bg-gray-200 animate-pulse mb-6" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="mb-4 animate-pulse rounded-lg border border-gray-200 bg-gray-100 p-4">
          <div className="h-4 w-1/2 rounded bg-gray-200" />
          <div className="mt-2 h-4 w-3/4 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

export default function LessonViewPage() {
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isStudent = user?.role === 'student';

  const { data: course, isLoading: courseLoading, isError: courseError } = useQuery<CourseDetail>({
    queryKey: ['education-course', courseId],
    queryFn: () => getCourse(courseId!).then((res) => res.data),
    enabled: Boolean(courseId),
  });

  const { data: lesson, isLoading: lessonLoading, isError: lessonError } = useQuery<Lesson>({
    queryKey: ['education-lesson', courseId, lessonId],
    queryFn: () => {
      // Find the module that contains this lesson
      const module = course?.modules.find((m) =>
        m.lessons.some((l) => l.id === lessonId),
      );
      const moduleId = module?.id;
      if (!moduleId) throw new Error('Module not found');
      return getLesson(courseId!, moduleId, lessonId!).then((res) => res.data);
    },
    enabled: Boolean(courseId && lessonId && course),
  });

  // Find enrollment for this course
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery<Enrollment[]>({
    queryKey: ['student-enrollments'],
    queryFn: () => listEnrollments(),
    enabled: Boolean(courseId && isStudent),
  });

  const enrollment = enrollments?.find((e) => e.course.id === courseId);
  const enrollmentId = enrollment?.id;

  // Find lesson progress for this lesson within the enrollment
  const { data: lessonProgress, isLoading: progressLoading } = useQuery<LessonProgressItem[]>({
    queryKey: ['lesson-progress', enrollmentId, lessonId],
    queryFn: () =>
      listLessonProgress(enrollmentId!),
    enabled: Boolean(enrollmentId && lessonId),
  });

  const progressRow = lessonProgress?.find((p) => p.lesson === lessonId);
  const isStarted = progressRow?.status === 'in_progress' || progressRow?.status === 'completed';
  const isCompleted = progressRow?.status === 'completed';

  // Compute moduleId for lesson problems query
  const lessonModule = course?.modules.find((m) =>
    m.lessons.some((l) => l.id === lessonId),
  );
  const lessonModuleId = lessonModule?.id;

  // Find lesson problems for this lesson (practice problems)
  const { data: lessonProblems, isLoading: problemsLoading } = useQuery<LessonProblem[]>({
    queryKey: ['lesson-problems', courseId, lessonModuleId, lessonId],
    queryFn: () => {
      if (!lessonModuleId) throw new Error('Module not found');
      return listLessonProblems(courseId!, lessonModuleId, lessonId!);
    },
    enabled: Boolean(courseId && lessonId && course && lessonModuleId),
  });

  const startMutation = useMutation({
    mutationFn: () =>
      startLessonProgress(enrollmentId!, progressRow!.id).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-progress', enrollmentId, lessonId] });
      queryClient.invalidateQueries({ queryKey: ['education-course', courseId] });
      toast.success('Занятие начато');
    },
    onError: () => toast.error('Не удалось начать занятие'),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      completeLessonProgress(enrollmentId!, progressRow!.id).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-progress', enrollmentId, lessonId] });
      queryClient.invalidateQueries({ queryKey: ['education-course', courseId] });
      toast.success('Занятие завершено');
    },
    onError: (err) => {
      if (isAxiosError(err) && err.response?.status === 400) {
        toast.error(err.response.data?.error || 'Не удалось завершить занятие');
      } else {
        toast.error('Не удалось завершить занятие');
      }
    },
  });

  if (courseLoading || lessonLoading || enrollmentsLoading || progressLoading || problemsLoading) {
    return <LessonSkeleton />;
  }

  if (courseError || lessonError || !course || !lesson) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Занятие не найдено</h1>
          <p className="text-gray-500">Занятие с таким идентификатором не существует.</p>
          <Link
            to={`/courses/${courseId}`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Вернуться к курсу
          </Link>
        </div>
      </div>
    );
  }

  // Find module containing this lesson
  const module = course.modules.find((m) => m.lessons.some((l) => l.id === lessonId));

  // Prev/next lesson navigation
  const allLessons = course.modules.flatMap((m) => m.lessons.filter((l) => l.is_published));
  const currentLessonIndex = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = currentLessonIndex > 0 ? allLessons[currentLessonIndex - 1] : null;
  const nextLesson = currentLessonIndex < allLessons.length - 1 ? allLessons[currentLessonIndex + 1] : null;

  const isEnrolled = course.is_enrolled || (user?.role === 'teacher') || (user?.role === 'admin');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <nav className="mb-6 flex items-center gap-1 text-sm text-gray-500">
        <Link to="/courses" className="hover:text-indigo-600">Курсы</Link>
        <span className="mx-1">/</span>
        <Link to={`/courses/${courseId}`} className="hover:text-indigo-600">
          {course.title}
        </Link>
        <span className="mx-1">/</span>
        <span className="text-gray-900 font-medium">{lesson.title}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main content */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 uppercase tracking-tighter mb-1">
                {module ? `Модуль ${module.order}` : ''} •
                Занятие {lesson.order} из {allLessons.length}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{lesson.title}</h1>
              {lesson.estimated_minutes && (
                <p className="text-sm text-gray-500">
                  ⏱ Примерно {lesson.estimated_minutes} мин.
                </p>
              )}
            </div>
            {isStudent && isEnrolled && enrollmentId && progressRow && (
              <div className="flex items-center gap-2">
                {!isStarted && (
                  <button
                    type="button"
                    onClick={() => startMutation.mutate()}
                    disabled={startMutation.isPending}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                  >
                    Начать занятие
                  </button>
                )}
                {isStarted && !isCompleted && (
                  <button
                    type="button"
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-60"
                  >
                    Завершить занятие
                  </button>
                )}
                {isCompleted && (
                  <span className="rounded bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700">
                    Завершено
                  </span>
                )}
              </div>
            )}
          </div>

          {lesson.content_html ? (
            <div className="prose prose-pre:bg-slate-900 prose-pre:text-slate-100 max-w-none" dangerouslySetInnerHTML={{ __html: lesson.content_html }} />
          ) : lesson.content ? (
            <div className="whitespace-pre-wrap leading-relaxed text-gray-700">{lesson.content}</div>
          ) : null}

          {lesson.materials.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                Материалы занятия
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lesson.materials.map((material) => (
                  <MaterialCard key={material.id} material={material} />
                ))}
              </div>
            </section>
          )}

          {(lessonProblems ?? []).length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                Практические задачи
              </h2>
              <div className="space-y-3">
                {(lessonProblems ?? []).map((lp) => {
                  const difficultyColors: Record<string, string> = {
                    easy: 'bg-green-100 text-green-700',
                    medium: 'bg-yellow-100 text-yellow-700',
                    hard: 'bg-orange-100 text-orange-700',
                    expert: 'bg-red-100 text-red-700',
                  };
                  const difficultyLabels: Record<string, string> = {
                    easy: 'Легкая',
                    medium: 'Средняя',
                    hard: 'Сложная',
                    expert: 'Эксперт',
                  };
                  return (
                    <div
                      key={lp.id}
                      className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${difficultyColors[lp.problem_difficulty] ?? 'bg-gray-100 text-gray-700'}`}
                          >
                            {difficultyLabels[lp.problem_difficulty] ?? lp.problem_difficulty}
                          </span>
                          {lp.is_required && (
                            <span className="text-[10px] font-bold uppercase tracking-tighter text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                              Обязательная
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-medium text-gray-900">{lp.problem_title}</span>
                          <span className="text-xs text-gray-400">·</span>
                          <span className="text-xs text-gray-500">
                            {lp.problem_status === 'published' ? 'Опубликована' : 'Черновик'}
                          </span>
                        </div>
                      </div>
                      <Link
                        to={`/problems/${lp.problem_slug}`}
                        className="text-indigo-600 text-sm font-medium hover:text-indigo-700 hover:underline"
                      >
                        Открыть задачу
                      </Link>
                    </div>
                  );
                })}
              </div>
              {(lessonProblems ?? []).filter((lp) => lp.is_required).length > 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  Задачи, помеченные как «Обязательная», требуются для завершения занятия.
                </p>
              )}
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Progress card */}
          {isStudent && isEnrolled && enrollmentId && progressRow && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                Прогресс занятия
              </h2>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs font-medium mb-1">
                    <span className="text-gray-500">Статус</span>
                    {statusBadge(progressRow.status)}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: progressRow.status === 'completed' ? '100%' : progressRow.status === 'in_progress' ? '50%' : '0%' }}
                    />
                  </div>
                </div>
                {progressRow.started_at && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Начато:</span>
                    <span>{new Date(progressRow.started_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                )}
                {progressRow.completed_at && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>Завершено:</span>
                    <span>{new Date(progressRow.completed_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Навигация
            </h2>
            <div className="space-y-3">
              {prevLesson && (
                <Link
                  to={`/courses/${courseId}/lessons/${prevLesson.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Предыдущее занятие
                  </span>
                  <span className="text-indigo-600">{prevLesson.title}</span>
                </Link>
              )}
              {nextLesson && (
                <Link
                  to={`/courses/${courseId}/lessons/${nextLesson.id}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-indigo-600">{nextLesson.title}</span>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                  <span className="ml-2">Следующее занятие</span>
                </Link>
              )}
              {!prevLesson && !nextLesson && (
                <p className="text-xs text-gray-500">Это единственное занятие в курсе.</p>
              )}
            </div>
          </div>

          {/* Back to course */}
          <Link
            to={`/courses/${courseId}`}
            className="block rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:border-indigo-200 transition-colors text-center"
          >
            ← Вернуться к курсу
          </Link>
        </div>
      </div>
    </div>
  );
}

function statusBadge(status: LessonProgressItem['status']) {
  const variants: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
  };
  const labels: Record<string, string> = {
    not_started: 'Не начато',
    in_progress: 'В процессе',
    completed: 'Завершено',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${variants[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {labels[status] ?? status}
    </span>
  );
}

function MaterialCard({ material }: { material: Material }) {
  const isVideo = material.type === 'video';
  const isPdf = material.type === 'pdf';
  const isLink = material.type === 'link';
  const isCode = material.type === 'code';
  const isText = material.type === 'text';

  const getIcon = () => {
    if (isVideo) return <VideoIcon className="text-blue-600" />;
    if (isPdf) return <FileIcon className="text-red-500" />;
    if (isLink) return <LinkIcon className="text-green-600" />;
    if (isCode) return <CodeIcon className="text-indigo-600" />;
    return <TextIcon className="text-gray-500" />;
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-200 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        {getIcon()}
        <span className="font-medium text-gray-900">{material.title}</span>
      </div>
      <div className="text-xs text-gray-500 mb-3">{material.type}</div>
      {isVideo && material.url ? (
        <div className="aspect-video rounded-lg border border-gray-200 overflow-hidden bg-black mb-3">
          <iframe
            className="w-full h-full"
            src={getYouTubeEmbedUrl(material.url)}
            title={material.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      ) : null}
      {isLink && material.url ? (
        <a
          href={material.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-indigo-600 text-sm font-medium hover:underline"
        >
          Открыть ссылку
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9l-.007 1.777c0 .143.006.284.017.424.021.273.093.528.214.745l1.394 1.394c.217.217.472.326.745.214.14.011.281.017.424.017l1.777-.007c.386 0 .749-.155 1.022-.428l1.393-1.393a2 2 0 00.286-.732c0-.18-.017-.357-.025-.536a2 2 0 00-.114-.563c-.02-.108-.05-.208-.107-.299a1 1 0 00-.23-.272c-.113-.11-.244-.198-.394-.247a2 2 0 00-.598-.2c-.276-.037-.56-.05-.832-.044zM13 14l.001-.034-.001-.064-.001-.102c0-.334.02-.663.057-.984.053-.488.172-.946.34-1.382.092-.244.22-.455.377-.642.129-.156.274-.284.434-.387.17-.109.354-.184.547-.233.191-.048.388-.063.585-.063h.004c.197 0 .394.014.59.064.171.045.353.12.522.213.147.083.286.187.406.317.168.181.31.388.395.61.077.198.143.414.184.642.168.436.287.894.34 1.382.037.321.057.65.057.984v.066l-.001.103-.001.064-.001.034c0 .334-.02.663-.057.984-.053.488-.172.946-.34 1.382-.092.244-.22.455-.377.642-.129.156-.274.284-.434.387-.17.109-.354.184-.547.233-.191.048-.388.063-.585.063h-.004c-.197 0-.394-.014-.59-.064-.171-.045-.353-.12-.522-.213-.147-.083-.286-.187-.406-.317-.168-.181-.31-.388-.395-.61-.077-.198-.143-.414-.184-.642-.168-.436-.287-.894-.34-1.382-.037-.321-.057-.65-.057-.984z" />
          </svg>
        </a>
      ) : null}
      {isPdf && material.url ? (
        <a
          href={material.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-indigo-600 text-sm font-medium hover:underline"
        >
          Открыть PDF
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-6 4h6m-6 4h6M9 16V9m0 0V0m0 12h9m-9 4H9m-3 0v9m0-9H0m12 0h9m-9 4H3" />
          </svg>
        </a>
      ) : null}
      {isText && material.content ? (
        <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{material.content}</div>
      ) : null}
      {isCode && material.content ? (
        <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto font-mono text-sm text-slate-300">
          {material.content}
        </div>
      ) : null}
      {!material.url && !material.content && !isVideo ? (
        <p className="text-xs text-gray-400 italic">Нет содержимого для отображения</p>
      ) : null}
    </div>
  );
}

function getYouTubeEmbedUrl(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  const videoId = match ? match[1] : url;
  return `https://www.youtube.com/embed/${videoId}?rel=0`;
}

function VideoIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function FileIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

function LinkIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4l6 6-6 6" />
    </svg>
  );
}

function CodeIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

function TextIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m-6 4h6m-6 4h6M9 16V9m0 0V0m0 12h9m-9 4H9m-3 0v9m0-9H0m12 0h9m-9 4H3" />
    </svg>
  );
}
