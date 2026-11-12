export interface Category {
  id: string;
  title: string;
  slug: string;
  description: string;
  course_count?: number;
  created_at: string;
}

export interface Material {
  id: string;
  title: string;
  type: 'pdf' | 'video' | 'link' | 'text' | 'code';
  url?: string;
  content?: string;
  order: number;
  created_at: string;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  content_html: string;
  order: number;
  estimated_minutes: number;
  is_published: boolean;
  materials: Material[];
  problem_count: number;
  created_at: string;
  updated_at: string;
}

export interface LessonProblem {
  id: string;
  problem: string;
  problem_title: string;
  problem_slug: string;
  problem_status: string;
  problem_difficulty: string;
  order: number;
  is_required: boolean;
  created_at: string;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
  created_at: string;
  updated_at: string;
}

export interface CourseTeacher {
  id: string;
  email: string;
  handle: string;
}

export interface CourseList {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: Category | null;
  teacher_name: string;
  is_published: boolean;
  start_at: string | null;
  end_at: string | null;
  thumbnail_url: string;
  enrollment_count: number;
  module_count: number;
  total_lessons: number;
  created_at: string;
  updated_at: string;
}

export interface CourseProgress {
  progress: number;
  status: 'active' | 'completed' | 'dropped';
}

export interface CourseDetail extends CourseList {
  teacher: CourseTeacher;
  modules: Module[];
  is_enrolled: boolean;
  user_progress: CourseProgress | null;
}

export interface CreateCourseDto {
  title: string;
  description: string;
  category?: string;
  thumbnail_url?: string;
  is_published?: boolean;
  start_at?: string | null;
  end_at?: string | null;
}

export interface CreateCategoryDto {
  title: string;
  slug?: string;
  description?: string;
}

export interface LessonProgressItem {
  id: string;
  lesson: string;
  lesson_title: string;
  lesson_order: number;
  module_title: string;
  module_order: number;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  time_spent_minutes: number;
}

export interface EnrollmentStudent {
  id: string;
  handle: string;
  avatar_url: string;
}

export interface Enrollment {
  id: string;
  course: CourseList;
  student: EnrollmentStudent | null;
  status: 'active' | 'completed' | 'dropped';
  enrolled_at: string;
  completed_at: string | null;
  progress: number;
  last_accessed: string | null;
  lesson_progress: LessonProgressItem[];
}

// --- Analytics ---

export interface StudentAnalytics {
  total_submissions: number;
  accepted_submissions: number;
  accuracy: number;
  solved_problems: number;
  active_courses: number;
  lessons_completed: number;
}

export interface CourseAnalyticsStudent {
  student: {
    id: string;
    handle: string;
    avatar_url: string;
  };
  progress: number;
  lessons_completed: number;
  lessons_total: number;
  attempts: number;
  accepted_submissions: number;
  accuracy: number;
  solved_problems: number;
}

export interface CourseAnalytics {
  course_id: string;
  course_title: string;
  problem_count: number;
  students: CourseAnalyticsStudent[];
}
