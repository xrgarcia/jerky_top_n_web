/**
 * WebSocket Gateway - Real-time event broadcasting
 * Handles Socket.IO connections and event distribution
 */

class WebSocketGateway {
  constructor(io, services) {
    this.io = io;
    this.services = services;
    this.activeConnections = new Map();
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
            
            const user = await this.services.storage.getUserById(session.userId);
            if (user) {
              socket.userData = {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
              };
              
              this.activeConnections.set(socket.id, {
                socketId: socket.id,
                userId: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                connectedAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                currentPage: 'home'
              });
              
              this.broadcastActiveUsersUpdate();
            }
            
            socket.emit('authenticated', { userId: session.userId });
          }
        }
      });

      socket.on('page:view', (data) => {
        if (socket.userId && this.activeConnections.has(socket.id)) {
          const connection = this.activeConnections.get(socket.id);
          connection.currentPage = data.page || 'unknown';
          connection.lastActivity = new Date().toISOString();
          this.activeConnections.set(socket.id, connection);
          this.broadcastActiveUsersUpdate();
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

      socket.on('subscribe:live-users', async () => {
        if (!socket.userData || socket.userData.role !== 'employee_admin') {
          console.warn(`🚫 Unauthorized live-users subscription attempt from socket ${socket.id}`);
          socket.emit('error', { message: 'Unauthorized: Employee access required' });
          return;
        }
        
        socket.join('live-users');
        console.log(`👥 Socket ${socket.id} (employee) subscribed to live users`);
      });

      socket.on('unsubscribe:leaderboard', () => {
        socket.leave('leaderboard');
      });

      socket.on('unsubscribe:activity-feed', () => {
        socket.leave('activity-feed');
      });

      socket.on('unsubscribe:live-users', () => {
        socket.leave('live-users');
      });

      socket.on('disconnect', () => {
        console.log(`👋 WebSocket client disconnected: ${socket.id}`);
        
        if (this.activeConnections.has(socket.id)) {
          this.activeConnections.delete(socket.id);
          this.broadcastActiveUsersUpdate();
        }
      });
    });
  }

  getActiveUsers() {
    return Array.from(this.activeConnections.values());
  }

  broadcastActiveUsersUpdate() {
    const activeUsers = this.getActiveUsers();
    
    const sanitizedUsers = activeUsers.map(user => ({
      ...user,
      lastName: user.lastName ? user.lastName.charAt(0) + '.' : '',
      email: user.role === 'employee_admin' ? user.email : user.email.split('@')[0] + '@***'
    }));
    
    this.io.to('live-users').emit('live-users:update', {
      users: sanitizedUsers,
      count: sanitizedUsers.length,
      timestamp: new Date().toISOString()
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
