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
    this.socket.on('achievement:earned', (achievement) => {
      this.achievements.push(achievement);
      this.emit('achievement:new', achievement);
      this.showAchievementNotification(achievement);
    });

    this.socket.on('achievements:earned', (data) => {
      console.log('🏆 Received achievements:earned event', data);
      if (data.achievements && data.achievements.length > 0) {
        // Filter out redundant achievements - keep only the best of each type
        const filtered = this.filterDuplicateAchievements(data.achievements);
        
        filtered.forEach(achievement => {
          this.achievements.push(achievement);
          this.emit('achievement:new', achievement);
          this.showAchievementNotification(achievement);
        });
        // Reload achievements to get updated progress
        this.loadAchievements();
      }
    });

    this.socket.on('streak:updated', (streak) => {
      this.updateStreak(streak);
      this.emit('streak:changed', streak);
    });
  }

  async loadAchievements() {
    try {
      const response = await this.apiRequest('/api/gamification/achievements');
      this.achievements = response.achievements || [];
      this.userStats = response.stats || {};
      this.emit('achievements:loaded', {
        achievements: this.achievements,
        stats: this.userStats
      });
      return this.achievements;
    } catch (error) {
      console.error('Failed to load achievements:', error);
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

  showAchievementNotification(achievement) {
    const notification = {
      type: 'achievement',
      title: 'Achievement Unlocked!',
      message: `${achievement.icon} ${achievement.name}`,
      description: achievement.description,
      tier: achievement.tier
    };
    this.emit('notification:show', notification);
  }
}

window.GamificationService = GamificationService;
