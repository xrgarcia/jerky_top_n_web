/**
 * Tools Admin - Achievement Management (Coin Book Admin Dashboard)
 */

let allAchievements = [];
let filteredAchievements = [];
let currentTypeFilter = 'all';
let editingAchievementId = null;

/**
 * Show toast notification
 */
function showToast({ type = 'info', icon = '🔔', title = '', message = '', duration = 5000 }) {
  const container = document.getElementById('toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      <div class="toast-message">${message}</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

/**
 * Load achievements from admin API
 */
async function loadAchievementsAdmin() {
  try {
    const response = await fetch('/api/admin/achievements');
    
    if (!response.ok) {
      if (response.status === 403) {
        sessionStorage.setItem('loginMessage', 'You do not have access to that page.');
        window.location.hash = '#login';
        window.showPage('login');
        return;
      }
      throw new Error('Failed to load achievements');
    }

    const data = await response.json();
    allAchievements = data.achievements || [];
    applyAchievementTypeFilter();
    
  } catch (error) {
    console.error('Error loading achievements:', error);
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

/**
 * Apply type filter to achievements
 */
function applyAchievementTypeFilter() {
  if (currentTypeFilter === 'all') {
    filteredAchievements = [...allAchievements];
  } else {
    filteredAchievements = allAchievements.filter(a => a.collectionType === currentTypeFilter);
  }
  
  renderAchievementsTable();
}

/**
 * Render achievements table
 */
function renderAchievementsTable() {
  const tableBody = document.getElementById('achievementsTableBody');
  if (!tableBody) return;
  
  if (filteredAchievements.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: #999;">
          No achievements found
        </td>
      </tr>
    `;
    return;
  }
  
  tableBody.innerHTML = filteredAchievements.map(achievement => {
    const collectionTypeLabel = getCollectionTypeLabel(achievement.collectionType);
    
    // Display protein categories or legacy category
    let categoryLabel = '-';
    if (achievement.proteinCategories && achievement.proteinCategories.length > 0) {
      categoryLabel = achievement.proteinCategories.join(', ');
    } else if (achievement.proteinCategory) {
      categoryLabel = achievement.proteinCategory;
    } else if (achievement.category) {
      categoryLabel = achievement.category;
    }
    
    const statusBadge = achievement.isActive === 1 
      ? '<span class="status-badge active">Active</span>' 
      : '<span class="status-badge inactive">Inactive</span>';
    
    // Display icon based on type
    let iconDisplay = achievement.icon;
    if (achievement.iconType === 'image') {
      iconDisplay = `<img src="${achievement.icon}" alt="Icon" style="width: 32px; height: 32px; object-fit: contain;">`;
    }
    
    return `
      <tr data-achievement-id="${achievement.id}">
        <td class="achievement-icon-cell">${iconDisplay}</td>
        <td><strong>${achievement.name}</strong><br><small>${achievement.code}</small></td>
        <td><span class="type-badge type-${achievement.collectionType.replace('_', '-')}">${collectionTypeLabel}</span></td>
        <td>${categoryLabel}</td>
        <td class="achievement-description">${achievement.description}</td>
        <td><strong>${achievement.points}</strong></td>
        <td>${statusBadge}</td>
        <td class="achievement-actions">
          <button class="btn-icon btn-edit" onclick="editAchievement(${achievement.id})" title="Edit">✏️</button>
          <button class="btn-icon btn-toggle" onclick="toggleAchievementStatus(${achievement.id})" title="Toggle Active/Inactive">
            ${achievement.isActive === 1 ? '👁️' : '🚫'}
          </button>
          <button class="btn-icon btn-delete" onclick="deleteAchievement(${achievement.id})" title="Delete">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Get human-readable collection type label
 */
function getCollectionTypeLabel(type) {
  const labels = {
    'static_collection': 'Static',
    'dynamic_collection': 'Dynamic',
    'hidden_collection': 'Hidden',
    'legacy': 'Legacy'
  };
  return labels[type] || type;
}

/**
 * Setup achievement type filter buttons
 */
function setupAchievementTypeFilters() {
  const filterBtns = document.querySelectorAll('.achievement-type-btn');
  
  filterBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      const type = this.dataset.type;
      
      filterBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      currentTypeFilter = type === 'all' ? 'all' : 
        type === 'static' ? 'static_collection' :
        type === 'dynamic' ? 'dynamic_collection' :
        type === 'hidden' ? 'hidden_collection' :
        'legacy';
      
      applyAchievementTypeFilter();
    });
  });
}

/**
 * Show achievement form modal for creating or editing
 */
window.showAchievementForm = function(achievementId = null) {
  const modal = document.getElementById('achievementFormModal');
  const form = document.getElementById('achievementForm');
  const title = document.getElementById('achievementFormTitle');
  
  editingAchievementId = achievementId;
  
  if (achievementId) {
    // Edit mode
    title.textContent = 'Edit Achievement';
    const achievement = allAchievements.find(a => a.id === achievementId);
    if (achievement) {
      populateAchievementForm(achievement);
    }
  } else {
    // Create mode
    title.textContent = 'Create Achievement';
    form.reset();
    document.getElementById('achievementId').value = '';
    document.getElementById('achievementCode').readOnly = false; // Ensure code field is editable for new achievements
    
    // Reset icon type to emoji (default)
    document.getElementById('iconTypeEmoji').checked = true;
    document.getElementById('emojiIconSection').style.display = 'block';
    document.getElementById('imageIconSection').style.display = 'none';
    document.getElementById('achievementIcon').required = true;
    clearIconPreview();
    
    // Reset requirement fields
    document.getElementById('requirementType').value = '';
    document.getElementById('rankCountValue').value = '';
    document.getElementById('animalCategoryCount').value = '';
    document.getElementById('searchCountValue').value = '';
    document.getElementById('streakDaysValue').value = '';
    document.querySelectorAll('input[name="requiredFlavors"]').forEach(checkbox => {
      checkbox.checked = false;
    });
    document.querySelectorAll('input[name="proteinCategories"]').forEach(checkbox => {
      checkbox.checked = false;
    });
    
    // Reset tier threshold fields to defaults
    document.getElementById('tierBronze').value = 40;
    document.getElementById('tierSilver').value = 60;
    document.getElementById('tierGold').value = 75;
    document.getElementById('tierPlatinum').value = 90;
    document.getElementById('tierDiamond').value = 100;
    
    updateFormFieldsVisibility();
    updateRequirementFieldsVisibility();
  }
  
  modal.style.display = 'flex';
};

/**
 * Populate form with achievement data
 */
function populateAchievementForm(achievement) {
  document.getElementById('achievementId').value = achievement.id;
  document.getElementById('achievementCode').value = achievement.code;
  document.getElementById('achievementCode').readOnly = true; // Can't change code when editing
  document.getElementById('achievementName').value = achievement.name;
  document.getElementById('achievementDescription').value = achievement.description;
  document.getElementById('achievementPoints').value = achievement.points;
  document.getElementById('achievementIsActive').value = achievement.isActive;
  document.getElementById('achievementCollectionType').value = achievement.collectionType;
  
  // Handle multi-select protein categories
  const proteinCategories = achievement.proteinCategories || (achievement.proteinCategory ? [achievement.proteinCategory] : []);
  document.querySelectorAll('input[name="proteinCategories"]').forEach(checkbox => {
    checkbox.checked = proteinCategories.includes(checkbox.value);
  });
  
  document.getElementById('achievementTier').value = achievement.tier || '';
  document.getElementById('achievementCategory').value = achievement.category || '';
  document.getElementById('achievementIsHidden').checked = achievement.isHidden === 1;
  
  // Handle icon type
  const iconType = achievement.iconType || 'emoji';
  const emojiRadio = document.getElementById('iconTypeEmoji');
  const imageRadio = document.getElementById('iconTypeImage');
  const emojiSection = document.getElementById('emojiIconSection');
  const imageSection = document.getElementById('imageIconSection');
  
  if (iconType === 'emoji') {
    emojiRadio.checked = true;
    emojiSection.style.display = 'block';
    imageSection.style.display = 'none';
    document.getElementById('achievementIcon').value = achievement.icon;
    document.getElementById('achievementIcon').required = true;
  } else {
    imageRadio.checked = true;
    emojiSection.style.display = 'none';
    imageSection.style.display = 'block';
    document.getElementById('achievementIcon').required = false;
    document.getElementById('customIconPath').value = achievement.icon;
    
    // Show preview of existing image
    const preview = document.getElementById('iconPreview');
    const previewImg = document.getElementById('iconPreviewImg');
    previewImg.src = achievement.icon;
    preview.style.display = 'block';
  }
  
  // Parse and populate requirement fields
  if (achievement.requirement) {
    const req = achievement.requirement;
    
    // Skip requirement population for dynamic collections (auto-generated)
    if (req.type === 'complete_protein_category_percentage') {
      // Dynamic collection - requirements are automatic, don't populate dropdown
      document.getElementById('requirementType').value = '';
    } else {
      // Other achievement types - populate manual requirements
      document.getElementById('requirementType').value = req.type || '';
      
      // Populate specific requirement inputs based on type
      if (req.type === 'rank_count') {
        document.getElementById('rankCountValue').value = req.value || '';
      } else if (req.type === 'complete_animal_category') {
        document.getElementById('animalCategoryCount').value = req.value || '';
      } else if (req.type === 'complete_flavor_set' && req.flavors) {
        document.querySelectorAll('input[name="requiredFlavors"]').forEach(checkbox => {
          checkbox.checked = req.flavors.includes(checkbox.value);
        });
      } else if (req.type === 'search_count') {
        document.getElementById('searchCountValue').value = req.value || '';
      } else if (req.type === 'daily_login_streak' || req.type === 'daily_rank_streak') {
        document.getElementById('streakDaysValue').value = req.days || '';
      }
    }
  }
  
  // Populate tier thresholds
  if (achievement.tierThresholds) {
    const thresholds = achievement.tierThresholds;
    document.getElementById('tierBronze').value = thresholds.bronze || 40;
    document.getElementById('tierSilver').value = thresholds.silver || 60;
    document.getElementById('tierGold').value = thresholds.gold || 75;
    document.getElementById('tierPlatinum').value = thresholds.platinum || 90;
    document.getElementById('tierDiamond').value = thresholds.diamond || 100;
  }
  
  updateFormFieldsVisibility();
  updateRequirementFieldsVisibility();
}

/**
 * Update form fields visibility based on collection type
 */
function updateFormFieldsVisibility() {
  const collectionType = document.getElementById('achievementCollectionType').value;
  
  const proteinGroup = document.getElementById('proteinCategoryGroup');
  const tierThresholdsSection = document.getElementById('tierThresholdsSection');
  const unlockRequirementsSection = document.getElementById('unlockRequirementsSection');
  const legacyFieldsGroup = document.getElementById('legacyFieldsGroup');
  const legacyCategoryGroup = document.getElementById('legacyCategoryGroup');
  
  // Hide all conditional fields first
  proteinGroup.style.display = 'none';
  tierThresholdsSection.style.display = 'none';
  unlockRequirementsSection.style.display = 'none';
  legacyFieldsGroup.style.display = 'none';
  legacyCategoryGroup.style.display = 'none';
  
  // Show relevant fields based on collection type
  if (collectionType === 'dynamic_collection') {
    // Dynamic collections use protein categories + tier thresholds
    proteinGroup.style.display = 'block';
    tierThresholdsSection.style.display = 'block';
    // Hide unlock requirements - they're automatic for dynamic collections
    unlockRequirementsSection.style.display = 'none';
  } else if (collectionType === 'static_collection' || collectionType === 'hidden_collection') {
    // Static and hidden collections need manual unlock requirements
    unlockRequirementsSection.style.display = 'block';
  } else if (collectionType === 'legacy') {
    legacyFieldsGroup.style.display = 'block';
    legacyCategoryGroup.style.display = 'block';
    unlockRequirementsSection.style.display = 'block';
  }
}

/**
 * Update requirement fields visibility based on requirement type
 */
function updateRequirementFieldsVisibility() {
  const requirementType = document.getElementById('requirementType').value;
  
  // Hide all requirement input groups
  document.getElementById('rankCountGroup').style.display = 'none';
  document.getElementById('animalCategoryCountGroup').style.display = 'none';
  document.getElementById('flavorSetGroup').style.display = 'none';
  document.getElementById('searchCountGroup').style.display = 'none';
  document.getElementById('streakDaysGroup').style.display = 'none';
  
  // Show relevant group based on selection
  switch(requirementType) {
    case 'rank_count':
      document.getElementById('rankCountGroup').style.display = 'block';
      break;
    case 'complete_animal_category':
      document.getElementById('animalCategoryCountGroup').style.display = 'block';
      break;
    case 'complete_flavor_set':
      document.getElementById('flavorSetGroup').style.display = 'block';
      break;
    case 'search_count':
      document.getElementById('searchCountGroup').style.display = 'block';
      break;
    case 'daily_login_streak':
    case 'daily_rank_streak':
      document.getElementById('streakDaysGroup').style.display = 'block';
      break;
  }
}

/**
 * Close achievement form modal
 */
window.closeAchievementForm = function() {
  const modal = document.getElementById('achievementFormModal');
  modal.style.display = 'none';
  editingAchievementId = null;
  document.getElementById('achievementCode').readOnly = false;
  
  // Reset icon type selector
  document.getElementById('iconTypeEmoji').checked = true;
  document.getElementById('emojiIconSection').style.display = 'block';
  document.getElementById('imageIconSection').style.display = 'none';
  document.getElementById('achievementIcon').required = true;
  clearIconPreview();
};

/**
 * Handle achievement form submission
 */
async function handleAchievementFormSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  // Handle icon type and path - explicitly check radio button state
  const iconType = document.getElementById('iconTypeImage').checked ? 'image' : 'emoji';
  let iconValue = '';
  
  if (iconType === 'emoji') {
    iconValue = formData.get('icon');
    if (!iconValue) {
      showToast({
        type: 'warning',
        icon: '⚠️',
        title: 'Missing Icon',
        message: 'Please enter an emoji icon',
        duration: 5000
      });
      return;
    }
  } else {
    iconValue = formData.get('customIconPath');
    if (!iconValue) {
      showToast({
        type: 'warning',
        icon: '⚠️',
        title: 'Missing Icon',
        message: 'Please upload a custom icon or switch to emoji mode',
        duration: 5000
      });
      return;
    }
  }
  
  // Build achievement object
  const achievementData = {
    code: formData.get('code'),
    name: formData.get('name'),
    description: formData.get('description'),
    icon: iconValue,
    iconType: iconType,
    collectionType: formData.get('collectionType'),
    points: parseInt(formData.get('points')) || 0,
    isActive: parseInt(formData.get('isActive')),
    isHidden: formData.get('isHidden') ? 1 : 0,
  };
  
  // Collect selected protein categories as array
  const selectedCategories = [];
  document.querySelectorAll('input[name="proteinCategories"]:checked').forEach(checkbox => {
    selectedCategories.push(checkbox.value);
  });
  if (selectedCategories.length > 0) {
    achievementData.proteinCategories = selectedCategories;
  }
  
  // Optional fields
  if (formData.get('tier')) {
    achievementData.tier = formData.get('tier');
  }
  if (formData.get('category')) {
    achievementData.category = formData.get('category');
  }
  
  // Build requirement object from user-friendly inputs
  let requirement;
  
  // Dynamic collections have automatic requirements based on protein categories
  if (achievementData.collectionType === 'dynamic_collection') {
    const selectedCategories = achievementData.proteinCategories || [];
    if (selectedCategories.length === 0) {
      showToast({
        type: 'warning',
        icon: '⚠️',
        title: 'Missing Categories',
        message: 'Please select at least one protein category for this Dynamic Collection',
        duration: 5000
      });
      return;
    }
    
    // Auto-generate requirement for dynamic collections
    requirement = {
      type: 'complete_protein_category_percentage',
      categories: selectedCategories
    };
  } else {
    // Other collection types need manual requirement selection
    const requirementType = document.getElementById('requirementType').value;
    if (!requirementType) {
      showToast({
        type: 'warning',
        icon: '⚠️',
        title: 'Missing Requirement',
        message: 'Please select a requirement type',
        duration: 5000
      });
      return;
    }
    
    requirement = { type: requirementType };
  
    // Only process requirement details for non-dynamic collections
    switch(requirementType) {
      case 'rank_count':
        const rankCount = parseInt(document.getElementById('rankCountValue').value);
        if (!rankCount || rankCount < 1) {
          showToast({
            type: 'warning',
            icon: '⚠️',
            title: 'Invalid Value',
            message: 'Please enter a valid number of products to rank',
            duration: 5000
          });
          return;
        }
        requirement.value = rankCount;
        break;
        
      case 'complete_animal_category':
        const categoryCount = parseInt(document.getElementById('animalCategoryCount').value);
        if (!categoryCount || categoryCount < 1) {
          showToast({
            type: 'warning',
            icon: '⚠️',
            title: 'Invalid Value',
            message: 'Please enter a valid number of categories',
            duration: 5000
          });
          return;
        }
        requirement.value = categoryCount;
        break;
        
      case 'complete_flavor_set':
        const selectedFlavors = [];
        document.querySelectorAll('input[name="requiredFlavors"]:checked').forEach(checkbox => {
          selectedFlavors.push(checkbox.value);
        });
        if (selectedFlavors.length === 0) {
          showToast({
            type: 'warning',
            icon: '⚠️',
            title: 'No Flavors Selected',
            message: 'Please select at least one flavor',
            duration: 5000
          });
          return;
        }
        requirement.flavors = selectedFlavors;
        break;
        
      case 'search_count':
        const searchCount = parseInt(document.getElementById('searchCountValue').value);
        if (!searchCount || searchCount < 1) {
          showToast({
            type: 'warning',
            icon: '⚠️',
            title: 'Invalid Value',
            message: 'Please enter a valid number of searches',
            duration: 5000
          });
          return;
        }
        requirement.value = searchCount;
        break;
        
      case 'daily_login_streak':
      case 'daily_rank_streak':
        const streakDays = parseInt(document.getElementById('streakDaysValue').value);
        if (!streakDays || streakDays < 1) {
          showToast({
            type: 'warning',
            icon: '⚠️',
            title: 'Invalid Value',
            message: 'Please enter a valid number of days',
            duration: 5000
          });
          return;
        }
        requirement.days = streakDays;
        break;
    }
  }
  
  achievementData.requirement = requirement;
  
  // Build tier thresholds object for dynamic collections
  if (achievementData.collectionType === 'dynamic_collection') {
    achievementData.tierThresholds = {
      bronze: parseInt(document.getElementById('tierBronze').value) || 40,
      silver: parseInt(document.getElementById('tierSilver').value) || 60,
      gold: parseInt(document.getElementById('tierGold').value) || 75,
      platinum: parseInt(document.getElementById('tierPlatinum').value) || 90,
      diamond: parseInt(document.getElementById('tierDiamond').value) || 100
    };
  }
  
  try {
    let response;
    if (editingAchievementId) {
      // Update existing achievement
      response = await fetch(`/api/admin/achievements/${editingAchievementId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(achievementData)
      });
    } else {
      // Create new achievement
      response = await fetch('/api/admin/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(achievementData)
      });
    }
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save achievement');
    }
    
    const result = await response.json();
    console.log('Achievement saved:', result);
    
    // Reload achievements
    await loadAchievementsAdmin();
    
    // Show success toast notification
    showToast({
      type: 'success',
      icon: '✅',
      title: 'Success!',
      message: `Achievement ${editingAchievementId ? 'updated' : 'created'} successfully!`,
      duration: 5000
    });
    
    // Close modal on success
    closeAchievementForm();
    
  } catch (error) {
    console.error('Error saving achievement:', error);
    
    // Show error toast but keep modal open
    showToast({
      type: 'error',
      icon: '❌',
      title: 'Error',
      message: `Failed to save achievement: ${error.message}`,
      duration: 7000
    });
  }
}

/**
 * Edit achievement
 */
window.editAchievement = function(achievementId) {
  showAchievementForm(achievementId);
};

/**
 * Toggle achievement active status
 */
window.toggleAchievementStatus = async function(achievementId) {
  try {
    const response = await fetch(`/api/admin/achievements/${achievementId}/toggle`, {
      method: 'PATCH'
    });
    
    if (!response.ok) {
      throw new Error('Failed to toggle achievement status');
    }
    
    await loadAchievementsAdmin();
    console.log('Achievement status toggled successfully');
    
  } catch (error) {
    console.error('Error toggling achievement status:', error);
    showToast({
      type: 'error',
      icon: '❌',
      title: 'Error',
      message: `Failed to toggle achievement status: ${error.message}`,
      duration: 7000
    });
  }
};

/**
 * Delete achievement
 */
window.deleteAchievement = function(achievementId) {
  const achievement = allAchievements.find(a => a.id === achievementId);
  if (!achievement) return;
  
  showConfirmationModal(
    'Delete Achievement',
    `Are you sure you want to delete "${achievement.name}"? This action cannot be undone.`,
    async () => {
      try {
        const response = await fetch(`/api/admin/achievements/${achievementId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          throw new Error('Failed to delete achievement');
        }
        
        await loadAchievementsAdmin();
        showToast({
          type: 'success',
          icon: '✅',
          title: 'Deleted',
          message: 'Achievement deleted successfully!',
          duration: 5000
        });
        
      } catch (error) {
        console.error('Error deleting achievement:', error);
        showToast({
          type: 'error',
          icon: '❌',
          title: 'Error',
          message: `Failed to delete achievement: ${error.message}`,
          duration: 7000
        });
      }
    }
  );
};

/**
 * Handle icon type switching (emoji vs custom image)
 */
function setupIconTypeHandler() {
  const emojiRadio = document.getElementById('iconTypeEmoji');
  const imageRadio = document.getElementById('iconTypeImage');
  const emojiSection = document.getElementById('emojiIconSection');
  const imageSection = document.getElementById('imageIconSection');
  
  emojiRadio.addEventListener('change', () => {
    if (emojiRadio.checked) {
      emojiSection.style.display = 'block';
      imageSection.style.display = 'none';
      document.getElementById('achievementIcon').required = true;
    }
  });
  
  imageRadio.addEventListener('change', () => {
    if (imageRadio.checked) {
      emojiSection.style.display = 'none';
      imageSection.style.display = 'block';
      document.getElementById('achievementIcon').required = false;
    }
  });
}

/**
 * Setup custom icon upload handler
 */
function setupIconUploadHandler() {
  const uploadBtn = document.getElementById('uploadIconBtn');
  const fileInput = document.getElementById('customIconUpload');
  const removeBtn = document.getElementById('removeIconBtn');
  
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    await handleIconFileUpload(file);
  });
  
  removeBtn.addEventListener('click', () => {
    clearIconPreview();
    fileInput.value = '';
  });
}

