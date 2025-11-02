import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

function EmployeeRoute({ children }) {
  const { isAuthenticated, isEmployee, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isEmployee) {
    return <Navigate to="/" state={{ error: 'access_denied' }} replace />;
  }

  return children;
}

export default EmployeeRoute;
