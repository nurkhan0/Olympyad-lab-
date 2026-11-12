import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import FullPageSpinner from './components/FullPageSpinner';
import AppRouter from './router';
import { useAuthStore } from './store/authStore';

export default function App() {
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    useAuthStore.getState().initializeAuth();
  }, []);

  if (isLoading) {
    return <FullPageSpinner />;
  }

  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <AppRouter />
    </BrowserRouter>
  );
}
