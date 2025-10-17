/**
 * ProgressTrackingService - Frontend service for progress tracking
 * Handles user progress, milestones, and insights
 */
class ProgressTrackingService extends BaseService {
  constructor(eventBus) {
    super(eventBus);
    this.progress = null;
    this.insights = null;
    this.achievements = [];
  }

  async initialize() {
    await super.initialize();
    
    this.subscribe('user:authenticated', () => {
      this.loadProgress();
    });

    this.subscribe('ranking:saved', (data) => {
      console.log('🔄 Progress widget received ranking:saved event, refreshing...', data);
      this.refreshProgress();
    });

    this.subscribe('achievements:loaded', (data) => {
      this.achievements = data.achievements || [];
      console.log('📊 ProgressTrackingService received achievements from GamificationService');
    });
  }

  async loadProgress() {
    try {
      const response = await this.apiRequest('/api/gamification/progress');
      this.progress = response.progress || null;
      this.insights = response.insights || null;
      
      this.emit('progress:loaded', {
        progress: this.progress,
        insights: this.insights
      });

      this.checkMilestones();
      
      return { progress: this.progress, insights: this.insights };
    } catch (error) {
      console.error('Failed to load progress:', error);
      return null;
    }
  }


  async refreshProgress() {
    await this.loadProgress();
    return { progress: this.progress, achievements: this.achievements };
  }

  checkMilestones() {
    if (!this.progress || !this.progress.nextMilestones) return;

    this.progress.nextMilestones.forEach(milestone => {
      if (milestone.remaining === 0) {
        this.celebrateMilestone(milestone);
      } else if (milestone.remaining <= 3 && milestone.remaining > 0) {
        this.showMilestoneProgress(milestone);
      }
    });
  }

  celebrateMilestone(milestone) {
    this.emit('milestone:reached', {
      type: 'celebration',
      target: milestone.target,
      message: `🎉 You've ranked ${milestone.target} products!`
    });
  }

  showMilestoneProgress(milestone) {
    this.emit('milestone:near', {
      type: 'progress',
      target: milestone.target,
      remaining: milestone.remaining,
      message: `Only ${milestone.remaining} more to reach ${milestone.target} rankings!`
    });
  }

  getProgressPercentage() {
    if (!this.progress || !this.progress.nextMilestones || this.progress.nextMilestones.length === 0) {
      return 0;
    }

    const nextMilestone = this.progress.nextMilestones[0];
    return nextMilestone.progress || 0;
  }

  getNextMilestone() {
    if (!this.progress || !this.progress.nextMilestones || this.progress.nextMilestones.length === 0) {
      return null;
    }

    return this.progress.nextMilestones[0];
  }

  getTotalPoints() {
    return this.progress?.totalPoints || 0;
  }

  getCurrentStreak() {
    return this.progress?.currentStreak || 0;
  }

  getLongestStreak() {
    return this.progress?.longestStreak || 0;
  }

  getFavoriteVendor() {
    return this.insights?.favoriteVendor || null;
  }

  getDiversityScore() {
    return this.insights?.diversityScore || 0;
  }
}

window.ProgressTrackingService = ProgressTrackingService;
