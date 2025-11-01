/**
 * ActivityFeedService - Frontend service for activity feed
 * Handles real-time activity updates and feed management
 */
class ActivityFeedService extends BaseService {
  constructor(eventBus, socket) {
    super(eventBus);
    this.socket = socket;
    this.activities = [];
    this.subscribed = false;
  }

  async initialize() {
    await super.initialize();
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('activity:new', (activity) => {
      this.addActivity(activity);
      this.emit('activity:added', activity);
    });
  }

  subscribeToFeed() {
    if (!this.subscribed) {
      this.socket.emit('subscribe:activity-feed');
      this.subscribed = true;
    }
  }

  unsubscribeFromFeed() {
    if (this.subscribed) {
      this.socket.emit('unsubscribe:activity-feed');
      this.subscribed = false;
    }
  }

  async loadActivities(limit = 50, type = null) {
    try {
      const url = type
        ? `/api/gamification/activity-feed?limit=${limit}&type=${type}`
        : `/api/gamification/activity-feed?limit=${limit}`;
      
      const response = await this.apiRequest(url);
      this.activities = response.activities || [];
      this.emit('activities:loaded', this.activities);
      return this.activities;
    } catch (error) {
      console.error('Failed to load activities:', error);
      return [];
    }
  }

  addActivity(activity) {
    this.activities.unshift(activity);
    
    if (this.activities.length > 100) {
      this.activities = this.activities.slice(0, 100);
    }
  }

  getActivities(limit = 50) {
    return this.activities.slice(0, limit);
  }

  getActivitiesByType(type, limit = 50) {
    return this.activities
      .filter(a => a.activityType === type)
      .slice(0, limit);
  }

  formatActivity(activity) {
    const formatters = {
      rank_product: (data) => ({
        icon: '🏆',
        text: `ranked ${data.productData?.title || 'a product'} #${data.ranking}`
      }),
      earn_badge: (data) => ({
        icon: data.achievementIcon || '🎖️',
        text: `earned "${data.achievementName}"`
      }),
      streak_milestone: (data) => ({
        icon: '🔥',
        text: `reached a ${data.currentStreak}-day streak!`
      }),
      streak_started: (data) => ({
        icon: '✨',
        text: 'started a new ranking streak'
      })
    };

    const formatter = formatters[activity.activityType];
    if (formatter) {
      return formatter(activity.activityData);
    }

    return {
      icon: '📌',
      text: activity.activityType.replace(/_/g, ' ')
    };
  }
}

window.ActivityFeedService = ActivityFeedService;
