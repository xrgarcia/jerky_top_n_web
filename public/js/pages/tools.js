/**
 * Tools Page - Employee Admin Tools
 */

let liveUsersSubscribed = false;
let currentToolTab = 'achievements';

async function loadAchievementsTable() {
  try {
    const response = await fetch('/api/tools/achievements');
    
    if (!response.ok) {
      if (response.status === 403) {
        alert('Access denied. This section is for employees only.');
        window.showPage('home');
        return;
      }
      throw new Error('Failed to load achievements');
    }

    const data = await response.json();
    const achievements = data.achievements || [];
    
    const tableBody = document.getElementById('achievementsTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = achievements.map(achievement => {
      const requirement = formatRequirement(achievement.requirement);
      
      return `
        <tr>
          <td class="achievement-icon-cell">${achievement.icon}</td>
          <td><strong>${achievement.name}</strong></td>
          <td>${achievement.description}</td>
          <td><span class="tier-badge tier-${achievement.tier}">${achievement.tier}</span></td>
          <td><span class="category-badge">${achievement.category}</span></td>
          <td>${requirement}</td>
          <td><strong>${achievement.points}</strong></td>
          <td><span class="earning-count">${achievement.earningCount || 0}</span></td>
        </tr>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading achievements table:', error);
    const tableBody = document.getElementById('achievementsTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: #e74c3c; padding: 20px;">
            Failed to load achievements. ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

async function loadLiveUsers() {
  try {
    const response = await fetch('/api/tools/live-users');
    
    if (!response.ok) {
      if (response.status === 403) {
        alert('Access denied. This section is for employees only.');
        window.showPage('home');
        return;
      }
      throw new Error('Failed to load live users');
    }

    const data = await response.json();
    updateLiveUsersTable(data.users || [], data.count || 0);
    
  } catch (error) {
    console.error('Error loading live users:', error);
    const tableBody = document.getElementById('liveUsersTableBody');
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: #e74c3c; padding: 20px;">
            Failed to load live users. ${error.message}
          </td>
        </tr>
      `;
    }
  }
}

function updateLiveUsersTable(users, count) {
  const tableBody = document.getElementById('liveUsersTableBody');
  const countBadge = document.getElementById('liveUserCount');
  
  if (countBadge) {
    countBadge.textContent = `${count} online`;
  }
  
  if (!tableBody) return;
  
  if (users.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: #999;">
          No active users at the moment
        </td>
      </tr>
    `;
    return;
  }
  
  tableBody.innerHTML = users.map(user => {
    const connectedTime = formatTimeAgo(user.connectedAt);
    const lastActivityTime = formatTimeAgo(user.lastActivity);
    const displayName = `${user.firstName} ${user.lastName}`;
    const pageIcon = getPageIcon(user.currentPage);
    
    return `
      <tr>
        <td><strong>${displayName}</strong></td>
        <td>${user.email}</td>
        <td>${pageIcon} ${formatPageName(user.currentPage)}</td>
        <td>${connectedTime}</td>
        <td>${lastActivityTime}</td>
        <td><code style="font-size: 11px; color: #666;">${user.socketId.substring(0, 8)}...</code></td>
      </tr>
    `;
  }).join('');
}

function getPageIcon(page) {
  const icons = {
    home: '🏠',
    rank: '⭐',
    products: '🥩',
    community: '👥',
    profile: '👤',
    tools: '🛠️'
  };
  return icons[page] || '📄';
}

function formatPageName(page) {
  const names = {
    home: 'Home',
    rank: 'Rankings',
    products: 'Products',
    community: 'Community',
    profile: 'Profile',
    tools: 'Tools'
  };
  return names[page] || page;
}

function formatTimeAgo(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const seconds = Math.floor((now - time) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatRequirement(requirement) {
  if (!requirement) return '-';
  
  const typeLabels = {
    rank_count: 'Rank Count',
    streak_days: 'Streak Days',
    unique_brands: 'Unique Brands',
    leaderboard_position: 'Leaderboard Position',
    profile_views: 'Profile Views',
    join_before: 'Join Before',
    trendsetter: 'Trending Ranks'
  };
  
  const typeLabel = typeLabels[requirement.type] || requirement.type;
  return `${typeLabel}: ${requirement.value}`;
}

function setupToolNavigation() {
  const toolBtns = document.querySelectorAll('.tools-nav-btn');
  
  toolBtns.forEach(btn => {
    btn.addEventListener('click', async function() {
      const tool = this.dataset.tool;
      
      toolBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      document.querySelectorAll('.tool-section').forEach(section => {
        section.style.display = 'none';
      });
      
      currentToolTab = tool;
      
      if (tool === 'achievements') {
        document.getElementById('achievementsTool').style.display = 'block';
        await loadAchievementsTable();
        
        if (liveUsersSubscribed && window.socket) {
          window.socket.emit('unsubscribe:live-users');
          liveUsersSubscribed = false;
        }
      } else if (tool === 'live-users') {
        document.getElementById('liveUsersTool').style.display = 'block';
        await loadLiveUsers();
        
        if (window.socket && !liveUsersSubscribed) {
          window.socket.emit('subscribe:live-users');
          liveUsersSubscribed = true;
        }
      }
    });
  });
}

// Initialize tools page when it's shown
window.initToolsPage = async function() {
  console.log('🛠️ Initializing Tools page...');
  
  const userRole = localStorage.getItem('userRole');
  if (userRole !== 'employee_admin') {
    alert('Access denied. This section is for employees only.');
    window.showPage('home');
    return;
  }
  
  setupToolNavigation();
  await loadAchievementsTable();
  
  if (window.socket) {
    window.socket.on('live-users:update', (data) => {
      if (currentToolTab === 'live-users') {
        updateLiveUsersTable(data.users || [], data.count || 0);
      }
    });
  }
};
