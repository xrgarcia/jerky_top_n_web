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

  clearAuth: () => set({ 
    user: null, 
    isAuthenticated: false, 
    isEmployee: false, 
    userRole: 'user', 
    isLoading: false 
  }),
  
  logout: async () => {
    try {
      await fetch('/api/customer/logout', { method: 'POST', credentials: 'include' });
      localStorage.removeItem('sessionId');
      set({ user: null, isAuthenticated: false, isEmployee: false, userRole: 'user' });
      
      const { broadcastAuthChange } = await import('../context/AuthContext');
      broadcastAuthChange();
      
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  },
}));
