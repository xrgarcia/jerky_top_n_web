import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import './EditCoinModal.css';

function EditCoinModal({ coin, isOpen, onClose, onSave, allCoins = [], allProducts = [] }) {
  const isEditMode = !!coin;
  
  // Form state - Basic Information
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(100);
  const [isActive, setIsActive] = useState(1);
  
  // Icon state
  const [iconType, setIconType] = useState('emoji');
  const [icon, setIcon] = useState('🏆');
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  
  // Collection Type state
  const [collectionType, setCollectionType] = useState('engagement_collection');
  const [category, setCategory] = useState('');
  const [isHidden, setIsHidden] = useState(0);
  const [prerequisiteAchievementId, setPrerequisiteAchievementId] = useState(null);
  
  // Product selection state (for collection types)
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  
  // Tier configuration state
  const [hasTiers, setHasTiers] = useState(0);
  const [tierThresholds, setTierThresholds] = useState({
    bronze: 40,
    silver: 60,
    gold: 75,
    platinum: 90,
    diamond: 100
  });
  
  // Protein category state (for flavor coins)
  const [proteinCategories, setProteinCategories] = useState([]);
  
  // Dynamic collection state
  const [dynamicCollectionType, setDynamicCollectionType] = useState('complete_collection');
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedAnimals, setSelectedAnimals] = useState([]);
  
  // Engagement collection state
  const [engagementType, setEngagementType] = useState('');
  const [engagementValue, setEngagementValue] = useState('');
  
  // Requirement state
  const [requirement, setRequirement] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initialize form when coin changes
  useEffect(() => {
    if (coin) {
      setCode(coin.code || '');
      setName(coin.name || '');
      setDescription(coin.description || '');
      setPoints(coin.points || 100);
      setIsActive(coin.isActive !== undefined ? coin.isActive : 1);
      
      setIconType(coin.iconType || 'emoji');
      setIcon(coin.icon || '🏆');
      if (coin.iconType === 'image' && coin.icon) {
        setIconPreview(coin.icon);
      }
      
      setCollectionType(coin.collectionType || 'engagement_collection');
      setCategory(coin.category || '');
      setIsHidden(coin.isHidden || 0);
      setPrerequisiteAchievementId(coin.prerequisiteAchievementId || null);
      
      setHasTiers(coin.hasTiers || 0);
      if (coin.tierThresholds) {
        setTierThresholds(coin.tierThresholds);
      }
      
      setRequirement(coin.requirement || '');
      
      if (coin.proteinCategories) {
        setProteinCategories(coin.proteinCategories);
      }
      
      // Parse requirement for product IDs if it's a collection type
      if (coin.requirement && isCollectionType(coin.collectionType)) {
        try {
          // Requirement is already parsed as an object from the API (jsonb field)
          const req = typeof coin.requirement === 'string' 
            ? JSON.parse(coin.requirement) 
            : coin.requirement;
          
          // Handle static collections (with productIds)
          if (req.productIds && Array.isArray(req.productIds)) {
            // Product IDs in DB are strings, ensure they stay strings for comparison
            const productIds = req.productIds.map(id => String(id));
            setSelectedProductIds(productIds);
          }
          
          // Handle dynamic collections
          if (coin.collectionType === 'dynamic_collection') {
            if (req.type === 'complete_collection') {
              setDynamicCollectionType('complete_collection');
            } else if (req.type === 'brand_collection' && req.brands) {
              setDynamicCollectionType('brand_collection');
              setSelectedBrands(req.brands);
            } else if (req.type === 'animal_collection' && req.animals) {
              setDynamicCollectionType('animal_collection');
              setSelectedAnimals(req.animals);
            }
          }
          
          // Handle engagement collections
          if (coin.collectionType === 'engagement_collection') {
            if (req.type) {
              setEngagementType(req.type);
              setEngagementValue(req.value || '');
            }
          }
        } catch (e) {
          console.error('Error parsing coin requirement:', e);
        }
      }
    } else {
      // Reset for create mode
      resetForm();
    }
  }, [coin]);
  
  const resetForm = () => {
    setCode('');
    setName('');
    setDescription('');
    setPoints(100);
    setIsActive(1);
    setIconType('emoji');
    setIcon('🏆');
    setIconFile(null);
    setIconPreview(null);
    setCollectionType('engagement_collection');
    setCategory('');
    setIsHidden(0);
    setPrerequisiteAchievementId(null);
    setSelectedProductIds([]);
    setProductSearchQuery('');
    setDynamicCollectionType('complete_collection');
    setSelectedBrands([]);
    setSelectedAnimals([]);
    setEngagementType('');
    setEngagementValue('');
    setHasTiers(0);
    setTierThresholds({ bronze: 40, silver: 60, gold: 75, platinum: 90, diamond: 100 });
    setProteinCategories([]);
    setRequirement('');
  };
  
  // Helper to check if product selector should show (static collections only)
  const shouldShowProductSelector = (type) => {
    return ['static_collection', 'legacy', 'flavor_coin'].includes(type);
  };
  
  // Helper to check if this is any collection type
  const isCollectionType = (type) => {
    return ['engagement_collection', 'static_collection', 'dynamic_collection', 'legacy', 'flavor_coin'].includes(type);
  };
  
  // Handle icon file upload
  const handleIconFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only PNG, JPG, and WebP are allowed.');
      return;
    }
    
    // Validate file size (500KB max)
    if (file.size > 500 * 1024) {
      toast.error('File size must be less than 500KB');
      return;
    }
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setIconPreview(reader.result);
    };
    reader.readAsDataURL(file);
    
    setIconFile(file);
  };
  
  const handleRemoveIcon = () => {
    setIconFile(null);
    setIconPreview(null);
    setIcon('');
  };
  
  // Extract unique brands and animals from products
  const availableBrands = useMemo(() => {
    const brandMap = new Map();
    allProducts.forEach(product => {
      if (product.vendor) {
        const count = brandMap.get(product.vendor) || 0;
        brandMap.set(product.vendor, count + 1);
      }
    });
    return Array.from(brandMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allProducts]);
  
  const availableAnimals = useMemo(() => {
    const animalMap = new Map();
    allProducts.forEach(product => {
      if (product.animalDisplay) {
        const count = animalMap.get(product.animalDisplay) || 0;
        animalMap.set(product.animalDisplay, count + 1);
      }
    });
    return Array.from(animalMap.entries())
      .map(([name, count]) => ({ 
        name, 
        count,
        // Try to get emoji from first product with this animal
        emoji: allProducts.find(p => p.animalDisplay === name)?.animalIcon || '🥩'
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allProducts]);
  
  // Product selection helpers
  const availableProducts = useMemo(() => {
    // Convert product IDs to strings for comparison
    const selectedIdsAsStrings = selectedProductIds.map(id => String(id));
    
    if (!productSearchQuery) {
      return allProducts.filter(p => !selectedIdsAsStrings.includes(String(p.id)));
    }
    
    const query = productSearchQuery.toLowerCase();
    return allProducts.filter(p => 
      !selectedIdsAsStrings.includes(String(p.id)) &&
      (p.title?.toLowerCase().includes(query) || 
       p.vendor?.toLowerCase().includes(query))
    );
  }, [allProducts, selectedProductIds, productSearchQuery]);
  
  const selectedProducts = useMemo(() => {
    const selectedIdsAsStrings = selectedProductIds.map(id => String(id));
    return allProducts.filter(p => selectedIdsAsStrings.includes(String(p.id)));
  }, [allProducts, selectedProductIds]);
  
  // Check if adding more products is allowed
  const canAddMoreProducts = useMemo(() => {
    if (collectionType === 'flavor_coin') {
      return selectedProductIds.length < 1;
    }
    return true;
  }, [collectionType, selectedProductIds.length]);
  
  const handleAddProduct = (productId) => {
    // For flavor coins, limit to 1 product
    if (collectionType === 'flavor_coin' && selectedProductIds.length >= 1) {
      toast.error('Flavor coins can only have one product');
      return;
    }
    // Store as string to match database format
    setSelectedProductIds([...selectedProductIds, String(productId)]);
  };
  
  const handleRemoveProduct = (productId) => {
    setSelectedProductIds(selectedProductIds.filter(id => String(id) !== String(productId)));
  };
  
  // Brand/Animal selection handlers
  const handleToggleBrand = (brandName) => {
    setSelectedBrands(prev => 
      prev.includes(brandName)
        ? prev.filter(b => b !== brandName)
        : [...prev, brandName]
    );
  };
  
  const handleToggleAnimal = (animalName) => {
    setSelectedAnimals(prev =>
      prev.includes(animalName)
        ? prev.filter(a => a !== animalName)
        : [...prev, animalName]
    );
  };
  
  // Validate form
  const validateForm = () => {
    if (!code.trim()) {
      toast.error('Code is required');
      return false;
    }
    
    if (!name.trim()) {
      toast.error('Name is required');
      return false;
    }
    
    if (!description.trim()) {
      toast.error('Description is required');
      return false;
    }
    
    if (iconType === 'emoji' && !icon.trim()) {
      toast.error('Icon emoji is required');
      return false;
    }
    
    if (iconType === 'image' && !iconPreview) {
      toast.error('Icon image is required');
      return false;
    }
    
    if (!collectionType) {
      toast.error('Coin type is required');
      return false;
    }
    
    // Validate tier percentages if tiers are enabled
    if (hasTiers) {
      const values = Object.values(tierThresholds);
      for (let val of values) {
        if (val < 0 || val > 100) {
          toast.error('Tier percentages must be between 0 and 100');
          return false;
        }
      }
    }
    
    // Validate engagement collection requirements
    if (collectionType === 'engagement_collection') {
      if (!engagementType) {
        toast.error('Please select how users earn this engagement coin');
        return false;
      }
      if (!engagementValue || parseInt(engagementValue) <= 0) {
        toast.error('Please enter a valid requirement value (greater than 0)');
        return false;
      }
    }
    
    // Validate dynamic collection requirements
    if (collectionType === 'dynamic_collection') {
      if (dynamicCollectionType === 'brand_collection' && selectedBrands.length === 0) {
        toast.error('Please select at least one brand for this dynamic collection');
        return false;
      }
      if (dynamicCollectionType === 'animal_collection' && selectedAnimals.length === 0) {
        toast.error('Please select at least one animal category for this dynamic collection');
        return false;
      }
    }
    
    return true;
  };
  
  // Build requirement object based on coin type
  const buildRequirement = () => {
    // Engagement collections
    if (collectionType === 'engagement_collection') {
      return JSON.stringify({
        type: engagementType,
        value: parseInt(engagementValue) || 0
      });
    }
    
    // Dynamic collections
    if (collectionType === 'dynamic_collection') {
      if (dynamicCollectionType === 'complete_collection') {
        return JSON.stringify({ type: 'complete_collection' });
      } else if (dynamicCollectionType === 'brand_collection') {
        return JSON.stringify({ 
          type: 'brand_collection', 
          brands: selectedBrands 
        });
      } else if (dynamicCollectionType === 'animal_collection') {
        return JSON.stringify({ 
          type: 'animal_collection', 
          animals: selectedAnimals 
        });
      }
    }
    
    // Static collections and flavor coins (with product IDs)
    if (shouldShowProductSelector(collectionType)) {
      return JSON.stringify({
        type: collectionType === 'flavor_coin' ? 'flavor_coin' : 'static_collection',
        productIds: selectedProductIds,
        requiredCount: selectedProductIds.length
      });
    }
    
    // For engagement coins, just return a simple requirement
    return requirement || JSON.stringify({ type: 'engagement' });
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const formData = {
        code: isEditMode ? undefined : code, // Code only for create
        name,
        description,
        icon: iconType === 'emoji' ? icon : iconPreview,
        iconType,
        points: parseInt(points),
        isActive,
        collectionType,
        category: category || null,
        isHidden,
        prerequisiteAchievementId: prerequisiteAchievementId || null,
        requirement: buildRequirement(),
        hasTiers: hasTiers ? 1 : 0,
        tierThresholds: hasTiers ? tierThresholds : null,
        proteinCategories: proteinCategories.length > 0 ? proteinCategories : null
      };
      
      await onSave(formData, iconFile);
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to save coin');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-coin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Coin' : 'Create Coin'}</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="modal-body">
          {/* STEP 1: BASIC IDENTITY */}
          <section className="form-section">
            <h3 className="section-title">1. BASIC INFORMATION</h3>
            
            <div className="form-group">
              <label>Code (unique identifier)*</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., original_master"
                disabled={isEditMode}
                className="form-input"
              />
              {isEditMode && <p className="form-hint">Code cannot be changed after creation</p>}
            </div>
            
            <div className="form-group">
              <label>Name*</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Original Master"
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label>Description*</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe how users earn this achievement..."
                className="form-textarea"
                rows={3}
              />
            </div>
          </section>
          
          {/* STEP 2: ICON */}
          <section className="form-section">
            <h3 className="section-title">2. ICON</h3>
            
            <div className="form-group">
              <label>Icon Type*</label>
              <div className="icon-type-selector">
                <label className="radio-label">
                  <input
                    type="radio"
                    checked={iconType === 'emoji'}
                    onChange={() => {
                      setIconType('emoji');
                      handleRemoveIcon();
                    }}
                  />
                  Emoji
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    checked={iconType === 'image'}
                    onChange={() => setIconType('image')}
                  />
                  Custom Image
                </label>
              </div>
              
              {iconType === 'emoji' ? (
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="🏆"
                  className="form-input emoji-input"
                  maxLength={2}
                />
              ) : (
                <div className="image-upload-section">
                  <label className="image-upload-btn">
                    📁 Choose Image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleIconFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                  
                  {iconPreview && (
                    <div className="image-preview-container">
                      <img src={iconPreview} alt="Icon preview" className="icon-preview" />
                      <button
                        className="remove-icon-btn"
                        onClick={handleRemoveIcon}
                        type="button"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  
                  <div className="image-requirements">
                    <strong>Requirements:</strong> PNG, JPG, or WebP • 128x128 pixels (square) • Max 500KB
                    <br />
                    <em>Transparent PNG recommended for best results</em>
                  </div>
                </div>
              )}
            </div>
          </section>
          
          {/* STEP 3: COIN TYPE & REQUIREMENTS */}
          <section className="form-section">
            <h3 className="section-title">3. COIN TYPE</h3>
            
            <div className="form-group">
              <label>Type*</label>
              <select
                value={collectionType}
                onChange={(e) => setCollectionType(e.target.value)}
                className="form-select"
              >
                <option value="engagement_collection">Engagement Coin</option>
                <option value="static_collection">Static Collection Coin</option>
                <option value="dynamic_collection">Dynamic Collection Coin</option>
                <option value="flavor_coin">Flavor Coin</option>
                <option value="legacy">Pre-Defined List of Products (Legacy)</option>
              </select>
              <p className="form-hint">
                {collectionType === 'engagement_collection' && 'Awarded for user actions like rankings, searches, streaks, etc.'}
                {collectionType === 'static_collection' && 'Users earn tiers by ranking products from a custom-selected list'}
                {collectionType === 'dynamic_collection' && 'Auto-updates based on criteria like brand, animal, or all products'}
                {collectionType === 'flavor_coin' && 'Single product achievement for tasting a specific flavor'}
                {collectionType === 'legacy' && 'Legacy coin type with pre-defined product list'}
              </p>
            </div>
          </section>
          
          {/* STEP 4: UNLOCK REQUIREMENTS (Engagement Coins Only) */}
          {collectionType === 'engagement_collection' && (
            <section className="form-section">
              <h3 className="section-title">4. UNLOCK REQUIREMENTS</h3>
              <p className="section-description">
                Define how users earn this achievement. For Dynamic Collections, requirements are automatic based on protein categories + tier thresholds.
              </p>
              
              <div className="form-group">
                <label>How do users earn this achievement?*</label>
                <select
                  value={engagementType}
                  onChange={(e) => setEngagementType(e.target.value)}
                  className="form-select"
                >
                  <option value="">-- Select Requirement Type --</option>
                  <option value="rank_count">Rank a certain number of products</option>
                  <option value="search_count">Perform searches</option>
                  <option value="product_view_count">View product detail pages</option>
                  <option value="unique_product_view_count">Browse unique products</option>
                  <option value="profile_view_count">View user profiles</option>
                  <option value="unique_profile_view_count">Visit unique user profiles</option>
                  <option value="daily_login_streak">Login daily for consecutive days</option>
                  <option value="daily_rank_streak">Rank products daily for consecutive days</option>
                </select>
              </div>
              
              {engagementType && (
                <div className="form-group">
                  <label>
                    {engagementType === 'rank_count' && 'How many products must be ranked?'}
                    {engagementType === 'search_count' && 'How many searches must be performed?'}
                    {engagementType === 'product_view_count' && 'How many product detail pages must be viewed?'}
                    {engagementType === 'unique_product_view_count' && 'How many unique products must be browsed?'}
                    {engagementType === 'profile_view_count' && 'How many user profiles must be viewed?'}
                    {engagementType === 'unique_profile_view_count' && 'How many unique user profiles must be visited?'}
                    {engagementType === 'daily_login_streak' && 'How many consecutive login days are required?'}
                    {engagementType === 'daily_rank_streak' && 'How many consecutive ranking days are required?'}
                  </label>
                  <input
                    type="number"
                    value={engagementValue}
                    onChange={(e) => setEngagementValue(e.target.value)}
                    min="1"
                    placeholder="e.g., 10"
                    className="form-input"
                  />
                </div>
              )}
            </section>
          )}
          
          {/* PRODUCT SELECTION (for collection types) */}
          {shouldShowProductSelector(collectionType) && (
            <section className="form-section">
              <h3 className="section-title">4. PRODUCT SELECTION</h3>
              <p className="section-description">
                {collectionType === 'flavor_coin' 
                  ? 'Select the single product that represents this flavor achievement.'
                  : 'Search and select products to include in this collection. Users will earn tiers based on how many of these products they rank.'}
              </p>
              
              <div className="product-selector">
                <div className="product-panel">
                  <h4>Selected Products ({selectedProducts.length})</h4>
                  <div className="product-list">
                    {selectedProducts.length === 0 ? (
                      <div className="empty-state-small">No products selected</div>
                    ) : (
                      selectedProducts.map(product => (
                        <div key={product.id} className="product-card">
                          <img 
                            src={product.image || '/placeholder.png'} 
                            alt={product.title}
                            className="product-image"
                          />
                          <div className="product-info">
                            <div className="product-title">{product.title}</div>
                            <div className="product-vendor">{product.vendor}</div>
                            <div className="product-price">${product.price}</div>
                          </div>
                          <button
                            className="product-action-btn remove-btn"
                            onClick={() => handleRemoveProduct(product.id)}
                            type="button"
                          >
                            −
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                
                <div className="product-panel">
                  <h4>Available Products</h4>
                  {collectionType === 'flavor_coin' && (
                    <div className="flavor-coin-notice">
                      Maximum 1 product allowed for Flavor Coins
                    </div>
                  )}
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    placeholder="Search jerky products..."
                    className="form-input product-search"
                  />
                  <p className="product-stats">
                    {allProducts.length} products available • {allProducts.filter(p => p.rankCount > 0).length} have been ranked
                  </p>
                  <div className="product-list">
                    {!canAddMoreProducts ? (
                      <div className="empty-state-small">
                        Maximum 1 product allowed for Flavor Coins
                      </div>
                    ) : availableProducts.length === 0 ? (
                      <div className="empty-state-small">
                        {productSearchQuery ? 'No products match your search' : 'All products selected'}
                      </div>
                    ) : (
                      availableProducts.map(product => (
                        <div key={product.id} className="product-card">
                          <img 
                            src={product.image || '/placeholder.png'} 
                            alt={product.title}
                            className="product-image"
                          />
                          <div className="product-info">
                            <div className="product-title">{product.title}</div>
                            <div className="product-vendor">{product.vendor}</div>
                            <div className="product-price">${product.price}</div>
                          </div>
                          <button
                            className="product-action-btn add-btn"
                            onClick={() => handleAddProduct(product.id)}
                            type="button"
                            disabled={!canAddMoreProducts}
                          >
                            +
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}
          
          {/* STEP 4: DYNAMIC COLLECTION CONFIG */}
          {collectionType === 'dynamic_collection' && (
            <section className="form-section">
              <h3 className="section-title">4. DYNAMIC COLLECTION CRITERIA</h3>
              
              <div className="form-group">
                <label>Dynamic Collection Type*</label>
                <select
                  value={dynamicCollectionType}
                  onChange={(e) => setDynamicCollectionType(e.target.value)}
                  className="form-select"
                >
                  <option value="complete_collection">Complete Collection (all products)</option>
                  <option value="brand_collection">By Brand/Vendor</option>
                  <option value="animal_collection">By Animal Category</option>
                </select>
                <p className="form-hint">Choose how products are filtered for this dynamic collection</p>
              </div>
              
              {/* Brand selector */}
              {dynamicCollectionType === 'brand_collection' && (
                <div className="form-group">
                  <label>Brands/Vendors (select one or more)</label>
                  <div className="checkbox-grid">
                    {availableBrands.map(brand => (
                      <label key={brand.name} className="checkbox-grid-item">
                        <input
                          type="checkbox"
                          checked={selectedBrands.includes(brand.name)}
                          onChange={() => handleToggleBrand(brand.name)}
                        />
                        <span className="checkbox-item-content">
                          <span className="checkbox-item-icon">🏷️</span>
                          <span className="checkbox-item-name">{brand.name}</span>
                          <span className="checkbox-item-count">({brand.count} product{brand.count !== 1 ? 's' : ''})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedBrands.length === 0 && (
                    <p className="form-hint form-hint-error">Please select at least one brand</p>
                  )}
                </div>
              )}
              
              {/* Animal category selector */}
              {dynamicCollectionType === 'animal_collection' && (
                <div className="form-group">
                  <label>Animal Categories (select one or more)</label>
                  <div className="checkbox-grid">
                    {availableAnimals.map(animal => (
                      <label key={animal.name} className="checkbox-grid-item">
                        <input
                          type="checkbox"
                          checked={selectedAnimals.includes(animal.name)}
                          onChange={() => handleToggleAnimal(animal.name)}
                        />
                        <span className="checkbox-item-content">
                          <span className="checkbox-item-icon">{animal.emoji}</span>
                          <span className="checkbox-item-name">{animal.name}</span>
                          <span className="checkbox-item-count">({animal.count} product{animal.count !== 1 ? 's' : ''})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedAnimals.length === 0 && (
                    <p className="form-hint form-hint-error">Please select at least one animal category</p>
                  )}
                </div>
              )}
            </section>
          )}
          
          {/* STEP 5: CONFIGURATION */}
          <section className="form-section">
            <h3 className="section-title">5. CONFIGURATION</h3>
            
            <div className="form-row">
              <div className="form-group half-width">
                <label>Points</label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  min="0"
                  className="form-input"
                />
                <p className="form-hint">Points awarded when users earn this achievement</p>
              </div>
              
              <div className="form-group half-width">
                <label>Category (Optional)</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="form-select"
                >
                  <option value="">None</option>
                  <option value="ranking">Ranking</option>
                  <option value="streak">Streak</option>
                  <option value="explore">Explore</option>
                  <option value="discovery">Discovery</option>
                  <option value="social">Social</option>
                  <option value="special">Special</option>
                </select>
              </div>
            </div>
          </section>
          
          {/* STEP 6: VISIBILITY */}
          <section className="form-section">
            <h3 className="section-title">6. VISIBILITY</h3>
            
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isHidden === 1}
                  onChange={(e) => setIsHidden(e.target.checked ? 1 : 0)}
                />
                Hidden Coin (unlock criteria not shown to users)
              </label>
              {isHidden === 1 && (
                <p className="form-hint">Users won't see the requirements until they earn it</p>
              )}
            </div>
          </section>
          
          {/* STEP 7: PREREQUISITE */}
          <section className="form-section">
            <h3 className="section-title">7. PREREQUISITE ACHIEVEMENT</h3>
            
            <div className="form-group">
              <label>Prerequisite Achievement (Optional)</label>
              <select
                value={prerequisiteAchievementId || ''}
                onChange={(e) => setPrerequisiteAchievementId(e.target.value ? parseInt(e.target.value) : null)}
                className="form-select"
              >
                <option value="">None - No prerequisite required</option>
                {allCoins
                  .filter(c => c.id !== coin?.id)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
              {prerequisiteAchievementId && (
                <p className="form-hint">Users must earn the prerequisite achievement before this one unlocks</p>
              )}
            </div>
          </section>
          
          {/* STEP 8: TIER PROGRESSION */}
          <section className="form-section">
            <h3 className="section-title">8. TIER PROGRESSION</h3>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={hasTiers === 1}
                  onChange={(e) => setHasTiers(e.target.checked ? 1 : 0)}
                />
                Enable Tiers (bronze, silver, gold, etc.)
              </label>
              <p className="form-hint">
                Uncheck for single-completion achievements (like Flavor Coins) where users either earn it or don't - no progression tiers.
              </p>
            </div>
            
            {hasTiers === 1 && (
              <div className="tier-inputs">
                <p className="section-description">
                  Set completion percentages for each tier. Users progress through tiers as they complete more items.
                </p>
                
                <div className="tier-row">
                  <div className="tier-input-group">
                    <label>🥉 Bronze</label>
                    <div className="input-with-suffix">
                      <input
                        type="number"
                        value={tierThresholds.bronze}
                        onChange={(e) => setTierThresholds({ ...tierThresholds, bronze: parseInt(e.target.value) || 0 })}
                        min="0"
                        max="100"
                        className="form-input tier-input"
                      />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                  
                  <div className="tier-input-group">
                    <label>🥈 Silver</label>
                    <div className="input-with-suffix">
                      <input
                        type="number"
                        value={tierThresholds.silver}
                        onChange={(e) => setTierThresholds({ ...tierThresholds, silver: parseInt(e.target.value) || 0 })}
                        min="0"
                        max="100"
                        className="form-input tier-input"
                      />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                  
                  <div className="tier-input-group">
                    <label>🥇 Gold</label>
                    <div className="input-with-suffix">
                      <input
                        type="number"
                        value={tierThresholds.gold}
                        onChange={(e) => setTierThresholds({ ...tierThresholds, gold: parseInt(e.target.value) || 0 })}
                        min="0"
                        max="100"
                        className="form-input tier-input"
                      />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                  
                  <div className="tier-input-group">
                    <label>💎 Platinum</label>
                    <div className="input-with-suffix">
                      <input
                        type="number"
                        value={tierThresholds.platinum}
                        onChange={(e) => setTierThresholds({ ...tierThresholds, platinum: parseInt(e.target.value) || 0 })}
                        min="0"
                        max="100"
                        className="form-input tier-input"
                      />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                  
                  <div className="tier-input-group">
                    <label>💎 Diamond</label>
                    <div className="input-with-suffix">
                      <input
                        type="number"
                        value={tierThresholds.diamond}
                        onChange={(e) => setTierThresholds({ ...tierThresholds, diamond: parseInt(e.target.value) || 0 })}
                        min="0"
                        max="100"
                        className="form-input tier-input"
                      />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
          
          {/* STEP 9: STATUS */}
          <section className="form-section">
            <h3 className="section-title">9. STATUS</h3>
            
            <div className="form-group">
              <label>Active Status</label>
              <select
                value={isActive}
                onChange={(e) => setIsActive(parseInt(e.target.value))}
                className="form-select"
              >
                <option value={1}>✅ Active - Users can earn this achievement</option>
                <option value={0}>⛔ Inactive - Hidden from all users</option>
              </select>
              <p className="form-hint">Inactive coins won't be visible or earnable by users</p>
            </div>
          </section>
        </div>
        
        <div className="modal-footer">
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save Coin'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditCoinModal;
