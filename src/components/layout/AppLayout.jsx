import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import Header from './Header';
import Nav from './Nav';
import Footer from './Footer';
import ProtectedRoute from '../auth/ProtectedRoute';

import HomePage from '../../pages/HomePage';
import ProductsPage from '../../pages/ProductsPage';
import CoinBookPage from '../../pages/CoinBookPage';
import CommunityPage from '../../pages/CommunityPage';
import LeaderboardPage from '../../pages/LeaderboardPage';
import ProfilePage from '../../pages/ProfilePage';
import RankPage from '../../pages/RankPage';
import LoginPage from '../../pages/LoginPage';

import './AppLayout.css';

function AppLayout() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default AppLayout;
