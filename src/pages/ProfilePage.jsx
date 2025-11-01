import React from 'react';
import { useAuthStore } from '../store/authStore';
import { useProgress, useStreaks } from '../hooks/useGamification';
import './ProfilePage.css';

function ProfilePage() {
  const { user } = useAuthStore();
  const { data: progress, isLoading: progressLoading } = useProgress();
  const { data: streaks, isLoading: streaksLoading } = useStreaks();

  const isLoading = progressLoading || streaksLoading;

  if (isLoading) {
    return (
      <div className="profile-page">
        <div className="profile-container">
          <div className="loading">Loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="profile-avatar">
            {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
          </div>
          <h1>{user?.first_name} {user?.last_name}</h1>
          <p className="profile-email">{user?.email}</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🥩</div>
            <div className="stat-value">{progress?.totalRankings || 0}</div>
            <div className="stat-label">Total Rankings</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-value">{progress?.achievementsEarned || 0}</div>
            <div className="stat-label">Achievements</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔥</div>
            <div className="stat-value">{progress?.currentStreak || 0}</div>
            <div className="stat-label">Current Streak</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-value">{progress?.totalPoints || 0}</div>
            <div className="stat-label">Total Points</div>
          </div>
        </div>

        <div className="recent-rankings">
          <h2>Recent Rankings</h2>
          <p className="no-rankings">Rankings feature coming soon!</p>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
