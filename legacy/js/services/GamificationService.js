/**
 * GamificationService - Frontend service for gamification features
 * Handles achievements, streaks, and user progress
 */
class GamificationService extends BaseService {
  constructor(eventBus, socket) {
    super(eventBus);
    this.socket = socket;
    this.achievements = [];
    this.userStats = null;
    this.streaks = [];
  }

  async initialize() {
    await super.initialize();
    
    this.setupSocketListeners();
    
    this.subscribe('user:authenticated', () => {
      this.loadAchievements();
      this.loadStreaks();
    });
  }

  setupSocketListeners() {
    // TEST: Listen for test ping to verify socket communication
    this.socket.on('test:ping', (data) => {
      console.log('✅ TEST: Received test:ping from server!', data);
    });
    
    this.socket.on('achievement:earned', (achievement) => {
      this.achievements.push(achievement);
      this.emit('achievement:new', achievement);
    });

    this.socket.on('achievements:earned', (data) => {
      console.log('🏆 Received achievements:earned event', data);
      if (data.achievements && data.achievements.length > 0) {
        data.achievements.forEach(achievement => {
          this.achievements.push(achievement);
          this.emit('achievement:new', achievement);
        });
        // Reload achievements to get updated progress
        this.loadAchievements();
      }
    });

    this.socket.on('flavor_coins:earned', (data) => {
      console.log('🪙 Received flavor_coins:earned event', data);
      if (data.coins && data.coins.length > 0) {
        data.coins.forEach(coin => {
          // Format flavor coin as achievement for notification display
          const coinAchievement = {
            name: `${coin.flavorDisplay} Flavor Coin`,
            description: 'New flavor discovered!',
            icon: coin.flavorIcon || '🪙',
            iconType: 'emoji',
            code: `flavor_coin_${coin.flavorType}`,
            category: 'flavor_coin',
            points: 100,
            tier: null
          };
          this.emit('achievement:new', coinAchievement);
        });
        // Reload achievements to get updated coin count
        this.loadAchievements();
      }
    });

    this.socket.on('streak:updated', (streak) => {
      this.updateStreakData(streak);
      this.emit('streak:changed', streak);
    });
  }

  async loadAchievements() {
    try {
      console.log('📊 GamificationService: Loading achievements from /api/gamification/achievements');
      const response = await this.apiRequest('/api/gamification/achievements');
      this.achievements = response.achievements || [];
      this.userStats = response.stats || {};
      console.log(`✅ GamificationService: Loaded ${this.achievements.length} achievements, emitting event`);
      this.emit('achievements:loaded', {
        achievements: this.achievements,
        stats: this.userStats
      });
      return this.achievements;
    } catch (error) {
      console.error('❌ Failed to load achievements:', error);
      return [];
    }
  }

  async loadStreaks() {
    try {
      const response = await this.apiRequest('/api/gamification/streaks');
      this.streaks = response.streaks || [];
      this.emit('streaks:loaded', this.streaks);
      return this.streaks;
    } catch (error) {
      console.error('Failed to load streaks:', error);
      return [];
    }
  }

  async updateStreak(streakType = 'daily_rank') {
    try {
      const response = await this.apiRequest('/api/gamification/streaks/update', {
        method: 'POST',
        body: JSON.stringify({ streakType })
      });
      
      if (response.streak) {
        this.updateStreakData(response.streak);
        return response.streak;
      }
    } catch (error) {
      console.error('Failed to update streak:', error);
    }
  }

  updateStreakData(newStreak) {
    const index = this.streaks.findIndex(s => s.streakType === newStreak.streakType);
    if (index >= 0) {
      this.streaks[index] = newStreak;
    } else {
      this.streaks.push(newStreak);
    }
  }

  getEarnedAchievements() {
    return this.achievements.filter(a => a.earned);
  }

  getAchievementsByCategory(category) {
    return this.achievements.filter(a => a.category === category);
  }

  getStreak(type = 'daily_rank') {
    return this.streaks.find(s => s.streakType === type);
  }

  filterDuplicateAchievements(achievements) {
    // Group achievements by their requirement type
    const grouped = {};
    const tierOrder = { bronze: 1, silver: 2, gold: 3, platinum: 4 };
    
    achievements.forEach(achievement => {
      const reqType = achievement.requirement?.type;
      if (!reqType) {
        // If no requirement type, always show it
        if (!grouped['other']) grouped['other'] = [];
        grouped['other'].push(achievement);
        return;
      }
      
      if (!grouped[reqType]) {
        grouped[reqType] = [];
      }
      grouped[reqType].push(achievement);
    });
    
    // For each requirement type, only keep the highest tier achievement
    const filtered = [];
    Object.values(grouped).forEach(group => {
      if (group.length === 1) {
        filtered.push(group[0]);
      } else {
        // Sort by tier and keep only the highest
        group.sort((a, b) => (tierOrder[b.tier] || 0) - (tierOrder[a.tier] || 0));
        filtered.push(group[0]);
      }
    });
    
    return filtered;
  }
}

window.GamificationService = GamificationService;
