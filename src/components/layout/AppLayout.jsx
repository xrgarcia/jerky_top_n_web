import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useSocket } from '../../hooks/useSocket';
import Header from './Header';
import Nav from './Nav';
import Footer from './Footer';
import ProtectedRoute from '../auth/ProtectedRoute';
import EmployeeRoute from '../auth/EmployeeRoute';

import HomePage from '../../pages/HomePage';
import ProductsPage from '../../pages/ProductsPage';
import CoinBookPage from '../../pages/CoinBookPage';
import CommunityPage from '../../pages/CommunityPage';
import LeaderboardPage from '../../pages/LeaderboardPage';
import ProfilePage from '../../pages/ProfilePage';
import RankPage from '../../pages/RankPage';
import LoginPage from '../../pages/LoginPage';
import ToolsPage from '../../pages/ToolsPage';

import './AppLayout.css';

function AppLayout() {
  const location = useLocation();
  const { checkAuth } = useAuthStore();
  
  // Initialize WebSocket connection for real-time updates
  useSocket();

  useEffect(() => {
    // Handle login success redirect (from magic link or dev login)
    const hash = window.location.hash;
    if (hash.startsWith('#login-success')) {
      const params = new URLSearchParams(hash.split('?')[1]);
      const sessionId = params.get('sessionId');
      
      if (sessionId) {
        localStorage.setItem('sessionId', sessionId);
        console.log('✅ Session ID stored from login redirect');
        
        // Clear the hash and check auth
        window.location.hash = '';
        checkAuth();
      }
    } else {
      checkAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check auth on every route change
  useEffect(() => {
    console.log('🔄 Route changed to:', location.pathname, '- checking auth...');
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <div className="app-layout">
      <Header />
      <Nav />
      <main className="main-content fade-in">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/coinbook" element={<CoinBookPage />} />
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/rank" element={
            <ProtectedRoute>
              <RankPage />
            </ProtectedRoute>
          } />
          <Route path="/community" element={
            <ProtectedRoute>
              <CommunityPage />
            </ProtectedRoute>
          } />
          <Route path="/leaderboard" element={
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/tools" element={
            <EmployeeRoute>
              <ToolsPage />
            </EmployeeRoute>
          } />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default AppLayout;
