import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { broadcastAuthChange } from '../../context/AuthContext';
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
import ToolsLayout from '../../pages/admin/ToolsLayout';
import CoinsPage from '../../pages/admin/CoinsPage';
import LiveUsersPage from '../../pages/admin/LiveUsersPage';
import ProductsPageAdmin from '../../pages/admin/ProductsPage';
import OrderItemsPage from '../../pages/admin/OrderItemsPage';
import SentryPage from '../../pages/admin/SentryPage';
import DataPage from '../../pages/admin/DataPage';

import './AppLayout.css';

function AppLayout() {
  // Initialize WebSocket connection for real-time updates
  useSocket();

  useEffect(() => {
    // Handle login success redirect (from magic link or dev login)
    const hash = window.location.hash;
    if (hash.startsWith('#login-success')) {
      // Clear the hash and broadcast auth change
      window.location.hash = '';
      
      console.log('📢 Magic link success - broadcasting auth change');
      broadcastAuthChange();
    }
  }, []);

  return (
    <div className="app-layout">
      <Header />
      <Nav />
      <main className="main-content fade-in">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/coinbook" element={
            <ProtectedRoute>
              <CoinBookPage />
            </ProtectedRoute>
          } />
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
              <ToolsLayout />
            </EmployeeRoute>
          }>
            <Route index element={<CoinsPage />} />
            <Route path="coins" element={<CoinsPage />} />
            <Route path="live-users" element={<LiveUsersPage />} />
            <Route path="products" element={<ProductsPageAdmin />} />
            <Route path="orders" element={<OrderItemsPage />} />
            <Route path="sentry" element={<SentryPage />} />
            <Route path="data" element={<DataPage />} />
          </Route>
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default AppLayout;
