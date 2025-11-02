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
  const [collectionType, setCollectionType] = useState('engagement_coin');
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
      
      setCollectionType(coin.collectionType || 'engagement_coin');
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
          const req = JSON.parse(coin.requirement);
          if (req.productIds) {
            setSelectedProductIds(req.productIds);
          }
        } catch (e) {
          // Ignore parse errors
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
    setCollectionType('engagement_coin');
    setCategory('');
    setIsHidden(0);
    setPrerequisiteAchievementId(null);
    setSelectedProductIds([]);
    setProductSearchQuery('');
    setHasTiers(0);
    setTierThresholds({ bronze: 40, silver: 60, gold: 75, platinum: 90, diamond: 100 });
    setProteinCategories([]);
    setRequirement('');
  };
  
  const isCollectionType = (type) => {
    return ['static_collection', 'dynamic_collection', 'legacy', 'flavor_coin'].includes(type);
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
  
  // Product selection helpers
  const availableProducts = useMemo(() => {
    if (!productSearchQuery) {
      return allProducts.filter(p => !selectedProductIds.includes(p.id));
    }
    
    const query = productSearchQuery.toLowerCase();
    return allProducts.filter(p => 
      !selectedProductIds.includes(p.id) &&
      (p.title?.toLowerCase().includes(query) || 
       p.vendor?.toLowerCase().includes(query))
    );
  }, [allProducts, selectedProductIds, productSearchQuery]);
  
  const selectedProducts = useMemo(() => {
    return allProducts.filter(p => selectedProductIds.includes(p.id));
  }, [allProducts, selectedProductIds]);
  
  const handleAddProduct = (productId) => {
    setSelectedProductIds([...selectedProductIds, productId]);
  };
  
  const handleRemoveProduct = (productId) => {
    setSelectedProductIds(selectedProductIds.filter(id => id !== productId));
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
    
    return true;
  };
  
  // Build requirement object based on coin type
  const buildRequirement = () => {
    if (isCollectionType(collectionType)) {
      return JSON.stringify({
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
          {/* BASIC INFORMATION */}
          <section className="form-section">
            <h3 className="section-title">BASIC INFORMATION</h3>
            
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
              <label>Icon*</label>
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
              </div>
              
              <div className="form-group half-width">
                <label>Active Status</label>
                <select
                  value={isActive}
                  onChange={(e) => setIsActive(parseInt(e.target.value))}
                  className="form-select"
                >
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>
            </div>
          </section>
          
          {/* COLLECTION TYPE */}
          <section className="form-section">
            <h3 className="section-title">COLLECTION TYPE</h3>
            
            <div className="form-group">
              <label>Coin Type*</label>
              <select
                value={collectionType}
                onChange={(e) => setCollectionType(e.target.value)}
                className="form-select"
              >
                <option value="engagement_coin">Engagement Coin</option>
                <option value="static_collection">Static Collection Coin</option>
                <option value="dynamic_collection">Dynamic Collection Coin</option>
                <option value="flavor_coin">Flavor Coin</option>
                <option value="legacy">Pre-Defined List of Products (Legacy)</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isHidden === 1}
                  onChange={(e) => setIsHidden(e.target.checked ? 1 : 0)}
                />
                Hidden Achievement (unlock criteria not shown)
              </label>
              {isHidden === 1 && (
                <p className="form-hint">Users must earn this achievement first before this one can be unlocked</p>
              )}
            </div>
            
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
                <p className="form-hint">Users must earn this achievement first before this one can be unlocked</p>
              )}
            </div>
          </section>
          
          {/* PRODUCT SELECTOR (for collection types) */}
          {isCollectionType(collectionType) && (
            <section className="form-section">
              <h3 className="section-title">SELECT PRODUCTS FOR COLLECTION</h3>
              <p className="section-description">
                Search and select products to include in this custom collection. Users will earn tiers based on how many of these products they rank.
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
                            src={product.featuredImage || '/placeholder.png'} 
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
                    {availableProducts.length === 0 ? (
                      <div className="empty-state-small">
                        {productSearchQuery ? 'No products match your search' : 'All products selected'}
                      </div>
                    ) : (
                      availableProducts.map(product => (
                        <div key={product.id} className="product-card">
                          <img 
                            src={product.featuredImage || '/placeholder.png'} 
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
          
          {/* TIER CONFIGURATION */}
          <section className="form-section">
            <h3 className="section-title">TIER CONFIGURATION</h3>
            
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
