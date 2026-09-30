import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from './routes';
import { AppProvider, useApp } from './contexts/AppContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { getRuntimeConfig } from './lib/runtimeConfig';
import { queryClient } from './lib/queryClient';

function LocalizedRouter() {
  const { language } = useApp();
  const { googleClientId } = getRuntimeConfig();
  const routes = <RouterProvider router={router} />;
  return googleClientId
    ? <GoogleOAuthProvider clientId={googleClientId} locale={language === 'zhTW' ? 'zh-TW' : 'en'}>{routes}</GoogleOAuthProvider>
    : routes;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <LocalizedRouter />
      </AppProvider>
    </QueryClientProvider>
  );
}
