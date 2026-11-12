import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import type { ReactNode } from 'react';

import FullPageSpinner from './FullPageSpinner';
import { useAuthStore } from '../store/authStore';

interface AdminRouteProps {
  children: ReactNode;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return <FullPageSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    toast.error('Доступ запрещён');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
