import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  
  logout: async () => {
    try {
      await fetch('/api/customer/logout', { method: 'POST', credentials: 'include' });
      localStorage.removeItem('sessionId');
      set({ user: null, isAuthenticated: false });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  },

  checkAuth: async () => {
    try {
      const response = await fetch('/api/customer/status', { credentials: 'include' });
      const data = await response.json();
      
      if (data.authenticated && data.customer) {
        set({ user: data.customer, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
