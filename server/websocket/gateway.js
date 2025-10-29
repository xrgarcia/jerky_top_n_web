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
    this.pendingAchievements = new Map(); // userId -> {achievements, flavorCoins, timestamp}
    this.setupEventHandlers();
    
    // Cleanup stale pending achievements every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupStalePendingAchievements();
    }, 5 * 60 * 1000);
  }

  cleanupStalePendingAchievements() {
    const now = Date.now();
    const TTL = 5 * 60 * 1000; // 5 minutes
    let cleanedCount = 0;
    
    for (const [userId, data] of this.pendingAchievements.entries()) {
      if (now - data.timestamp > TTL) {
        this.pendingAchievements.delete(userId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} stale pending achievement queue(s)`);
    }
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
            
            // TEST: Emit a test event immediately to verify socket communication
            socket.emit('test:ping', { message: 'Socket is working!', timestamp: Date.now() });
            console.log(`📡 TEST: Sent test:ping to socket ${socket.id}`);
            
            // Register user in activeUsers IMMEDIATELY before async work
            // This prevents the race where achievements earned during getUserById() are queued
            if (this.activeUsers.has(session.userId)) {
              const existingUser = this.activeUsers.get(session.userId);
              if (!existingUser.socketIds.includes(socket.id)) {
                existingUser.socketIds.push(socket.id);
              }
              existingUser.lastActivity = new Date().toISOString();
            } else {
              // Create minimal user entry with just userId - will be enriched after getUserById()
              this.activeUsers.set(session.userId, {
                userId: session.userId,
                socketIds: [socket.id],
                connectedAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                currentPage: 'home'
              });
            }
            
            // Track socket connection
            this.activeConnections.set(socket.id, {
              socketId: socket.id,
              userId: session.userId,
              currentPage: 'home',
              lastActivity: new Date().toISOString()
            });
            
            // Emit any pending achievements that were missed while socket was disconnected
            const pendingKey = session.userId;
            if (this.pendingAchievements.has(pendingKey)) {
              const pendingData = this.pendingAchievements.get(pendingKey);
              const age = Date.now() - pendingData.timestamp;
              
              // Only send if less than 5 minutes old
              if (age < 5 * 60 * 1000) {
                // Emit to entire user room (not just this socket) to support multi-device
                if (pendingData.achievements && pendingData.achievements.length > 0) {
                  console.log(`📬 Sending ${pendingData.achievements.length} pending achievement(s) to user ${session.userId} room (age: ${Math.round(age/1000)}s)`);
                  this.io.to(`user:${session.userId}`).emit('achievements:earned', { achievements: pendingData.achievements });
                }
                
                if (pendingData.flavorCoins && pendingData.flavorCoins.length > 0) {
                  console.log(`📬 Sending ${pendingData.flavorCoins.length} pending flavor coin(s) to user ${session.userId} room`);
                  this.io.to(`user:${session.userId}`).emit('flavor_coins:earned', { coins: pendingData.flavorCoins });
                }
              } else {
                console.log(`⏰ Discarding stale pending achievements for user ${session.userId} (age: ${Math.round(age/1000)}s)`);
              }
              
              this.pendingAchievements.delete(pendingKey);
            }
            
            // Now fetch user details to enrich the activeUsers entry
            const user = await this.services.storage.getUserById(session.userId);
            if (user) {
              // Enrich the existing activeUsers entry with full user data
              if (this.activeUsers.has(session.userId)) {
                const userEntry = this.activeUsers.get(session.userId);
                userEntry.firstName = user.firstName;
                userEntry.lastName = user.lastName;
                userEntry.email = user.email;
                userEntry.role = user.role;
                this.activeUsers.set(session.userId, userEntry);
              }
              // Set socket userData
              socket.userData = {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
              };
              
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

      socket.on('subscribe:customer-orders', () => {
        // Only allow admin users to subscribe to customer orders updates
        if (socket.userData && (socket.userData.role === 'employee_admin' || socket.userData.email?.endsWith('@jerky.com'))) {
          socket.join('admin:customer-orders');
          console.log(`📦 Socket ${socket.id} subscribed to customer orders updates`);
        } else {
          console.warn(`⚠️ Socket ${socket.id} attempted to subscribe to customer orders without admin access`);
        }
      });

      socket.on('unsubscribe:customer-orders', () => {
        socket.leave('admin:customer-orders');
        console.log(`📦 Socket ${socket.id} unsubscribed from customer orders updates`);
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
      email: user.email 
        ? (user.role === 'employee_admin' ? user.email : user.email.split('@')[0] + '@***')
        : 'unknown@***'
    }));
    
    this.io.to('live-users').emit('live-users:update', {
      users: sanitizedUsers,
      count: sanitizedUsers.length,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Check if a user has any authenticated sockets
   */
  hasAuthenticatedSocket(userId) {
    return this.activeUsers.has(userId) && this.activeUsers.get(userId).socketIds.length > 0;
  }

  /**
   * Safely emit achievements to user - queues them if socket not authenticated
   */
  emitAchievements(userId, achievements) {
    const hasSocket = this.hasAuthenticatedSocket(userId);
    
    if (hasSocket) {
      // User has authenticated socket, emit directly
      const roomName = `user:${userId}`;
      const room = this.io.sockets.adapter.rooms.get(roomName);
      const socketsInRoom = room ? room.size : 0;
      console.log(`🔊 Emitting ${achievements.length} achievement(s) to user ${userId} (${socketsInRoom} socket(s))`);
      this.io.to(roomName).emit('achievements:earned', { achievements });
    } else {
      // No authenticated socket, queue for later delivery
      const pendingKey = userId;
      const existingData = this.pendingAchievements.get(pendingKey) || { achievements: [], flavorCoins: [], timestamp: Date.now() };
      
      // Merge new achievements with existing pending ones (prevent duplicates by code)
      const existingCodes = new Set(existingData.achievements.map(a => a.code || a.name));
      const newAchievements = achievements.filter(a => !existingCodes.has(a.code || a.name));
      
      if (newAchievements.length > 0) {
        existingData.achievements.push(...newAchievements);
        existingData.timestamp = Date.now(); // Update timestamp
        this.pendingAchievements.set(pendingKey, existingData);
        console.log(`📥 Queued ${newAchievements.length} achievement(s) for user ${userId} (no socket)`);
      }
    }
  }

  /**
   * Safely emit flavor coins to user - queues them if socket not authenticated
   */
  emitFlavorCoins(userId, coins) {
    const hasSocket = this.hasAuthenticatedSocket(userId);
    
    if (hasSocket) {
      // User has authenticated socket, emit directly
      this.io.to(`user:${userId}`).emit('flavor_coins:earned', { coins });
      console.log(`✅ Emitted ${coins.length} flavor coin(s) to authenticated user ${userId}`);
    } else {
      // No authenticated socket, queue for later delivery
      const pendingKey = userId;
      const existingData = this.pendingAchievements.get(pendingKey) || { achievements: [], flavorCoins: [], timestamp: Date.now() };
      
      // Accumulate ALL coins (don't deduplicate) - multiple drops of same flavor are valid
      existingData.flavorCoins.push(...coins);
      existingData.timestamp = Date.now(); // Update timestamp
      this.pendingAchievements.set(pendingKey, existingData);
      console.log(`📥 Queued ${coins.length} flavor coin(s) for user ${userId} (no authenticated socket, total pending: ${existingData.flavorCoins.length})`);
    }
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

  broadcastCustomerOrdersUpdate(data) {
    this.io.to('admin:customer-orders').emit('customer-orders:updated', {
      ...data,
      timestamp: new Date().toISOString(),
    });
    console.log(`📦 Broadcasting customer orders update to admin room: ${data.action} - ${data.orderNumber}`);
  }
}

module.exports = WebSocketGateway;
