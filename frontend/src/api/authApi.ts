import api from './axios';
import type { AuthResponse, User } from '../types/auth';

export const register = (d: { email: string; handle: string; password: string; password_confirm: string }) =>
  api.post('/auth/register/', d);

export const login = (d: { email: string; password: string }) =>
  api.post<AuthResponse>('/auth/login/', d);

export const logout = () => api.post('/auth/logout/');

export const refreshToken = () => api.post<{ access_token: string }>('/auth/refresh/');

export const getMe = () => api.get<User>('/users/me/');
