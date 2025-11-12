import React, { useRef, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { usePageView } from '../hooks/usePageView';
import ProfileHero from '../components/profile/ProfileHero';
import JourneyTwoColumn from '../components/profile/JourneyTwoColumn';
import RankingsList from '../components/profile/RankingsList';
import CoinBookWidget from '../components/coinbook/CoinBookWidget';
import EmptyRankingsState from '../components/profile/EmptyRankingsState';
import './PublicProfilePage.css';

/**
 * PublicProfilePage - View another user's public profile
 * Route: /profile/:userId
 * Three-act narrative: Hero spotlight, Journey timeline, Rankings list, Achievement showcase
 */
function PublicProfilePage() {
  const { userId } = useParams();
  const { user: currentUser } = useAuthStore();
  
  const journeyRef = useRef(null);
  const achievementsRef = useRef(null);
  const rankingsRef = useRef(null);

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
    refetchOnMount: 'always', // Always refetch when navigating to different profiles
  });

  const { data: journeyData, isLoading: journeyLoading, error: journeyError } = useQuery({
    queryKey: ['profileJourney', userId],
    queryFn: async () => {
      const response = await fetch(`/api/profile/${userId}/journey`, {
        credentials: 'include',
      });
      if (!response.ok) {
        console.error(`Journey API failed with status ${response.status}`);
        throw new Error('Failed to fetch journey');
      }
      return response.json();
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 10, // 10 minutes (matches cache TTL)
    refetchOnMount: 'always', // Always refetch when navigating to different profiles
    retry: 3, // Retry up to 3 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  const { data: rankingsData, isLoading: rankingsLoading, error: rankingsError } = useQuery({
    queryKey: ['profileRankings', userId],
    queryFn: async () => {
      const response = await fetch(`/api/profile/${userId}/rankings`, {
        credentials: 'include',
      });
      if (!response.ok) {
        console.error(`Rankings API failed with status ${response.status}`);
        throw new Error('Failed to fetch rankings');
      }
      return response.json();
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnMount: 'always', // Always refetch when navigating to different profiles
    retry: 3, // Retry up to 3 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });

  // Scroll-triggered animations
  useEffect(() => {
    const observerOptions = {
      threshold: 0.05,
      rootMargin: '50px 0px -50px 0px'
    };

    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('section-visible');
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    [journeyRef, achievementsRef, rankingsRef].forEach(ref => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => observer.disconnect();
  }, [userId, data, journeyData, rankingsData]);

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

  const { user, topProducts, timeline, achievements } = data;
  const milestones = journeyData?.milestones || [];
  const rankings = rankingsData?.rankings || [];

  // Debug logging
  console.log('🔍 Profile Data State:', {
    userId,
    hasData: !!data,
    hasJourneyData: !!journeyData,
    milestonesLength: milestones.length,
    journeyLoading,
    journeyError,
    hasRankingsData: !!rankingsData,
    rankingsLength: rankings.length,
    rankingsLoading,
    rankingsError,
    hasAchievements: achievements?.length || 0
  });

  return (
    <div className="public-profile-page">
      {/* Act 1: Hero - Who I am */}
      <ProfileHero user={user} topProducts={topProducts} />

      {/* Act 2: Journey Film Strip - How I got here */}
      {journeyLoading ? (
        <section className="profile-section section-journey">
          <div className="journey-loading">
            <div className="loading-spinner"></div>
            <p>Loading flavor journey...</p>
          </div>
        </section>
      ) : journeyError ? (
        <section className="profile-section section-journey">
          <div className="journey-error">
            <p>😕 Journey timeline temporarily unavailable. Check back soon!</p>
          </div>
        </section>
      ) : milestones.length > 0 ? (
        <section className="profile-section section-journey">
          <JourneyTwoColumn
            ref={journeyRef}
            userHandle={user.handle}
            milestones={milestones}
            journeyStage={user.journeyStage}
            explorationBreadth={user.explorationBreadth}
            userCreatedAt={user.createdAt}
          />
        </section>
      ) : null}

      {/* Act 3: Achievement Showcase - What I've earned */}
      {achievements && achievements.length > 0 && (
        <section className="profile-section section-achievements" ref={achievementsRef}>
          <div className="achievements-container">
            <h2 className="section-header">Achievements Unlocked</h2>
            
            {/* Transition intro text */}
            {milestones.length > 0 && (
              <div className="coin-book-intro">
                <p className="intro-line-1">
                  The journey reel captured the bites; now your <strong>COIN BOOK</strong> captures the legend.
                </p>
                <p className="intro-line-2">
                  Pop each capsule to celebrate the hunts, streaks, and discoveries that keep you on top.
                </p>
              </div>
            )}
            
            <CoinBookWidget 
              achievements={achievements}
              collapsible={false}
            />
          </div>
        </section>
      )}

      {/* Act 4: Current Rankings - What I'm doing next */}
      <section className="profile-section section-rankings" ref={rankingsRef}>
        <div className="rankings-container">
          <h2 className="section-header">Current Rankings</h2>
          
          {rankingsLoading ? (
            <div className="rankings-loading">
              <div className="loading-spinner"></div>
              <p>Fetching {user.firstName || user.displayName}'s flavor list! Hold tight...</p>
            </div>
          ) : rankingsError ? (
            <div className="rankings-error">
              <p>😕 Rankings temporarily unavailable. Check back soon!</p>
            </div>
          ) : rankings && rankings.length > 0 ? (
            <RankingsList rankings={rankings} />
          ) : (
            <EmptyRankingsState 
              hasAchievements={achievements && achievements.length > 0}
            />
          )}
        </div>
      </section>
    </div>
  );
}

export default PublicProfilePage;
