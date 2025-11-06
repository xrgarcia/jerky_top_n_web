import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { broadcastAuthChange } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import Header from './Header';
import Nav from './Nav';
import Footer from './Footer';
import ProtectedRoute from '../auth/ProtectedRoute';
import EmployeeRoute from '../auth/EmployeeRoute';

import HomePage from '../../pages/HomePage';
import ProductsPage from '../../pages/ProductsPage';
import ProductDetailPage from '../../pages/ProductDetailPage';
import FlavorProfilePage from '../../pages/FlavorProfilePage';
import CoinBookPage from '../../pages/CoinBookPage';
import CoinProfilePage from '../../pages/CoinProfilePage';
import CommunityPage from '../../pages/CommunityPage';
import UserProfilePage from '../../pages/UserProfilePage';
import LeaderboardPage from '../../pages/LeaderboardPage';
import ProfilePage from '../../pages/ProfilePage';
import RankPage from '../../pages/RankPage';
import LoginPage from '../../pages/LoginPage';
import ToolsLayout from '../../pages/admin/ToolsLayout';
import ManageCoinsPageAdmin from '../../pages/admin/ManageCoinsPageAdmin';
import CoinTypesPageAdmin from '../../pages/admin/CoinTypesPageAdmin';
import FlavorCommunitiesPageAdmin from '../../pages/admin/FlavorCommunitiesPageAdmin';
import LiveUsersPage from '../../pages/admin/LiveUsersPage';
import ProductsPageAdmin from '../../pages/admin/ProductsPageAdmin';
import OrderItemsPage from '../../pages/admin/OrderItemsPage';
import SentryPage from '../../pages/admin/SentryPage';
import SentryIssueDetailsPage from '../../pages/admin/SentryIssueDetailsPage';
import DataPage from '../../pages/admin/DataPage';
import UserGuidanceTab from '../../components/admin/UserGuidanceTab';

import './AppLayout.css';
import '../../styles/toast.admin.css';

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
          <Route path="/products/:productId" element={<ProductDetailPage />} />
          <Route path="/flavors/:flavorId" element={<FlavorProfilePage />} />
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/coinbook" element={
            <ProtectedRoute>
              <CoinBookPage />
            </ProtectedRoute>
          } />
          <Route path="/coinbook/:coinId" element={
            <ProtectedRoute>
              <CoinProfilePage />
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
          <Route path="/community/:userId" element={
            <ProtectedRoute>
              <UserProfilePage />
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
          
          <Route path="/admin/tools" element={
            <EmployeeRoute>
              <ToolsLayout />
            </EmployeeRoute>
          }>
            <Route index element={<ManageCoinsPageAdmin />} />
            <Route path="coins" element={<ManageCoinsPageAdmin />} />
            <Route path="coin-types" element={<CoinTypesPageAdmin />} />
            <Route path="flavor-communities" element={<FlavorCommunitiesPageAdmin />} />
            <Route path="live-users" element={<LiveUsersPage />} />
            <Route path="products" element={<ProductsPageAdmin />} />
            <Route path="orders" element={<OrderItemsPage />} />
            <Route path="user-guidance" element={<UserGuidanceTab />} />
            <Route path="sentry" element={<SentryPage />} />
            <Route path="sentry/:issueId" element={<SentryIssueDetailsPage />} />
            <Route path="data" element={<DataPage />} />
          </Route>
        </Routes>
      </main>
      <Footer />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          className: 'admin-toast',
          style: {
            zIndex: 100000,
          },
          success: {
            className: 'admin-toast admin-toast-success',
            icon: '✅',
          },
          error: {
            className: 'admin-toast admin-toast-error',
            icon: '❌',
          },
          loading: {
            className: 'admin-toast admin-toast-loading',
            icon: '⏳',
          },
        }}
      />
    </div>
  );
}

export default AppLayout;
