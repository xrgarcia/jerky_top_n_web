/**
 * WebSocket Gateway - Real-time event broadcasting
 * Handles Socket.IO connections and event distribution
 */

// Environment-aware room name helper (can be used outside the class)
function getRoomName(baseName) {
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const envPrefix = isProduction ? 'prod' : 'dev';
  return `${envPrefix}:${baseName}`;
}

class WebSocketGateway {
  constructor(io, services) {
    this.io = io;
    this.services = services;
    this.activeConnections = new Map(); // socketId -> connection data
    this.activeUsers = new Map(); // userId -> aggregated user data
    this.pendingAchievements = new Map(); // userId -> {achievements, flavorCoins, timestamp}
    
    // Environment prefix for room names to prevent cross-environment notification leakage
    const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
    this.envPrefix = isProduction ? 'prod' : 'dev';
    console.log(`🏷️  WebSocket environment prefix: ${this.envPrefix}`);
    
    this.setupEventHandlers();
    
    // Cleanup stale pending achievements every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupStalePendingAchievements();
    }, 5 * 60 * 1000);
  }
  
  /**
   * Generate environment-aware room name to prevent cross-environment notification leakage
   */
  room(name) {
    return `${this.envPrefix}:${name}`;
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

  async authenticateSocket(socket, session) {
    // Guard: Check if socket is already authenticated
    if (socket.userId && socket.userId === session.userId) {
      console.log(`⚠️ Socket ${socket.id} already authenticated for user ${session.userId}, skipping re-auth`);
      socket.emit('authenticated', { userId: session.userId });
      return;
    }
    
    // Clean state: Leave old room if re-authenticating as different user
    if (socket.userId && socket.userId !== session.userId) {
      console.log(`🔄 Socket ${socket.id} switching users: ${socket.userId} → ${session.userId}`);
      socket.leave(this.room(`user:${socket.userId}`));
    }
    
    socket.userId = session.userId;
    socket.join(this.room(`user:${session.userId}`));
    console.log(`🔐 User ${session.userId} authenticated on socket ${socket.id} (room: ${this.room(`user:${session.userId}`)})`);
    
    // Register user in activeUsers IMMEDIATELY before async work
    if (this.activeUsers.has(session.userId)) {
      const existingUser = this.activeUsers.get(session.userId);
      if (!existingUser.socketIds.includes(socket.id)) {
        existingUser.socketIds.push(socket.id);
      }
      existingUser.lastActivity = new Date().toISOString();
    } else {
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
    
    // Emit pending achievements
    const pendingKey = session.userId;
    if (this.pendingAchievements.has(pendingKey)) {
      const pendingData = this.pendingAchievements.get(pendingKey);
      const age = Date.now() - pendingData.timestamp;
      
      if (age < 5 * 60 * 1000) {
        if (pendingData.achievements && pendingData.achievements.length > 0) {
          console.log(`📬 Sending ${pendingData.achievements.length} pending achievement(s) to user ${session.userId} room (age: ${Math.round(age/1000)}s)`);
          this.io.to(this.room(`user:${session.userId}`)).emit('achievements:earned', { achievements: pendingData.achievements });
        }
      } else {
        console.log(`⏰ Discarding stale pending achievements for user ${session.userId} (age: ${Math.round(age/1000)}s)`);
      }
      
      this.pendingAchievements.delete(pendingKey);
    }
    
    // Fetch user details to enrich activeUsers
    const user = await this.services.storage.getUserById(session.userId);
    if (user) {
      if (this.activeUsers.has(session.userId)) {
        const userEntry = this.activeUsers.get(session.userId);
        userEntry.firstName = user.firstName;
        userEntry.lastName = user.lastName;
        userEntry.email = user.email;
        userEntry.role = user.role;
        this.activeUsers.set(session.userId, userEntry);
      }
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

  setupEventHandlers() {
    this.io.on('connection', async (socket) => {
      console.log(`✅ WebSocket client connected: ${socket.id}`);
      
      // Auto-authenticate from handshake cookies (HttpOnly session_id)
      const cookies = socket.handshake.headers.cookie;
      if (cookies) {
        const cookieMatch = cookies.match(/session_id=([^;]+)/);
        if (cookieMatch) {
          const sessionId = cookieMatch[1];
          const session = await this.services.storage.getSession(sessionId);
          if (session) {
            await this.authenticateSocket(socket, session);
          }
        }
      }

      socket.on('auth', async (data) => {
        if (data.sessionId) {
          const session = await this.services.storage.getSession(data.sessionId);
          if (session) {
            await this.authenticateSocket(socket, session);
          }
        }
      });

      socket.on('page:view', async (data) => {
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
          
          // Persist page view to user_activities table with correct activity type
          if (this.services.activityTrackingService) {
            setImmediate(async () => {
              try {
                // Determine activity type based on page and metadata
                if (data.page === 'product_detail' && data.productId) {
                  // Track product view
                  await this.services.activityTrackingService.trackProductView(
                    socket.userId,
                    data.productId,
                    data.productTitle || data.productId
                  );
                } else if (data.page === 'profile' && data.profileId) {
                  // Track profile view
                  await this.services.activityTrackingService.trackProfileView(
                    socket.userId,
                    data.profileId,
                    data.profileName || data.profileId
                  );
                } else {
                  // Track general page view
                  await this.services.activityTrackingService.track(
                    socket.userId,
                    'page_view',
                    { page: data.page || 'unknown' },
                    { socketId: socket.id }
                  );
                }

                // Check for engagement-based achievements after tracking
                if (this.services.engagementManager) {
                  // Flush batched activities to ensure achievement check sees latest data
                  await this.services.activityTrackingService.flush();
                  
                  const engagementUpdates = await this.services.engagementManager.checkAndUpdateEngagementAchievements(socket.userId);
                  
                  if (engagementUpdates.length > 0) {
                    console.log(`🎯 [WEBSOCKET ${data.page?.toUpperCase()}] User ${socket.userId} updated ${engagementUpdates.length} engagement achievement(s)`);
                    
                    // Emit newly earned achievements to the user via WebSocket (triggers toast notifications)
                    const newAchievements = engagementUpdates
                      .filter(update => update.isNew)
                      .map(update => update.achievement);
                    
                    if (newAchievements.length > 0) {
                      this.emitAchievements(socket.userId, newAchievements);
                    }
                  }
                }
              } catch (err) {
                console.error('Failed to track page view activity:', err);
              }
            });
          }
          
          // Trigger classification queue for page views
          if (this.services.classificationQueue) {
            setImmediate(async () => {
              try {
                await this.services.classificationQueue.enqueue(socket.userId, 'page_view');
              } catch (err) {
                console.error('Failed to enqueue classification for page view:', err);
              }
            });
          }
        }
      });

      socket.on('subscribe:leaderboard', () => {
        socket.join(this.room('leaderboard'));
        console.log(`📊 Socket ${socket.id} subscribed to leaderboard (room: ${this.room('leaderboard')})`);
      });

      socket.on('subscribe:activity-feed', () => {
        socket.join(this.room('activity-feed'));
        console.log(`📰 Socket ${socket.id} subscribed to activity feed (room: ${this.room('activity-feed')})`);
      });

      socket.on('subscribe:customer-orders', () => {
        // Only allow admin users to subscribe to customer orders updates
        if (socket.userData && (socket.userData.role === 'employee_admin' || socket.userData.email?.endsWith('@jerky.com'))) {
          socket.join(this.room('admin:customer-orders'));
          console.log(`📦 Socket ${socket.id} subscribed to customer orders updates (room: ${this.room('admin:customer-orders')}, user: ${socket.userData.email}, role: ${socket.userData.role})`);
          // Acknowledge subscription success
          socket.emit('subscription:confirmed', { room: 'customer-orders' });
        } else {
          const reason = !socket.userData 
            ? 'socket not authenticated (userData missing)' 
            : `insufficient permissions (role: ${socket.userData.role}, email: ${socket.userData.email})`;
          console.warn(`⚠️ Socket ${socket.id} attempted to subscribe to customer orders: ${reason}`);
          // Notify client of failed subscription
          socket.emit('subscription:failed', { 
            room: 'customer-orders', 
            reason: 'Admin access required' 
          });
        }
      });

      socket.on('unsubscribe:customer-orders', () => {
        socket.leave(this.room('admin:customer-orders'));
        console.log(`📦 Socket ${socket.id} unsubscribed from customer orders updates`);
      });

      socket.on('subscribe:queue-monitor', () => {
        // Only allow admin users to subscribe to queue monitor updates
        if (socket.userData && (socket.userData.role === 'employee_admin' || socket.userData.email?.endsWith('@jerky.com'))) {
          socket.join(this.room('admin:queue-monitor'));
          console.log(`📊 Socket ${socket.id} subscribed to queue monitor updates (room: ${this.room('admin:queue-monitor')})`);
          
          // Emit confirmation
          socket.emit('subscription:confirmed', {
            room: 'queue-monitor',
            timestamp: new Date().toISOString()
          });
        } else {
          console.log(`⚠️ Socket ${socket.id} denied queue-monitor subscription (not admin)`);
        }
      });

      socket.on('unsubscribe:queue-monitor', () => {
        socket.leave(this.room('admin:queue-monitor'));
        console.log(`📊 Socket ${socket.id} unsubscribed from queue monitor updates`);
      });

      socket.on('subscribe:live-users', async () => {
        if (!socket.userData || socket.userData.role !== 'employee_admin') {
          console.warn(`🚫 Unauthorized live-users subscription attempt from socket ${socket.id}`);
          socket.emit('error', { message: 'Unauthorized: Employee access required' });
          return;
        }
        
        socket.join(this.room('live-users'));
        console.log(`👥 Socket ${socket.id} (employee) subscribed to live users (room: ${this.room('live-users')})`);
      });

      socket.on('unsubscribe:leaderboard', () => {
        socket.leave(this.room('leaderboard'));
      });

      socket.on('unsubscribe:activity-feed', () => {
        socket.leave(this.room('activity-feed'));
      });

      socket.on('unsubscribe:live-users', () => {
        socket.leave(this.room('live-users'));
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
    
    this.io.to(this.room('live-users')).emit('live-users:update', {
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
      const roomName = this.room(`user:${userId}`);
      const room = this.io.sockets.adapter.rooms.get(roomName);
      const socketsInRoom = room ? room.size : 0;
      console.log(`🔊 Emitting ${achievements.length} achievement(s) to user ${userId} (${socketsInRoom} socket(s), room: ${roomName})`);
      this.io.to(roomName).emit('achievements:earned', { achievements });
    } else {
      // No authenticated socket, queue for later delivery
      const pendingKey = userId;
      const existingData = this.pendingAchievements.get(pendingKey) || { achievements: [], timestamp: Date.now() };
      
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

  broadcastAchievementEarned(userId, achievement) {
    this.io.to(this.room(`user:${userId}`)).emit('achievement:earned', achievement);
    this.io.to(this.room('activity-feed')).emit('activity:new', {
      type: 'achievement_earned',
      userId,
      data: achievement,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastStreakUpdate(userId, streak) {
    this.io.to(this.room(`user:${userId}`)).emit('streak:updated', streak);
    
    if (streak.continued && streak.currentStreak % 7 === 0) {
      this.io.to(this.room('activity-feed')).emit('activity:new', {
        type: 'streak_milestone',
        userId,
        data: streak,
        timestamp: new Date().toISOString(),
      });
    }
  }

  broadcastLeaderboardUpdate() {
    this.io.to(this.room('leaderboard')).emit('leaderboard:updated', {
      timestamp: new Date().toISOString(),
    });
  }

  broadcastProductRanked(userId, productData, ranking) {
    this.io.to(this.room('activity-feed')).emit('activity:new', {
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
    this.io.to(this.room('admin:customer-orders')).emit('customer-orders:updated', {
      ...data,
      timestamp: new Date().toISOString(),
    });
    console.log(`📦 Broadcasting customer orders update to admin room (${this.room('admin:customer-orders')}): ${data.action} - ${data.orderNumber}`);
  }

  /**
   * Broadcast queue statistics to admin users
   */
  broadcastQueueStats(stats) {
    const adminRoom = this.room('admin:queue-monitor');
    this.io.to(adminRoom).emit('queue:stats-update', { stats, timestamp: new Date().toISOString() });
  }

  emitClassificationUpdate(userId, classification) {
    const hasSocket = this.hasAuthenticatedSocket(userId);
    
    if (hasSocket) {
      const roomName = this.room(`user:${userId}`);
      console.log(`🎯 Emitting classification update to user ${userId} (room: ${roomName})`);
      this.io.to(roomName).emit('classification:updated', {
        classification,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`📥 User ${userId} classification updated but no authenticated socket`);
    }
  }

  emitGuidanceUpdate(userId, guidance) {
    const hasSocket = this.hasAuthenticatedSocket(userId);
    
    if (hasSocket) {
      const roomName = this.room(`user:${userId}`);
      console.log(`💡 Emitting guidance update to user ${userId} (room: ${roomName})`);
      this.io.to(roomName).emit('guidance:updated', {
        guidance,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`📥 User ${userId} guidance updated but no authenticated socket`);
    }
  }
}

module.exports = WebSocketGateway;
module.exports.getRoomName = getRoomName;
