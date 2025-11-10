import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { renderAchievementIcon } from '../../utils/iconUtils';
import './CommunityPulse.css';

function CommunityPulse({ activityStats, isLoading }) {
  if (isLoading) {
    return (
      <div className="community-pulse">
        <h2 className="pulse-title">Community Pulse</h2>
        <div className="pulse-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="pulse-card skeleton-pulse">
              <div className="pulse-number skeleton-text"></div>
              <div className="pulse-label skeleton-text"></div>
              <div className="pulse-example skeleton-text"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!activityStats) {
    return null;
  }

  const stats = [
    {
      key: 'achievementsToday',
      count: activityStats.achievementsToday?.count || 0,
      label: 'Achievements Unlocked Today',
      icon: '🎉',
      render: (data) => data.latest ? (
        <div className="pulse-example">
          <Link to={`/community/${data.latest.userId}`} className="pulse-user">
            {data.latest.userName}
          </Link>
          {' '}earned{' '}
          <span className="pulse-achievement">
            {renderAchievementIcon(data.latest, 20)}
            {' '}{data.latest.achievementName}
          </span>
          {' '}<span className="pulse-time">{formatDistanceToNow(new Date(data.latest.earnedAt), { addSuffix: true })}</span>
        </div>
      ) : <div className="pulse-example-empty">Be the first to unlock an achievement today!</div>,
    },
    {
      key: 'productsRanked',
      count: activityStats.productsRanked?.count || 0,
      label: 'Products Ranked This Week',
      icon: '🥩',
      render: (data) => data.latest ? (
        <div className="pulse-example">
          <Link to={`/community/${data.latest.userId}`} className="pulse-user">
            {data.latest.rankedBy}
          </Link>
          {' '}ranked{' '}
          <Link to={`/products/${data.latest.productData?.id}`} className="pulse-product">
            {data.latest.productData?.title}
          </Link>
          {' '}at <span className="pulse-rank">#{data.latest.ranking}</span>
          {' '}<span className="pulse-time">{formatDistanceToNow(new Date(data.latest.rankedAt), { addSuffix: true })}</span>
        </div>
      ) : <div className="pulse-example-empty">Start ranking products this week!</div>,
    },
    {
      key: 'flavorsRankedWeek',
      count: activityStats.flavorsRankedWeek?.count || 0,
      label: 'Flavors Ranked This Week',
      icon: '🌶️',
      render: (data) => data.latest ? (
        <div className="pulse-example">
          Latest:{' '}
          <span className="pulse-flavor">{data.latest.flavor}</span>
          {' '}by{' '}
          <span className="pulse-user">{data.latest.rankedBy}</span>
          {' '}<span className="pulse-time">{formatDistanceToNow(new Date(data.latest.rankedAt), { addSuffix: true })}</span>
        </div>
      ) : <div className="pulse-example-empty">Rank some flavors this week!</div>,
    },
    {
      key: 'collectionMilestones',
      count: activityStats.collectionMilestones?.count || 0,
      label: 'Collection Milestones Hit Today',
      icon: '🏆',
      render: (data) => data.latest ? (
        <div className="pulse-example">
          <Link to={`/community/${data.latest.userId}`} className="pulse-user">
            {data.latest.userName}
          </Link>
          {' '}completed{' '}
          <span className="pulse-achievement">
            {renderAchievementIcon(data.latest, 20)}
            {' '}{data.latest.achievementName}
          </span>
          {' '}<span className="pulse-time">{formatDistanceToNow(new Date(data.latest.earnedAt), { addSuffix: true })}</span>
        </div>
      ) : <div className="pulse-example-empty">Complete a collection today!</div>,
    },
    {
      key: 'flavorCommunities',
      count: activityStats.flavorCommunities?.count || 0,
      label: 'Flavor Communities Active',
      icon: '👥',
      render: (data) => data.mostActive ? (
        <div className="pulse-example">
          Most active:{' '}
          <span className="pulse-flavor">{data.mostActive.flavorProfile}</span>
          {' '}({data.mostActive.activeUsers} rankers, {data.mostActive.rankingsToday} rankings today)
        </div>
      ) : <div className="pulse-example-empty">Join a flavor community!</div>,
    },
    {
      key: 'newRankers',
      count: activityStats.newRankers?.count || 0,
      label: 'New Rankers Joined Today',
      icon: '✨',
      render: (data) => data.latest ? (
        <div className="pulse-example">
          Welcome{' '}
          <Link to={`/community/${data.latest.userId}`} className="pulse-user">
            {data.latest.userName}
          </Link>
          ! Ranked{' '}
          {data.latest.productData?.title && (
            <Link to={`/products/${data.latest.productData?.id}`} className="pulse-product">
              {data.latest.productData.title}
            </Link>
          )}
          {' '}at <span className="pulse-rank">#{data.latest.ranking}</span>
          {' '}<span className="pulse-time">{formatDistanceToNow(new Date(data.latest.joinedAt), { addSuffix: true })}</span>
        </div>
      ) : <div className="pulse-example-empty">Be the first new ranker today!</div>,
    },
    {
      key: 'usersEarningPoints',
      count: activityStats.usersEarningPoints?.count || 0,
      label: 'Users Earning Points Today',
      icon: '⚡',
      render: (data) => data.latest ? (
        <div className="pulse-example">
          <Link to={`/community/${data.latest.userId}`} className="pulse-user">
            {data.latest.userName}
          </Link>
          {' '}just earned points
          {' '}<span className="pulse-time">{formatDistanceToNow(new Date(data.latest.activityAt), { addSuffix: true })}</span>
        </div>
      ) : <div className="pulse-example-empty">Earn points by being active!</div>,
    },
    {
      key: 'hotProducts',
      count: activityStats.hotProducts?.count || 0,
      label: 'Ranking Battles Happening',
      icon: '🔥',
      render: (data) => data.latest ? (
        <div className="pulse-example">
          <Link to={`/products/${data.latest.productData?.id}`} className="pulse-product">
            {data.latest.productData?.title}
          </Link>
          {' '}ranked {data.latest.rankingCount}× today
          {' '}<span className="pulse-time">(latest: {formatDistanceToNow(new Date(data.latest.rankedAt), { addSuffix: true })})</span>
        </div>
      ) : <div className="pulse-example-empty">Start a ranking battle!</div>,
    },
  ];

  return (
    <div className="community-pulse">
      <h2 className="pulse-title">Community Pulse</h2>
      <p className="pulse-subtitle">See what's happening right now across the flavor fanatic community</p>
      <div className="pulse-grid">
        {stats.map((stat) => {
          const data = activityStats[stat.key];
          return (
            <div key={stat.key} className="pulse-card">
              <div className="pulse-header">
                <span className="pulse-icon">{stat.icon}</span>
                <div className="pulse-number">{stat.count.toLocaleString()}</div>
              </div>
              <div className="pulse-label">{stat.label}</div>
              {stat.render(data)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CommunityPulse;
