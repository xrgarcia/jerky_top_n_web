import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const REDIRECT_MESSAGES = {
  '/rank': 'Ready to rank your favorite jerky? Log in to start building your personal flavor favorites!',
  '/community': 'Want to discover fellow jerky enthusiasts? Log in to explore our community of meat lovers!',
  '/leaderboard': 'Curious about the top rankers? Log in to see who\'s leading the jerky rankings!',
  '/coinbook': 'Want to see your achievements? Log in to check out your jerky coin collection!',
  '/profile': 'Ready to view your jerky journey? Log in to see your profile and rankings!'
};

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    const message = REDIRECT_MESSAGES[location.pathname] || 'Please log in to continue your jerky journey!';
    return <Navigate to="/login" state={{ from: location, message }} replace />;
  }

  return children;
}

export default ProtectedRoute;
