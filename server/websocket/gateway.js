/**
 * WebSocket Gateway - Real-time event broadcasting
 * Handles Socket.IO connections and event distribution
 */

class WebSocketGateway {
  constructor(io, services) {
    this.io = io;
    this.services = services;
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`✅ WebSocket client connected: ${socket.id}`);

      socket.on('auth', async (data) => {
        if (data.sessionId) {
          const session = await this.services.storage.getSession(data.sessionId);
          if (session) {
            socket.userId = session.userId;
            socket.join(`user:${session.userId}`);
            console.log(`🔐 User ${session.userId} authenticated on socket ${socket.id}`);
            
            socket.emit('authenticated', { userId: session.userId });
          }
        }
      });

      socket.on('subscribe:leaderboard', () => {
        socket.join('leaderboard');
        console.log(`📊 Socket ${socket.id} subscribed to leaderboard`);
      });

      socket.on('subscribe:activity-feed', () => {
        socket.join('activity-feed');
        console.log(`📰 Socket ${socket.id} subscribed to activity feed`);
      });

      socket.on('unsubscribe:leaderboard', () => {
        socket.leave('leaderboard');
      });

      socket.on('unsubscribe:activity-feed', () => {
        socket.leave('activity-feed');
      });

      socket.on('disconnect', () => {
        console.log(`👋 WebSocket client disconnected: ${socket.id}`);
      });
    });
  }

  broadcastAchievementEarned(userId, achievement) {
    this.io.to(`user:${userId}`).emit('achievement:earned', achievement);
    this.io.to('activity-feed').emit('activity:new', {
      type: 'achievement_earned',
      userId,
      data: achievement,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastStreakUpdate(userId, streak) {
    this.io.to(`user:${userId}`).emit('streak:updated', streak);
    
    if (streak.continued && streak.currentStreak % 7 === 0) {
      this.io.to('activity-feed').emit('activity:new', {
        type: 'streak_milestone',
        userId,
        data: streak,
        timestamp: new Date().toISOString(),
      });
    }
  }

  broadcastLeaderboardUpdate() {
    this.io.to('leaderboard').emit('leaderboard:updated', {
      timestamp: new Date().toISOString(),
    });
  }

  broadcastProductRanked(userId, productData, ranking) {
    this.io.to('activity-feed').emit('activity:new', {
      type: 'product_ranked',
      userId,
      data: { productData, ranking },
      timestamp: new Date().toISOString(),
    });
    
    this.broadcastLeaderboardUpdate();
  }

  broadcastProductViewed(productId, viewCount) {
    this.io.emit('product:view-count', {
      productId,
      viewCount,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = WebSocketGateway;