/**
 * Validate and upload icon file
 */
async function handleIconFileUpload(file) {
  const statusDiv = document.getElementById('iconUploadStatus');
  const preview = document.getElementById('iconPreview');
  const previewImg = document.getElementById('iconPreviewImg');
  const customIconPath = document.getElementById('customIconPath');
  
  statusDiv.className = 'icon-upload-status';
  statusDiv.textContent = '';
  
  const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    statusDiv.className = 'icon-upload-status error';
    statusDiv.textContent = 'Error: Only PNG, JPG, and WebP formats are allowed.';
    return;
  }
  
  if (file.size > 500 * 1024) {
    statusDiv.className = 'icon-upload-status error';
    statusDiv.textContent = 'Error: File size must be less than 500KB.';
    return;
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = function(e) {
      img.src = e.target.result;
      
      img.onload = async function() {
        if (img.width !== 128 || img.height !== 128) {
          statusDiv.className = 'icon-upload-status error';
          statusDiv.textContent = `Error: Image must be exactly 128x128 pixels (got ${img.width}x${img.height}).`;
          resolve();
          return;
        }
        
        statusDiv.className = 'icon-upload-status uploading';
        statusDiv.textContent = 'Uploading...';
        
        try {
          // Create FormData and upload directly to server
          const formData = new FormData();
          formData.append('icon', file);
          
          const uploadResponse = await fetch('/api/admin/achievements/upload-icon', {
            method: 'POST',
            body: formData
          });
          
          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || 'Failed to upload file');
          }
          
          const { objectPath } = await uploadResponse.json();
          
          // Set the path and show preview
          customIconPath.value = objectPath;
          previewImg.src = e.target.result;
          preview.style.display = 'block';
          
          statusDiv.className = 'icon-upload-status success';
          statusDiv.textContent = '✓ Icon uploaded successfully!';
          
        } catch (error) {
          console.error('Upload error:', error);
          statusDiv.className = 'icon-upload-status error';
          statusDiv.textContent = `Error: ${error.message}`;
        }
        
        resolve();
      };
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Clear icon preview
 */
