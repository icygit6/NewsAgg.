import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from './routes';
import { AppProvider } from './contexts/AppContext';
import { queryClient } from './lib/queryClient';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        {/* Google sign-in buttons carry their own localized provider
            (components/auth/LocalizedGoogleLogin). */}
        <RouterProvider router={router} />
      </AppProvider>
    </QueryClientProvider>
  );
}
