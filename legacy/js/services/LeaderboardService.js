/**
 * LeaderboardService - Frontend service for leaderboard features
 * Handles leaderboard data and user rankings
 */
class LeaderboardService extends BaseService {
  constructor(eventBus, socket) {
    super(eventBus);
    this.socket = socket;
    this.leaderboard = [];
    this.userPosition = null;
    this.subscribed = false;
  }

  async initialize() {
    await super.initialize();
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('leaderboard:updated', () => {
      this.refreshLeaderboard();
    });
  }

  subscribeToUpdates() {
    if (!this.subscribed) {
      this.socket.emit('subscribe:leaderboard');
      this.subscribed = true;
    }
  }

  unsubscribeFromUpdates() {
    if (this.subscribed) {
      this.socket.emit('unsubscribe:leaderboard');
      this.subscribed = false;
    }
  }

  async loadLeaderboard(period = 'all_time', limit = 50) {
    try {
      const response = await this.apiRequest(
        `/api/gamification/leaderboard?period=${period}&limit=${limit}`
      );
      
      this.leaderboard = response.leaderboard || [];
      this.emit('leaderboard:loaded', {
        leaderboard: this.leaderboard,
        period
      });
      
      return this.leaderboard;
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      return [];
    }
  }

  async loadUserPosition(period = 'all_time') {
    try {
      const response = await this.apiRequest(
        `/api/gamification/leaderboard/position?period=${period}`
      );
      
      this.userPosition = response;
      this.emit('position:loaded', this.userPosition);
      
      return this.userPosition;
    } catch (error) {
      console.error('Failed to load user position:', error);
      return null;
    }
  }

  async refreshLeaderboard() {
    await this.loadLeaderboard();
    await this.loadUserPosition();
  }

  getTopRankers(count = 10) {
    return this.leaderboard.slice(0, count);
  }

  getUserRank() {
    return this.userPosition?.rank || null;
  }

  getUserPercentile() {
    return this.userPosition?.percentile || null;
  }

  isUserInTop(position) {
    const rank = this.getUserRank();
    return rank !== null && rank <= position;
  }

  async compareWithUser(userId) {
    try {
      const response = await this.apiRequest(
        `/api/gamification/user/compare/${userId}`
      );
      
      this.emit('comparison:loaded', response);
      return response;
    } catch (error) {
      console.error('Failed to compare users:', error);
      return null;
    }
  }
}

window.LeaderboardService = LeaderboardService;
