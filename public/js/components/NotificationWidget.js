/**
 * NotificationWidget - Displays toast notifications for achievements and events
 */
class NotificationWidget {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.container = null;
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
      this.show(notification);
    });

    this.eventBus.on('achievement:new', (achievement) => {
      this.showAchievement(achievement);
    });

    this.eventBus.on('milestone:reached', (milestone) => {
      this.showMilestone(milestone);
    });
  }

  show(notification) {
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

    this.container.appendChild(notificationEl);

    setTimeout(() => {
      notificationEl.classList.add('show');
    }, 10);

    setTimeout(() => {
      notificationEl.classList.remove('show');
      setTimeout(() => {
        notificationEl.remove();
      }, 300);
    }, notification.duration || 5000);
  }

  showAchievement(achievement) {
    this.show({
      type: 'achievement',
      icon: achievement.icon,
      title: '🎉 Achievement Unlocked!',
      message: achievement.name,
      description: achievement.description,
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
