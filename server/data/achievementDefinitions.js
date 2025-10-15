/**
 * Achievement Definitions
 * Central configuration for all badges and achievements
 * Following Strategy pattern - each achievement can be evaluated independently
 */

const achievementDefinitions = [
  // Ranking Achievements
  {
    code: 'first_rank',
    name: 'First Steps',
    description: 'Rank your first product',
    icon: '🎯',
    tier: 'bronze',
    category: 'ranking',
    requirement: { type: 'rank_count', value: 1 },
    points: 10
  },
  {
    code: 'rank_10',
    name: 'Getting Started',
    description: 'Rank 10 products',
    icon: '📊',
    tier: 'bronze',
    category: 'ranking',
    requirement: { type: 'rank_count', value: 10 },
    points: 50
  },
  {
    code: 'rank_25',
    name: 'Quarter Century',
    description: 'Rank 25 products',
    icon: '🏅',
    tier: 'silver',
    category: 'ranking',
    requirement: { type: 'rank_count', value: 25 },
    points: 100
  },
  {
    code: 'rank_50',
    name: 'Half Century',
    description: 'Rank 50 products',
    icon: '⭐',
    tier: 'gold',
    category: 'ranking',
    requirement: { type: 'rank_count', value: 50 },
    points: 200
  },
  {
    code: 'complete_collection',
    name: 'Complete Collection',
    description: 'Rank all available products',
    icon: '💯',
    tier: 'platinum',
    category: 'ranking',
    requirement: { type: 'rank_all_products', value: 1 },
    points: 1000
  },

  // Streak Achievements
  {
    code: 'streak_3',
    name: 'Getting Consistent',
    description: 'Maintain a 3-day ranking streak',
    icon: '🔥',
    tier: 'bronze',
    category: 'streak',
    requirement: { type: 'streak_days', value: 3 },
    points: 30
  },
  {
    code: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day ranking streak',
    icon: '🔥',
    tier: 'silver',
    category: 'streak',
    requirement: { type: 'streak_days', value: 7 },
    points: 100
  },
  {
    code: 'streak_30',
    name: 'Monthly Master',
    description: 'Maintain a 30-day ranking streak',
    icon: '🔥',
    tier: 'gold',
    category: 'streak',
    requirement: { type: 'streak_days', value: 30 },
    points: 500
  },
  {
    code: 'streak_100',
    name: 'Unstoppable',
    description: 'Maintain a 100-day ranking streak',
    icon: '🔥',
    tier: 'platinum',
    category: 'streak',
    requirement: { type: 'streak_days', value: 100 },
    points: 1000
  },

  // Discovery Achievements
  {
    code: 'explorer',
    name: 'Taste Explorer',
    description: 'Try ranking products from your first brand',
    icon: '🗺️',
    tier: 'bronze',
    category: 'discovery',
    requirement: { type: 'unique_brands', value: 1 },
    points: 50
  },
  {
    code: 'adventurer',
    name: 'Flavor Adventurer',
    description: 'Try ranking products from 2 different brands',
    icon: '🌍',
    tier: 'silver',
    category: 'discovery',
    requirement: { type: 'unique_brands', value: 2 },
    points: 150
  },
  {
    code: 'globe_trotter',
    name: 'Global Taster',
    description: 'Try ranking products from all 3 brands',
    icon: '✈️',
    tier: 'gold',
    category: 'discovery',
    requirement: { type: 'unique_brands', value: 3 },
    points: 300
  },

  // Social Achievements
  {
    code: 'top_10',
    name: 'Top 10 Ranker',
    description: 'Reach the top 10 on the leaderboard',
    icon: '🏅',
    tier: 'gold',
    category: 'social',
    requirement: { type: 'leaderboard_position', value: 10 },
    points: 500
  },
  {
    code: 'top_3',
    name: 'Podium Finisher',
    description: 'Reach the top 3 on the leaderboard',
    icon: '🥇',
    tier: 'platinum',
    category: 'social',
    requirement: { type: 'leaderboard_position', value: 3 },
    points: 1000
  },
  {
    code: 'community_leader',
    name: 'Community Leader',
    description: 'Have 10 or more people view your rankings',
    icon: '👥',
    tier: 'silver',
    category: 'social',
    requirement: { type: 'profile_views', value: 10 },
    points: 200
  },

  // Special Achievements
  {
    code: 'early_adopter',
    name: 'Early Adopter',
    description: 'Join the community in its first month',
    icon: '🚀',
    tier: 'gold',
    category: 'special',
    requirement: { type: 'join_before', value: '2025-11-10' },
    points: 250
  },
  {
    code: 'taste_maker',
    name: 'Taste Maker',
    description: 'Rank a product that becomes top 10 most ranked',
    icon: '👑',
    tier: 'platinum',
    category: 'special',
    requirement: { type: 'trendsetter', value: 10 },
    points: 500
  }
];

module.exports = achievementDefinitions;
