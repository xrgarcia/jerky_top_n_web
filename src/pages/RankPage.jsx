import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { ProgressWidget } from '../components/rank/ProgressWidget';
import { RankingsPanel } from '../components/rank/RankingsPanel';
import { SearchProductsPanel } from '../components/rank/SearchProductsPanel';
import { useRankings } from '../hooks/useRankings';
import { useRankableProducts } from '../hooks/useRankableProducts';
import './RankPage.css';

export default function RankPage() {
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationTarget, setNavigationTarget] = useState(null);
  
  const {
    rankings,
    updateRankings,
    loadRankings,
    clearAllRankings,
    saveStatus,
    saveMessage,
    waitForPendingSaves,
    hasPendingSaves
  } = useRankings();

  const rankedProductIds = useMemo(() => 
    rankings.map(r => r.productData?.productId).filter(Boolean), 
    [rankings]
  );
  
  const {
    products,
    loading,
    availableCount,
    searchTerm,
    handleSearch,
    reloadProducts,
    loadMoreProducts,
    hasMore,
    isLoadingMore,
    totalProducts,
    currentPage
  } = useRankableProducts(rankedProductIds);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasPendingSaves() && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    loadRankings();
  }, [loadRankings]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasPendingSaves()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasPendingSaves]);

  useEffect(() => {
    if (blocker.state === 'blocked') {
      setIsNavigating(true);
      waitForPendingSaves().then(() => {
        setIsNavigating(false);
        blocker.proceed();
      });
    }
  }, [blocker, waitForPendingSaves]);

  const handleRankProduct = (product) => {
    const nextRank = rankings.length + 1;
    const newRankings = [
      ...rankings,
      {
        ranking: nextRank,
        productData: product
      }
    ];
    updateRankings(newRankings);
  };

  const handleNavigateAway = async (path) => {
    if (hasPendingSaves()) {
      setIsNavigating(true);
      setNavigationTarget(path);
      await waitForPendingSaves();
      setIsNavigating(false);
      setNavigationTarget(null);
      navigate(path);
    } else {
      navigate(path);
    }
  };

  const handleBrowseAllClick = () => {
    handleNavigateAway('/products');
  };

  return (
    <div className="rank-page">
      {isNavigating && (
        <div className="navigation-guard-overlay">
          <div className="navigation-guard-modal">
            <div className="spinner-large"></div>
            <h3>Saving your rankings...</h3>
            <p>{saveMessage || 'Please wait while we save your changes'}</p>
            {saveStatus === 'error' && (
              <div className="error-message">
                Save failed. Please try again or contact support.
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="rank-page-header">
        <div className="breadcrumbs">
          <span className="breadcrumb" onClick={() => handleNavigateAway('/')}>Home</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Rank Products</span>
        </div>
        <button className="browse-all-btn" onClick={handleBrowseAllClick}>
          Browse All Products
        </button>
      </div>

      <ProgressWidget />

      <div className="rank-content-grid">
        <div className="rank-left-panel">
          <RankingsPanel
            rankings={rankings}
            updateRankings={updateRankings}
            saveStatus={saveStatus}
            saveMessage={saveMessage}
            onClearAll={clearAllRankings}
          />
        </div>

        <div className="rank-right-panel">
          <SearchProductsPanel
            products={products}
            availableCount={availableCount}
            loading={loading}
            searchTerm={searchTerm}
            onSearch={handleSearch}
            onRankProduct={handleRankProduct}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            onLoadMore={loadMoreProducts}
            totalProducts={totalProducts}
            currentPage={currentPage}
          />
        </div>
      </div>
    </div>
  );
}
