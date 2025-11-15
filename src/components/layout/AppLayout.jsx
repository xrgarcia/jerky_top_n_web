import React, { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { broadcastAuthChange } from '../../context/AuthContext';
import { useSocket } from '../../hooks/useSocket';
import Header from './Header';
import Nav from './Nav';
import Footer from './Footer';
import ProtectedRoute from '../auth/ProtectedRoute';
import EmployeeRoute from '../auth/EmployeeRoute';
import PageLoader from '../common/PageLoader';
import ScrollToTop from '../common/ScrollToTop';

import './AppLayout.css';
import '../../styles/toast.admin.css';

const HomePage = lazy(() => import('../../pages/HomePage'));
const ProductsPage = lazy(() => import('../../pages/ProductsPage'));
const ProductDetailPage = lazy(() => import('../../pages/ProductDetailPage'));
const FlavorProfilePage = lazy(() => import('../../pages/FlavorProfilePage'));
const CoinBookPage = lazy(() => import('../../pages/CoinBookPage'));
const CoinProfilePage = lazy(() => import('../../pages/CoinProfilePage'));
const CommunityPage = lazy(() => import('../../pages/CommunityPage'));
const PublicProfilePage = lazy(() => import('../../pages/PublicProfilePage'));
const LeaderboardPage = lazy(() => import('../../pages/LeaderboardPage'));
const ProfilePage = lazy(() => import('../../pages/ProfilePage'));
const RankPage = lazy(() => import('../../pages/RankPage'));
const LoginPage = lazy(() => import('../../pages/LoginPage'));
const ToolsLayout = lazy(() => import('../../pages/admin/ToolsLayout'));
const ManageCoinsPageAdmin = lazy(() => import('../../pages/admin/ManageCoinsPageAdmin'));
const CoinTypesPageAdmin = lazy(() => import('../../pages/admin/CoinTypesPageAdmin'));
const FlavorCommunitiesPageAdmin = lazy(() => import('../../pages/admin/FlavorCommunitiesPageAdmin'));
const LiveUsersPage = lazy(() => import('../../pages/admin/LiveUsersPage'));
const ProductsPageAdmin = lazy(() => import('../../pages/admin/ProductsPageAdmin'));
const RankableProductsPageAdmin = lazy(() => import('../../pages/admin/RankableProductsPageAdmin'));
const OrderItemsPage = lazy(() => import('../../pages/admin/OrderItemsPage'));
const CustomerWebhooksPage = lazy(() => import('../../pages/admin/CustomerWebhooksPage'));
const ProductWebhooksPage = lazy(() => import('../../pages/admin/ProductWebhooksPage'));
const SentryPage = lazy(() => import('../../pages/admin/SentryPage'));
const SentryIssueDetailsPage = lazy(() => import('../../pages/admin/SentryIssueDetailsPage'));
const DataPage = lazy(() => import('../../pages/admin/DataPage'));
const UserGuidanceTab = lazy(() => import('../../components/admin/UserGuidanceTab'));
const QueueMonitorPage = lazy(() => import('../../pages/admin/QueueMonitorPage'));
const BulkImportPage = lazy(() => import('../../pages/admin/BulkImportPage'));

function RedirectToFlavor() {
  const { productId } = useParams();
  return <Navigate to={`/flavors/${productId}`} replace />;
}

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
      <ScrollToTop />
      <Header />
      <Nav />
      <main className="main-content fade-in">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:productId" element={<RedirectToFlavor />} />
            <Route path="/flavors/:productId(\d+)" element={<ProductDetailPage />} />
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
                <PublicProfilePage />
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
              <Route path="flavor-profile-communities" element={<FlavorCommunitiesPageAdmin />} />
              <Route path="live-users" element={<LiveUsersPage />} />
              <Route path="products" element={<ProductsPageAdmin />} />
              <Route path="rankable-products" element={<RankableProductsPageAdmin />} />
              <Route path="orders" element={<OrderItemsPage />} />
              <Route path="customer-webhooks" element={<CustomerWebhooksPage />} />
              <Route path="product-webhooks" element={<ProductWebhooksPage />} />
              <Route path="user-guidance" element={<UserGuidanceTab />} />
              <Route path="queue-monitor" element={<QueueMonitorPage />} />
              <Route path="bulk-import" element={<BulkImportPage />} />
              <Route path="sentry" element={<SentryPage />} />
              <Route path="sentry/:issueId" element={<SentryIssueDetailsPage />} />
              <Route path="data" element={<DataPage />} />
            </Route>
          </Routes>
        </Suspense>
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
