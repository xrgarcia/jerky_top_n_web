import { create } from 'zustand';
import { setUserContext, clearUserContext } from '../utils/sentry';

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isEmployee: false,
  userRole: 'user',
  isLoading: true,

  setUser: (user, role = 'user') => {
    set({ 
      user, 
      isAuthenticated: !!user, 
      isEmployee: role === 'employee_admin',
      userRole: role,
      isLoading: false 
    });
    
    if (user) {
      setUserContext({ ...user, role });
    }
  },

  clearAuth: () => {
    set({ 
      user: null, 
      isAuthenticated: false, 
      isEmployee: false,
      userRole: 'user', 
      isLoading: false 
    });
    
    clearUserContext();
  },
  
  logout: async () => {
    try {
      await fetch('/api/customer/logout', { method: 'POST', credentials: 'include' });
      set({ user: null, isAuthenticated: false, isEmployee: false, userRole: 'user' });
      
      clearUserContext();
      
      const { broadcastAuthChange } = await import('../context/AuthContext');
      broadcastAuthChange();
      
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  },
}));
