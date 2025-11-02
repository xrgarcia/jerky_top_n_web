import React, { createContext, useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';

const AuthContext = createContext(null);

const AUTH_BROADCAST_CHANNEL = 'jerky-auth';

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const { setUser, clearAuth } = useAuthStore();

  const authQuery = useQuery({
    queryKey: ['auth-status'],
    queryFn: async () => {
      console.log('🔍 React Query: Fetching auth status...');
      const response = await fetch('/api/customer/status', { 
        credentials: 'include' 
      });
      const data = await response.json();
      console.log('📋 React Query: Auth response:', { 
        authenticated: data.authenticated, 
        role: data.role, 
        user: data.customer?.firstName 
      });
      return data;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 1,
  });

  useEffect(() => {
    if (authQuery.data) {
      if (authQuery.data.authenticated && authQuery.data.customer) {
        const role = authQuery.data.role || 'user';
        console.log('✅ React Query: Setting authenticated state - role:', role, 'isEmployee:', role === 'employee_admin');
        setUser(authQuery.data.customer, role);
      } else {
        console.log('❌ React Query: Setting unauthenticated state');
        clearAuth();
      }
    }
  }, [authQuery.data, setUser, clearAuth]);

  useEffect(() => {
    if (authQuery.isError && !authQuery.isFetching) {
      console.error('❌ React Query: Auth query error (initial or refetch), clearing auth state:', authQuery.error);
      clearAuth();
    }
  }, [authQuery.isError, authQuery.isFetching, authQuery.error, clearAuth]);

  useEffect(() => {
    let channel;
    
    try {
      channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
      console.log('📡 BroadcastChannel initialized for auth events');
      
      channel.onmessage = (event) => {
        console.log('📨 BroadcastChannel received:', event.data);
        
        if (event.data === 'auth-changed') {
          console.log('🔄 Auth changed - clearing state and invalidating queries...');
          // Clear auth store immediately to prevent privilege leakage during refetch
          clearAuth();
          // Remove cached super admin access to prevent reuse
          queryClient.removeQueries({ queryKey: ['superAdminAccess'] });
          // Invalidate auth to refetch current status
          queryClient.invalidateQueries({ queryKey: ['auth-status'] });
        }
      };
    } catch (error) {
      console.warn('⚠️ BroadcastChannel not supported, using localStorage fallback');
      
      const handleStorageChange = (e) => {
        if (e.key === 'jerky-auth-event' && e.newValue) {
          console.log('📨 localStorage auth event received:', e.newValue);
          // Clear auth store immediately to prevent privilege leakage during refetch
          clearAuth();
          // Remove cached super admin access to prevent reuse
          queryClient.removeQueries({ queryKey: ['superAdminAccess'] });
          // Invalidate auth to refetch current status
          queryClient.invalidateQueries({ queryKey: ['auth-status'] });
          localStorage.removeItem('jerky-auth-event');
        }
      };
      
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    }
    
    return () => {
      if (channel) {
        channel.close();
      }
    };
  }, [queryClient, clearAuth]);

  const value = {
    authQuery,
    isLoading: authQuery.isLoading,
    isAuthenticated: authQuery.data?.authenticated ?? false,
    user: authQuery.data?.customer ?? null,
    role: authQuery.data?.role ?? 'user',
    isEmployee: (authQuery.data?.role ?? 'user') === 'employee_admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function broadcastAuthChange() {
  try {
    const channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    console.log('📤 Broadcasting auth-changed event');
    channel.postMessage('auth-changed');
    channel.close();
  } catch (error) {
    console.log('📤 Broadcasting auth-changed via localStorage (fallback)');
    localStorage.setItem('jerky-auth-event', Date.now().toString());
    setTimeout(() => localStorage.removeItem('jerky-auth-event'), 1000);
  }
}
