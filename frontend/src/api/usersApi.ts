import api from './axios';
import type { PublicProfile, User } from '../types/auth';

export interface UpdateMeData {
  email?: string;
  handle?: string;
  avatar_url?: string;
  school?: string;
  class_name?: string;
}

export const getUserProfile = (handle: string) =>
  api.get<PublicProfile>(`/users/${handle}/`);

export const getMe = () => api.get<User>('/users/me/');

export const updateMe = (data: UpdateMeData) =>
  api.patch<User>('/users/me/', data);
