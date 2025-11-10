import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import AppLayout from './components/layout/AppLayout';
import { initializeSentry, Sentry } from './utils/sentry';
import './styles/global.css';
import './styles/avatar.css';

initializeSentry();

const ErrorFallback = ({ error, resetError }) => (
  <div style={{
    padding: '40px',
    maxWidth: '600px',
    margin: '100px auto',
    textAlign: 'center',
    fontFamily: 'Arial, sans-serif',
  }}>
    <h1 style={{ color: '#7b8b52', marginBottom: '20px' }}>Something went wrong</h1>
    <p style={{ color: '#666', marginBottom: '30px' }}>
      We're sorry, but an unexpected error occurred. Our team has been notified.
    </p>
    <div style={{
      background: '#f5f5f5',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '30px',
      textAlign: 'left',
      fontSize: '14px',
      color: '#333',
    }}>
      <strong>Error:</strong> {error.message}
    </div>
    <button
      onClick={resetError}
      style={{
        background: '#7b8b52',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '16px',
        marginRight: '10px',
      }}
    >
      Try Again
    </button>
    <button
      onClick={() => window.location.href = '/'}
      style={{
        background: '#c4a962',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '16px',
      }}
    >
      Go Home
    </button>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

const router = createBrowserRouter([
  {
    path: '/*',
    element: <AppLayout />,
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={ErrorFallback} showDialog>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
