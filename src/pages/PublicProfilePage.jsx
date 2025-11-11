import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { usePageView } from '../hooks/usePageView';
import ProfileHero from '../components/profile/ProfileHero';
import FlavorJourneyTimeline from '../components/profile/FlavorJourneyTimeline';
import RankingsList from '../components/profile/RankingsList';
import CoinBookWidget from '../components/coinbook/CoinBookWidget';
import './PublicProfilePage.css';

/**
 * PublicProfilePage - View another user's public profile
 * Route: /profile/:userId
 * Three-act narrative: Hero spotlight, Journey timeline, Rankings list, Achievement showcase
 */
function PublicProfilePage() {
  const { userId } = useParams();
  const { user: currentUser } = useAuthStore();

  // Track page view
  usePageView('public_profile', { profileId: userId });

  // If viewing own profile, redirect to edit mode at /profile
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
    staleTime: 1000 * 60 * 5, // 5 minutes
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

  const { user, topProducts, timeline, rankings, achievements } = data;

  return (
    <div className="public-profile-page">
      {/* Act 1: Hero Spotlight - Who they are */}
      <ProfileHero user={user} topProducts={topProducts} />

      {/* Act 2: Journey Chronicle - The story */}
      {timeline && timeline.length > 0 && (
        <FlavorJourneyTimeline timeline={timeline} />
      )}

      {/* Act 3: Rankings List - The details */}
      {rankings && rankings.length > 0 && (
        <RankingsList rankings={rankings} />
      )}

      {/* Act 4: Achievement Showcase - The trophies */}
      {achievements && achievements.length > 0 && (
        <div className="public-profile-achievements">
          <div className="achievements-container">
            <h2 className="achievements-title">Achievements</h2>
            <CoinBookWidget 
              achievements={achievements}
              collapsible={false}
            />
          </div>
        </div>
      )}

      {/* Empty state if user has no data */}
      {(!rankings || rankings.length === 0) && (!timeline || timeline.length === 0) && (
        <div className="public-profile-empty">
          <h2>Just Getting Started</h2>
          <p>This user hasn't ranked any flavors yet.</p>
        </div>
      )}
    </div>
  );
}

export default PublicProfilePage;
