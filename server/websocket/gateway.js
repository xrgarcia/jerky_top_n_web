/**
 * WebSocket Gateway - Real-time event broadcasting
 * Handles Socket.IO connections and event distribution
 */

class WebSocketGateway {
  constructor(io, services) {
    this.io = io;
    this.services = services;
    this.activeConnections = new Map(); // socketId -> connection data
    this.activeUsers = new Map(); // userId -> aggregated user data
    this.pendingAchievements = new Map(); // userId -> {achievements, timestamp}
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`✅ WebSocket client connected: ${socket.id}`);

      socket.on('auth', async (data) => {
        if (data.sessionId) {
          const session = await this.services.storage.getSession(data.sessionId);
          if (session) {
            // Guard: Check if socket is already authenticated
            if (socket.userId && socket.userId === session.userId) {
              console.log(`⚠️ Socket ${socket.id} already authenticated for user ${session.userId}, skipping re-auth`);
              socket.emit('authenticated', { userId: session.userId });
              return;
            }
            
            // Clean state: Leave old room if re-authenticating as different user
            if (socket.userId && socket.userId !== session.userId) {
              console.log(`🔄 Socket ${socket.id} switching users: ${socket.userId} → ${session.userId}`);
              socket.leave(`user:${socket.userId}`);
            }
            
            socket.userId = session.userId;
            socket.join(`user:${session.userId}`);
            console.log(`🔐 User ${session.userId} authenticated on socket ${socket.id}`);
            
            // Emit any pending achievements that were missed while socket was disconnected
            const pendingKey = session.userId;
            if (this.pendingAchievements.has(pendingKey)) {
              const pendingData = this.pendingAchievements.get(pendingKey);
              const age = Date.now() - pendingData.timestamp;
              
              // Only send if less than 5 minutes old
              if (age < 5 * 60 * 1000) {
                console.log(`📬 Sending ${pendingData.achievements?.length || 0} pending achievement(s) to user ${session.userId} (age: ${Math.round(age/1000)}s)`);
                socket.emit('achievements:earned', { achievements: pendingData.achievements });
                
                if (pendingData.flavorCoins && pendingData.flavorCoins.length > 0) {
                  console.log(`📬 Sending ${pendingData.flavorCoins.length} pending flavor coin(s) to user ${session.userId}`);
                  socket.emit('flavor_coins:earned', { coins: pendingData.flavorCoins });
                }
              } else {
                console.log(`⏰ Discarding stale pending achievements for user ${session.userId} (age: ${Math.round(age/1000)}s)`);
              }
              
              this.pendingAchievements.delete(pendingKey);
            }
            
            const user = await this.services.storage.getUserById(session.userId);
            if (user) {
              socket.userData = {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
              };
              
              // Track this socket connection
              this.activeConnections.set(socket.id, {
                socketId: socket.id,
                userId: user.id,
                currentPage: 'home',
                lastActivity: new Date().toISOString()
              });
              
              // Update or create user entry (aggregated view)
              if (this.activeUsers.has(user.id)) {
                const existingUser = this.activeUsers.get(user.id);
                // Only add socket if not already tracked
                if (!existingUser.socketIds.includes(socket.id)) {
                  existingUser.socketIds.push(socket.id);
                }
                existingUser.lastActivity = new Date().toISOString();
              } else {
                this.activeUsers.set(user.id, {
                  userId: user.id,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  email: user.email,
                  role: user.role,
                  connectedAt: new Date().toISOString(),
                  lastActivity: new Date().toISOString(),
                  currentPage: 'home',
                  socketIds: [socket.id]
                });
              }
              
              this.broadcastActiveUsersUpdate();
            }
            
            socket.emit('authenticated', { userId: session.userId });
          }
        }
      });

      socket.on('page:view', (data) => {
        if (socket.userId && this.activeConnections.has(socket.id)) {
          // Update socket connection
          const connection = this.activeConnections.get(socket.id);
          connection.currentPage = data.page || 'unknown';
          connection.lastActivity = new Date().toISOString();
          this.activeConnections.set(socket.id, connection);
          
          // Update user's current page (most recent page view)
          if (this.activeUsers.has(socket.userId)) {
            const user = this.activeUsers.get(socket.userId);
            user.currentPage = data.page || 'unknown';
            user.lastActivity = new Date().toISOString();
            this.activeUsers.set(socket.userId, user);
          }
          
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
          const connection = this.activeConnections.get(socket.id);
          const userId = connection.userId;
          
          // Remove socket connection
          this.activeConnections.delete(socket.id);
          
          // Update user entry - remove this socket from their list
          if (userId && this.activeUsers.has(userId)) {
            const user = this.activeUsers.get(userId);
            user.socketIds = user.socketIds.filter(id => id !== socket.id);
            
            // If user has no more active sockets, remove them completely
            if (user.socketIds.length === 0) {
              this.activeUsers.delete(userId);
              console.log(`👤 User ${userId} fully disconnected (no active sockets)`);
            } else {
              this.activeUsers.set(userId, user);
              console.log(`👤 User ${userId} still has ${user.socketIds.length} active socket(s)`);
            }
          }
          
          this.broadcastActiveUsersUpdate();
        }
      });
    });
  }

  getActiveUsers() {
    return Array.from(this.activeUsers.values()).map(user => ({
      ...user,
      socketId: user.socketIds[0], // Use first socket as representative ID
      connectionCount: user.socketIds.length
    }));
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