function clearIconPreview() {
  const preview = document.getElementById('iconPreview');
  const previewImg = document.getElementById('iconPreviewImg');
  const customIconPath = document.getElementById('customIconPath');
  const statusDiv = document.getElementById('iconUploadStatus');
  
  preview.style.display = 'none';
  previewImg.src = '';
  customIconPath.value = '';
  statusDiv.className = 'icon-upload-status';
  statusDiv.textContent = '';
}

/**
 * Initialize achievement admin UI
 */
window.initAchievementAdmin = function() {
  // Setup type filter buttons
  setupAchievementTypeFilters();
  
  // Setup create button
  const createBtn = document.getElementById('createAchievementBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => showAchievementForm());
  }
  
  // Setup form handlers
  const form = document.getElementById('achievementForm');
  if (form) {
    form.addEventListener('submit', handleAchievementFormSubmit);
  }
  
  const closeBtn = document.getElementById('closeAchievementFormBtn');
  const cancelBtn = document.getElementById('cancelAchievementFormBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeAchievementForm);
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeAchievementForm);
  }
  
  // Setup collection type change handler
  const collectionTypeSelect = document.getElementById('achievementCollectionType');
  if (collectionTypeSelect) {
    collectionTypeSelect.addEventListener('change', updateFormFieldsVisibility);
  }
  
  // Setup requirement type change handler
  const requirementTypeSelect = document.getElementById('requirementType');
  if (requirementTypeSelect) {
    requirementTypeSelect.addEventListener('change', updateRequirementFieldsVisibility);
  }
  
  // Setup icon type and upload handlers
  setupIconTypeHandler();
  setupIconUploadHandler();
  
  // Load achievements
  loadAchievementsAdmin();
};
