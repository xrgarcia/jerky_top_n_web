import React, { useState, useMemo } from 'react';
import { useAdminProducts, useAnimalCategories, useUpdateProductMetadata } from '../../hooks/useAdminTools';
import './AdminPages.css';

function EditProductModal({ product, animalCategories, onClose, onSave, isLoading, error }) {
  const [selectedAnimal, setSelectedAnimal] = useState(
    animalCategories.find(a => a.type === product.animalType) || animalCategories[0]
  );

  const handleSave = () => {
    onSave({
      productId: product.id,
      animalType: selectedAnimal.type,
      animalDisplay: selectedAnimal.display,
      animalIcon: selectedAnimal.icon,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🥩 Edit Product Metadata</h3>
          <button className="modal-close-btn" onClick={onClose} disabled={isLoading}>×</button>
        </div>
        
        <div className="modal-body">
          {error && (
            <div className="error-message">
              <strong>Error:</strong> {error.message || 'Failed to update product. Please try again.'}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Product</label>
            <div className="product-display">{product.title}</div>
          </div>

          <div className="form-group">
            <label className="form-label">Animal Category*</label>
            <select
              className="form-select"
              value={selectedAnimal.type}
              onChange={(e) => {
                const animal = animalCategories.find(a => a.type === e.target.value);
                setSelectedAnimal(animal);
              }}
              disabled={isLoading}
            >
              {animalCategories.map((animal) => (
                <option key={animal.type} value={animal.type}>
                  {animal.icon} {animal.display} ({animal.type})
                </option>
              ))}
            </select>
            <p className="form-help">Selecting an animal will automatically set the animal type, display name, and icon.</p>
          </div>

          <div className="form-group">
            <label className="form-label">Preview</label>
            <div className="preview-box">
              <div><strong>Icon:</strong> {selectedAnimal.icon}</div>
              <div><strong>Display:</strong> {selectedAnimal.display}</div>
              <div><strong>Type:</strong> {selectedAnimal.type}</div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductsPageAdmin() {
  const { data, isLoading, error } = useAdminProducts();
  const { data: animalCategories = [] } = useAnimalCategories();
  const updateMutation = useUpdateProductMetadata();

  const [searchQuery, setSearchQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [animalTypeFilter, setAnimalTypeFilter] = useState('all');
  const [animalDisplayFilter, setAnimalDisplayFilter] = useState('all');
  const [flavorFilter, setFlavorFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState(null);

  const products = data?.products || [];
  const total = data?.total || 0;

  // Extract unique filter options
  const filterOptions = useMemo(() => {
    const vendors = new Set();
    const animalTypes = new Set();
    const animalDisplays = new Set();
    const flavors = new Set();

    products.forEach((product) => {
      if (product.vendor) vendors.add(product.vendor);
      if (product.animalType) animalTypes.add(product.animalType);
      if (product.animalDisplay) animalDisplays.add(product.animalDisplay);
      if (product.primaryFlavor) flavors.add(product.primaryFlavor);
    });

    return {
      vendors: Array.from(vendors).sort(),
      animalTypes: Array.from(animalTypes).sort(),
      animalDisplays: Array.from(animalDisplays).sort(),
      flavors: Array.from(flavors).sort(),
    };
  }, [products]);

  // Apply filters
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const matchesSearch =
          product.title?.toLowerCase().includes(search) ||
          product.vendor?.toLowerCase().includes(search) ||
          product.animalType?.toLowerCase().includes(search) ||
          product.animalDisplay?.toLowerCase().includes(search) ||
          product.primaryFlavor?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Dropdown filters
      if (vendorFilter !== 'all' && product.vendor !== vendorFilter) return false;
      if (animalTypeFilter !== 'all' && product.animalType !== animalTypeFilter) return false;
      if (animalDisplayFilter !== 'all' && product.animalDisplay !== animalDisplayFilter) return false;
      if (flavorFilter !== 'all' && product.primaryFlavor !== flavorFilter) return false;

      return true;
    });
  }, [products, searchQuery, vendorFilter, animalTypeFilter, animalDisplayFilter, flavorFilter]);

  const handleSaveEdit = async (updateData) => {
    try {
      await updateMutation.mutateAsync(updateData);
      setEditingProduct(null);
    } catch (error) {
      console.error('Failed to update product:', error);
      // Error will be displayed in the modal
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setVendorFilter('all');
    setAnimalTypeFilter('all');
    setAnimalDisplayFilter('all');
    setFlavorFilter('all');
  };

  if (isLoading) {
    return (
      <div className="admin-page">
        <div className="loading-state">Loading products...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="error-state">Error loading products: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="admin-page products-admin-page">
      <div className="admin-page-header">
        <div>
          <h2>🥩 Product Management</h2>
        </div>
        <div className="count-badge">{total} products</div>
      </div>

      <div className="filters-section">
        <div className="filters-header">
          <h3>🔍 Filters</h3>
          {(searchQuery || vendorFilter !== 'all' || animalTypeFilter !== 'all' || animalDisplayFilter !== 'all' || flavorFilter !== 'all') && (
            <button className="btn-clear-filters" onClick={handleClearFilters}>
              Clear Filters
            </button>
          )}
        </div>

        <div className="filters-controls">
          <input
            type="text"
            className="filter-search"
            placeholder="Search by any attribute..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="filter-dropdowns">
            <select
              className="filter-select"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
            >
              <option value="all">All Vendors</option>
              {filterOptions.vendors.map((vendor) => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={animalTypeFilter}
              onChange={(e) => setAnimalTypeFilter(e.target.value)}
            >
              <option value="all">All Animal Types</option>
              {filterOptions.animalTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={animalDisplayFilter}
              onChange={(e) => setAnimalDisplayFilter(e.target.value)}
            >
              <option value="all">All Animal Displays</option>
              {filterOptions.animalDisplays.map((display) => (
                <option key={display} value={display}>
                  {display}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={flavorFilter}
              onChange={(e) => setFlavorFilter(e.target.value)}
            >
              <option value="all">All Flavors</option>
              {filterOptions.flavors.map((flavor) => (
                <option key={flavor} value={flavor}>
                  {flavor}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="products-table-container">
        <table className="products-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Title</th>
              <th>Vendor</th>
              <th>Animal Type</th>
              <th>Animal Display</th>
              <th>Primary Flavor</th>
              <th>Price</th>
              <th>Rankings</th>
              <th>Avg Rank</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan="10" className="empty-state">
                  No products found matching your filters.
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <img src={product.image} alt={product.title} className="product-thumbnail" />
                  </td>
                  <td className="product-title-cell">{product.title}</td>
                  <td>{product.vendor}</td>
                  <td>
                    <span className="animal-badge">
                      {product.animalIcon} {product.animalType}
                    </span>
                  </td>
                  <td>{product.animalDisplay}</td>
                  <td>
                    <span className="flavor-badge">
                      {product.flavorIcon} {product.primaryFlavor}
                    </span>
                  </td>
                  <td className="price-cell">${product.price}</td>
                  <td className="center-cell">{product.rankingCount || 0}</td>
                  <td className="center-cell">
                    {product.avgRank ? product.avgRank.toFixed(1) : '-'}
                  </td>
                  <td>
                    <button
                      className="btn-edit"
                      onClick={() => setEditingProduct(product)}
                      disabled={updateMutation.isPending}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="products-footer">
        Showing {filteredProducts.length} of {total} products
      </div>

      {editingProduct && animalCategories.length > 0 && (
        <EditProductModal
          product={editingProduct}
          animalCategories={animalCategories}
          onClose={() => setEditingProduct(null)}
          onSave={handleSaveEdit}
          isLoading={updateMutation.isPending}
          error={updateMutation.error}
        />
      )}
    </div>
  );
}

export default ProductsPageAdmin;
