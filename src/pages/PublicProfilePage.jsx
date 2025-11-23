import React from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { usePageView } from '../hooks/usePageView';
import TopFlavorsPodium from '../components/profile/TopFlavorsPodium';
import FlavorProfileProgress from '../components/profile/FlavorProfileProgress';
import ActivityFeed from '../components/profile/ActivityFeed';
import CoinBookWidget from '../components/coinbook/CoinBookWidget';
import './PublicProfilePage.css';

function PublicProfilePage() {
  const { userId } = useParams();
  const { user: currentUser } = useAuthStore();

  usePageView('public_profile', { profileId: userId });

  if (currentUser && String(currentUser.id) === String(userId)) {
    return <Navigate to="/profile" replace />;
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['publicProfile', userId],
    queryFn: async () => {
      const response = await fetch(`/api/profile/${userId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Profile not found');
        }
        throw new Error('Failed to fetch profile');
      }
      return response.json();
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: 'always',
  });

  if (isLoading) {
    return (
      <div className="public-profile-loading">
        <div className="loading-spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="public-profile-error">
        <h2>Profile Not Found</h2>
        <p>{error.message || "The user profile you're looking for doesn't exist or couldn't be loaded."}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { user, topProducts = [], flavorProfileProgress = [], recentActivity = [], stats = {}, achievements = [] } = data;

  const getUserInitial = () => {
    if (user.firstName) return user.firstName.charAt(0).toUpperCase();
    if (user.displayName) return user.displayName.charAt(0).toUpperCase();
    return '?';
  };

  const formatMemberSince = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.getFullYear();
  };

  const getSpecialtyBadges = () => {
    if (!user.focusAreas || user.focusAreas.length === 0) {
      return [];
    }
    
    const badges = [];
    user.focusAreas.forEach(area => {
      if (area.includes('spicy') || area.includes('heat')) {
        badges.push({ emoji: '🔥', label: 'Heat Lover' });
      } else if (area.includes('sweet')) {
        badges.push({ emoji: '🍯', label: 'Sweet Tooth' });
      } else if (area.includes('smoky')) {
        badges.push({ emoji: '💨', label: 'Smoke Master' });
      } else if (area.includes('classic')) {
        badges.push({ emoji: '🥩', label: 'Classic Carnivore' });
      }
    });
    
    return badges.slice(0, 3);
  };

  const specialtyBadges = getSpecialtyBadges();
  const favoriteFlavor = user.focusAreas?.[0] || 'Exploring';

  return (
    <div className="public-profile-page-new">
      <div className="profile-container">
        <div className="hero-row">
          <div className="profile-card">
            <div className="profile-content">
              <div className="avatar-ring">
                <div className="avatar-inner">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} className="avatar-image" />
                  ) : (
                    <span className="avatar-initial">{getUserInitial()}</span>
                  )}
                </div>
              </div>
              
              <div className="profile-info">
                <h1 className="profile-name">{user.displayName || user.firstName}</h1>
                <div className="profile-status">{user.journeyStage || 'Taste Explorer'}</div>
                <div className="tester-badge">
                  ⭐ Taste Tester Since {formatMemberSince(user.createdAt || user.memberSince)}
                </div>
                
                {specialtyBadges.length > 0 && (
                  <div className="specialty-badges">
                    {specialtyBadges.map((badge, index) => (
                      <span key={index} className="badge-chip">
                        {badge.emoji} {badge.label}
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-value">{stats.productsRanked || user.rankingCount || 0}</span>
                    <span className="stat-label">Flavors Ranked</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{stats.currentStreak || 0}</span>
                    <span className="stat-label">Day Streak</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{favoriteFlavor}</span>
                    <span className="stat-label">Favorite</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-card">
            <div className="card-title">Top Flavors</div>
            <TopFlavorsPodium topProducts={topProducts.slice(0, 3)} />
          </div>
        </div>

        {flavorProfileProgress && flavorProfileProgress.length > 0 && (
          <div className="profile-card">
            <div className="card-title">Taste Profile DNA</div>
            <FlavorProfileProgress flavorProfileData={flavorProfileProgress} />
          </div>
        )}

        {achievements && achievements.length > 0 && (
          <div className="profile-card">
            <div className="card-title">Coin Book</div>
            <CoinBookWidget achievements={achievements} collapsible={false} />
          </div>
        )}

        {recentActivity && recentActivity.length > 0 && (
          <div className="profile-card">
            <div className="card-title">Recent Activity</div>
            <ActivityFeed activities={recentActivity} />
          </div>
        )}

        <div className="cta-card">
          <Link to={`/community/${userId}/rankings`} className="cta-text">
            View {user.firstName || user.displayName}'s Full Rankings →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PublicProfilePage;
