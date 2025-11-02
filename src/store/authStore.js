import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isEmployee: false,
  userRole: 'user',
  isLoading: true,

  setUser: (user, role = 'user') => set({ 
    user, 
    isAuthenticated: !!user, 
    isEmployee: role === 'employee_admin',
    userRole: role,
    isLoading: false 
  }),
  
  logout: async () => {
    try {
      await fetch('/api/customer/logout', { method: 'POST', credentials: 'include' });
      localStorage.removeItem('sessionId');
      set({ user: null, isAuthenticated: false, isEmployee: false, userRole: 'user' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  },

  checkAuth: async () => {
    try {
      console.log('🔍 checkAuth called - fetching /api/customer/status');
      const response = await fetch('/api/customer/status', { credentials: 'include' });
      const data = await response.json();
      
      console.log('📋 Auth response:', { authenticated: data.authenticated, role: data.role, user: data.customer?.firstName });
      
      if (data.authenticated && data.customer) {
        const role = data.role || 'user';
        console.log('✅ Setting authenticated state - role:', role, 'isEmployee:', role === 'employee_admin');
        set({ 
          user: data.customer, 
          isAuthenticated: true, 
          isEmployee: role === 'employee_admin',
          userRole: role,
          isLoading: false 
        });
      } else {
        console.log('❌ Setting unauthenticated state');
        set({ user: null, isAuthenticated: false, isEmployee: false, userRole: 'user', isLoading: false });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      set({ user: null, isAuthenticated: false, isEmployee: false, userRole: 'user', isLoading: false });
    }
  },
}));
