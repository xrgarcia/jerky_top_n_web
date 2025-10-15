/**
 * Application Initialization
 * Wires together the event bus, services, and Socket.IO connection
 */

(function() {
  'use strict';

  console.log('🚀 Initializing application architecture...');

  const eventBus = new EventBus();
  const serviceRegistry = new ServiceRegistry();

  const socket = io();

  socket.on('connect', () => {
    console.log('✅ WebSocket connected');
    const sessionId = localStorage.getItem('customerSessionId');
    if (sessionId) {
      socket.emit('auth', { sessionId });
    }
  });

  socket.on('authenticated', (data) => {
    console.log('🔐 Socket authenticated for user:', data.userId);
    eventBus.emit('socket:authenticated', data);
    eventBus.emit('user:authenticated', data);
  });

  socket.on('disconnect', () => {
    console.log('❌ WebSocket disconnected');
    eventBus.emit('socket:disconnected');
  });

  serviceRegistry.register('eventBus', () => eventBus);
  serviceRegistry.register('socket', () => socket);

  serviceRegistry.register('gamification', (registry) => {
    const bus = registry.get('eventBus');
    const sock = registry.get('socket');
    return new GamificationService(bus, sock);
  });

  serviceRegistry.register('socialProof', (registry) => {
    const bus = registry.get('eventBus');
    const sock = registry.get('socket');
    return new SocialProofService(bus, sock);
  });

  serviceRegistry.register('activityFeed', (registry) => {
    const bus = registry.get('eventBus');
    const sock = registry.get('socket');
    return new ActivityFeedService(bus, sock);
  });

  serviceRegistry.register('progressTracking', (registry) => {
    const bus = registry.get('eventBus');
    return new ProgressTrackingService(bus);
  });

  serviceRegistry.register('leaderboard', (registry) => {
    const bus = registry.get('eventBus');
    const sock = registry.get('socket');
    return new LeaderboardService(bus, sock);
  });

  async function initializeServices() {
    console.log('⚙️ Initializing services...');
    
    const services = [
      'gamification',
      'socialProof',
      'activityFeed',
      'progressTracking',
      'leaderboard'
    ];

    for (const serviceName of services) {
      try {
        const service = serviceRegistry.get(serviceName);
        if (service.initialize) {
          await service.initialize();
          console.log(`✅ ${serviceName} initialized`);
        }
      } catch (error) {
        console.error(`❌ Failed to initialize ${serviceName}:`, error);
      }
    }
  }

  function initializeWidgets() {
    console.log('🎨 Initializing UI widgets...');
    
    new NotificationWidget(eventBus);
    console.log('✅ Notification widget created');
    
    eventBus.emit('widgets:initialized');
  }

  initializeServices().then(() => {
    console.log('✅ All services initialized');
    initializeWidgets();
  });

  window.appEventBus = eventBus;
  window.appServices = serviceRegistry;
  window.appSocket = socket;
  window.socket = socket;

  console.log('✅ Application architecture initialized');
})();
