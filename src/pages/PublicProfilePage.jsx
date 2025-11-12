import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { usePageView } from '../hooks/usePageView';
import ProfileHero from '../components/profile/ProfileHero';
import JourneyFilmStrip from '../components/profile/JourneyFilmStrip';
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

  const { data: journeyData } = useQuery({
    queryKey: ['profileJourney', userId],
    queryFn: async () => {
      const response = await fetch(`/api/profile/${userId}/journey`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch journey');
      }
      return response.json();
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 minutes (matches cache TTL)
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
  const milestones = journeyData?.milestones || [];

  return (
    <div className="public-profile-page">
      {/* Act 1: Hero - Who I am */}
      <ProfileHero user={user} topProducts={topProducts} />

      {/* Act 2: Journey Film Strip - How I got here */}
      {milestones.length > 0 && (
        <section className="profile-section section-journey">
          <JourneyFilmStrip 
            milestones={milestones}
            journeyStage={user.journeyStage}
            explorationBreadth={user.explorationBreadth}
            userCreatedAt={user.createdAt}
          />
        </section>
      )}

      {/* Act 3: Achievement Showcase - What I've earned */}
      {achievements && achievements.length > 0 && (
        <section className="profile-section section-achievements">
          <div className="achievements-container">
            <h2 className="section-header">Achievements Unlocked</h2>
            <CoinBookWidget 
              achievements={achievements}
              collapsible={false}
            />
          </div>
        </section>
      )}

      {/* Act 4: Current Rankings - What I'm doing next */}
      {rankings && rankings.length > 0 && (
        <section className="profile-section section-rankings">
          <div className="rankings-container">
            <h2 className="section-header">Current Rankings</h2>
            <RankingsList rankings={rankings} />
          </div>
        </section>
      )}

      {/* Empty state if user has no data */}
      {(!rankings || rankings.length === 0) && milestones.length === 0 && (
        <div className="public-profile-empty">
          <h2>Just Getting Started</h2>
          <p>This user hasn't ranked any flavors yet.</p>
        </div>
      )}
    </div>
  );
}

export default PublicProfilePage;
