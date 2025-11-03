import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useFetchCoins, useToggleCoin, useDeleteCoin, useCreateCoin, useUpdateCoin, useRecalculateCoin, useAdminProducts } from '../../hooks/useAdminTools';
import EditCoinModal from '../../components/admin/EditCoinModal';
import ConfirmationModal from '../../components/admin/ConfirmationModal';
import './AdminPages.css';

function ManageCoinsPageAdmin() {
  const { data: coinsData, isLoading, error } = useFetchCoins();
  const { data: productsData } = useAdminProducts();
  const toggleCoinMutation = useToggleCoin();
  const deleteCoinMutation = useDeleteCoin();
  const createCoinMutation = useCreateCoin();
  const updateCoinMutation = useUpdateCoin();
  const recalculateCoinMutation = useRecalculateCoin();

  // Filter states
  const [coinTypeFilter, setCoinTypeFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [dependencyFilter, setDependencyFilter] = useState('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoin, setEditingCoin] = useState(null);
  
  // Confirmation modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState(null);

  const coins = coinsData?.achievements || [];
  const products = productsData?.products || [];

  // Apply filters
  const filteredCoins = useMemo(() => {
    return coins.filter(coin => {
      // Coin type filter
      if (coinTypeFilter !== 'all') {
        if (coinTypeFilter === 'engagement' && coin.collectionType !== 'engagement_collection') return false;
        if (coinTypeFilter === 'static' && coin.collectionType !== 'static_collection') return false;
        if (coinTypeFilter === 'dynamic' && coin.collectionType !== 'dynamic_collection') return false;
        if (coinTypeFilter === 'flavor' && coin.collectionType !== 'flavor_coin') return false;
        if (coinTypeFilter === 'legacy' && coin.collectionType !== 'legacy') return false;
      }

      // Visibility filter
      if (visibilityFilter === 'visible' && coin.isHidden === 1) return false;
      if (visibilityFilter === 'hidden' && coin.isHidden === 0) return false;

      // Dependency filter
      if (dependencyFilter === 'has' && !coin.prerequisiteAchievementId) return false;
      if (dependencyFilter === 'none' && coin.prerequisiteAchievementId) return false;

      return true;
    });
  }, [coins, coinTypeFilter, visibilityFilter, dependencyFilter]);

  const handleToggleCoin = async (coin) => {
    try {
      await toggleCoinMutation.mutateAsync(coin.id);
      toast.success(`${coin.name} ${coin.isActive ? 'deactivated' : 'activated'}`);
    } catch (error) {
      toast.error(error.message || 'Failed to toggle coin status');
    }
  };

  const handleDeleteCoin = async (coin) => {
    if (!confirm(`Are you sure you want to delete "${coin.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteCoinMutation.mutateAsync(coin.id);
      toast.success(`${coin.name} deleted successfully`);
    } catch (error) {
      toast.error(error.message || 'Failed to delete coin');
    }
  };

  const handleRefreshCoin = (coin) => {
    setConfirmModalData({
      coin,
      title: `Recalculate "${coin.name}"?`,
      message: `This will award the achievement to all users who meet the requirements.\n\nProcessing time depends on the number of users in the system.`,
    });
    setIsConfirmModalOpen(true);
  };

  const handleConfirmRecalculate = async () => {
    setIsConfirmModalOpen(false);
    
    const { coin } = confirmModalData;
    const loadingToast = toast.loading(`Recalculating "${coin.name}" for all users...`, {
      duration: 0
    });

    try {
      const result = await recalculateCoinMutation.mutateAsync(coin.id);
      
      // Hide loading toast
      toast.dismiss(loadingToast);
      
      // Show success with stats
      const stats = result.stats || {};
      toast.success(
        `${coin.name} recalculated!\n` +
        `Processed: ${stats.processed || 0} users\n` +
        `New awards: ${stats.newAwards || 0}\n` +
        `Tier upgrades: ${stats.tierUpgrades || 0}` +
        (stats.errors ? `\nErrors: ${stats.errors}` : ''),
        { duration: 7000 }
      );
    } catch (error) {
      // Hide loading toast
      toast.dismiss(loadingToast);
      
      // Show error
      toast.error(
        `Failed to recalculate ${coin.name}\n${error.message || 'Unknown error'}`,
        { duration: 7000 }
      );
    }
  };

  const handleEditCoin = (coin) => {
    setEditingCoin(coin);
    setIsModalOpen(true);
  };
  
  const handleCreateCoin = () => {
    setEditingCoin(null);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCoin(null);
  };
  
  const handleSaveCoin = async (coinData, iconFile) => {
    try {
      if (editingCoin) {
        // Update existing coin
        await updateCoinMutation.mutateAsync({
          coinId: editingCoin.id,
          coinData,
          iconFile
        });
        toast.success(`${coinData.name} updated successfully`);
      } else {
        // Create new coin
        await createCoinMutation.mutateAsync({
          coinData,
          iconFile
        });
        toast.success(`${coinData.name} created successfully`);
      }
    } catch (error) {
      throw error; // Re-throw so modal can handle it
    }
  };

  const getCoinTypeDisplay = (collectionType) => {
    const typeMap = {
      'engagement_collection': 'Engagement',
      'static_collection': 'Static Collection',
      'dynamic_collection': 'Dynamic Collection',
      'flavor_coin': 'Flavor',
      'legacy': 'Legacy'
    };
    return typeMap[collectionType] || collectionType || '-';
  };

  if (error) {
    return (
      <div className="admin-page">
        <div className="error-message">
          <strong>Error loading coins:</strong> {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-left">
          <span className="admin-icon">🪙</span>
          <h2>Coin Book Admin Dashboard</h2>
        </div>
        <button className="btn-create" onClick={handleCreateCoin}>
          + Create Coin
        </button>
      </div>

      {/* Filter Row 1: Coin Type */}
      <div className="filter-row">
        <button
          className={`filter-btn ${coinTypeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setCoinTypeFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-btn ${coinTypeFilter === 'engagement' ? 'active' : ''}`}
          onClick={() => setCoinTypeFilter('engagement')}
        >
          🎯 Engagement
        </button>
        <button
          className={`filter-btn ${coinTypeFilter === 'static' ? 'active' : ''}`}
          onClick={() => setCoinTypeFilter('static')}
        >
          🏛️ Static Collection
        </button>
        <button
          className={`filter-btn ${coinTypeFilter === 'dynamic' ? 'active' : ''}`}
          onClick={() => setCoinTypeFilter('dynamic')}
        >
          📊 Dynamic Collection
        </button>
        <button
          className={`filter-btn ${coinTypeFilter === 'flavor' ? 'active' : ''}`}
          onClick={() => setCoinTypeFilter('flavor')}
        >
          🍊 Flavor
        </button>
        <button
          className={`filter-btn ${coinTypeFilter === 'legacy' ? 'active' : ''}`}
          onClick={() => setCoinTypeFilter('legacy')}
        >
          🔖 Legacy
        </button>
      </div>

      {/* Filter Row 2: Visibility */}
      <div className="filter-row">
        <button
          className={`filter-btn ${visibilityFilter === 'all' ? 'active' : ''}`}
          onClick={() => setVisibilityFilter('all')}
        >
          All Visibility
        </button>
        <button
          className={`filter-btn ${visibilityFilter === 'visible' ? 'active' : ''}`}
          onClick={() => setVisibilityFilter('visible')}
        >
          👁️ Visible Only
        </button>
        <button
          className={`filter-btn ${visibilityFilter === 'hidden' ? 'active' : ''}`}
          onClick={() => setVisibilityFilter('hidden')}
        >
          🔒 Hidden Only
        </button>
      </div>

      {/* Filter Row 3: Dependencies */}
      <div className="filter-row">
        <button
          className={`filter-btn ${dependencyFilter === 'all' ? 'active' : ''}`}
          onClick={() => setDependencyFilter('all')}
        >
          All Dependencies
        </button>
        <button
          className={`filter-btn ${dependencyFilter === 'has' ? 'active' : ''}`}
          onClick={() => setDependencyFilter('has')}
        >
          🔗 Has Dependency
        </button>
        <button
          className={`filter-btn ${dependencyFilter === 'none' ? 'active' : ''}`}
          onClick={() => setDependencyFilter('none')}
        >
          ⛔ No Dependency
        </button>
      </div>

      {/* Coins Table */}
      <div className="table-container">
        {isLoading ? (
          <div className="loading-state">Loading coins...</div>
        ) : filteredCoins.length === 0 ? (
          <div className="empty-state">
            {coinTypeFilter !== 'all' || visibilityFilter !== 'all' || dependencyFilter !== 'all'
              ? 'No coins match your filters'
              : 'No coins found'}
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ICON</th>
                <th>NAME</th>
                <th>TYPE</th>
                <th>CATEGORY</th>
                <th>DESCRIPTION</th>
                <th>POINTS</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredCoins.map((coin) => (
                <tr key={coin.id}>
                  <td className="coin-icon-cell">
                    {coin.iconType === 'image' ? (
                      <img src={coin.icon} alt={coin.name} className="coin-icon-img" />
                    ) : (
                      <span className="coin-icon-emoji">{coin.icon}</span>
                    )}
                  </td>
                  <td>
                    <div className="coin-name">{coin.name}</div>
                    <div className="coin-code">{coin.code}</div>
                  </td>
                  <td>
                    <span className="coin-type-badge">
                      {getCoinTypeDisplay(coin.collectionType)}
                    </span>
                  </td>
                  <td>{coin.category || '-'}</td>
                  <td className="coin-description">{coin.description}</td>
                  <td className="coin-points">{coin.points}</td>
                  <td>
                    <span className={`status-badge ${coin.isActive ? 'active' : 'inactive'}`}>
                      {coin.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleEditCoin(coin)}
                        title="Edit coin"
                      >
                        ✏️
                      </button>
                      <button
                        className="action-btn refresh-btn"
                        onClick={() => handleRefreshCoin(coin)}
                        title="Recalculate awards"
                      >
                        🔄
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDeleteCoin(coin)}
                        disabled={deleteCoinMutation.isPending}
                        title="Delete coin"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Stats */}
      <div className="table-footer">
        <p>
          Showing {filteredCoins.length} of {coins.length} coins
        </p>
      </div>
      
      {/* Edit/Create Coin Modal */}
      <EditCoinModal
        coin={editingCoin}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveCoin}
        allCoins={coins}
        allProducts={products}
      />

      {/* Confirmation Modal */}
      {confirmModalData && (
        <ConfirmationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          onConfirm={handleConfirmRecalculate}
          title={confirmModalData.title}
          message={confirmModalData.message}
          confirmText="Recalculate"
          cancelText="Cancel"
        />
      )}
    </div>
  );
}

export default ManageCoinsPageAdmin;
