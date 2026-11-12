export interface User {
  id: string;
  email: string;
  handle: string;
  role: 'student' | 'teacher' | 'admin';
  rating: number;
  is_verified: boolean;
  is_banned: boolean;
  avatar_url: string;
  school: string;
  class_name: string;
  created_at: string;
}

export interface PublicProfile {
  handle: string;
  rating: number;
  role: string;
  is_verified: boolean;
  created_at: string;
  solved_count: number;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
