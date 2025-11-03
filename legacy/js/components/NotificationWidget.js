/**
 * NotificationWidget - Displays toast notifications for achievements and events
 * Now with queue support for sequential display
 */
class NotificationWidget {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.container = null;
    this.queue = [];
    this.isShowing = false;
    this.currentNotification = null;
    this.init();
  }

  init() {
    this.createContainer();
    this.setupEventListeners();
  }

  createContainer() {
    this.container = DOMHelpers.createElement('div', {
      id: 'notification-container',
      className: 'notification-container'
    });
    document.body.appendChild(this.container);
  }

  createIconElement(icon) {
    if (typeof icon === 'string' && (icon.startsWith('/') || icon.startsWith('http'))) {
      const img = DOMHelpers.createElement('img', {
        src: icon,
        alt: 'Achievement Icon',
        className: 'notification-icon-image'
      });
      img.style.width = '48px';
      img.style.height = '48px';
      img.style.objectFit = 'contain';
      return img;
    }
    return icon;
  }

  setupEventListeners() {
    this.eventBus.on('notification:show', (notification) => {
      console.log('🔔 NotificationWidget received notification:show event', notification);
      this.show(notification);
    });

    this.eventBus.on('achievement:new', (achievement) => {
      console.log('🏆 NotificationWidget received achievement:new event', achievement);
      this.showAchievement(achievement);
    });

    this.eventBus.on('milestone:reached', (milestone) => {
      console.log('🎯 NotificationWidget received milestone:reached event', milestone);
      this.showMilestone(milestone);
    });
  }

  show(notification) {
    // Add to queue instead of showing immediately
    this.queue.push(notification);
    console.log(`📥 Toast added to queue (${this.queue.length} in queue)`);
    
    // Process queue if nothing is currently showing
    if (!this.isShowing) {
      this.processQueue();
    }
  }

  processQueue() {
    // If queue is empty or already showing, do nothing
    if (this.queue.length === 0 || this.isShowing) {
      return;
    }

    // Get next notification from queue
    const notification = this.queue.shift();
    this.isShowing = true;
    
    console.log(`🎬 Showing toast: ${notification.title} (${this.queue.length} remaining in queue)`);

    const iconElement = this.createIconElement(notification.icon || '🔔');
    
    const notificationEl = DOMHelpers.createElement('div', {
      className: `notification notification-${notification.type || 'info'} ${notification.tier ? `tier-${notification.tier}` : ''}`
    }, [
      DOMHelpers.createElement('div', {
        className: 'notification-icon'
      }, iconElement),
      DOMHelpers.createElement('div', {
        className: 'notification-content'
      }, [
        DOMHelpers.createElement('div', {
          className: 'notification-title'
        }, notification.title || 'Notification'),
        DOMHelpers.createElement('div', {
          className: 'notification-message'
        }, notification.message),
        notification.description ? DOMHelpers.createElement('div', {
          className: 'notification-description'
        }, notification.description) : null
      ].filter(Boolean))
    ]);

    this.currentNotification = notificationEl;
    this.container.appendChild(notificationEl);

    // Show animation
    setTimeout(() => {
      notificationEl.classList.add('show');
    }, 10);

    // Auto-dismiss after 3 seconds and show next
    setTimeout(() => {
      notificationEl.classList.remove('show');
      setTimeout(() => {
        notificationEl.remove();
        this.currentNotification = null;
        this.isShowing = false;
        
        // Process next notification in queue
        console.log(`✅ Toast dismissed, processing next (${this.queue.length} in queue)`);
        this.processQueue();
      }, 300); // Wait for fade-out animation
    }, 3000); // 3-second display duration
  }

  showAchievement(achievement) {
    console.log('💬 NotificationWidget.showAchievement() called with:', achievement);
    const isTierUpgrade = achievement.isTierUpgrade;
    const tierEmojis = {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      platinum: '👑',
      diamond: '💠'
    };
    
    let title = '🎉 Achievement Unlocked!';
    let message = achievement.name;
    let description = achievement.description;
    
    if (isTierUpgrade) {
      const tierEmoji = tierEmojis[achievement.tier] || '⭐';
      title = `⬆️ Tier Upgraded!`;
      message = `${achievement.name} - ${tierEmoji} ${achievement.tier.charAt(0).toUpperCase() + achievement.tier.slice(1)}`;
      
      if (achievement.pointsGained) {
        description = `+${achievement.pointsGained} points earned! ${achievement.description || ''}`;
      }
    }
    
    console.log(`✨ Showing toast: ${title} - ${message}`);
    
    this.show({
      type: 'achievement',
      icon: achievement.icon,
      title,
      message,
      description,
      tier: achievement.tier,
      duration: 6000
    });
  }

  showMilestone(milestone) {
    this.show({
      type: 'milestone',
      icon: '🎯',
      title: milestone.message,
      message: `You've reached a new milestone!`,
      duration: 5000
    });
  }
}

window.NotificationWidget = NotificationWidget;
