/**
 * Tools Page - Employee Admin Tools
 */

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

// Initialize tools page when it's shown
window.initToolsPage = async function() {
  console.log('🛠️ Initializing Tools page...');
  
  // Check if user has permission
  const userRole = localStorage.getItem('userRole');
  if (userRole !== 'employee_admin') {
    alert('Access denied. This section is for employees only.');
    window.showPage('home');
    return;
  }
  
  // Load achievements table by default
  await loadAchievementsTable();
};
