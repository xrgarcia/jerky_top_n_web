import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';

function RankableProductsPageAdmin() {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showUserResults, setShowUserResults] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  // Search users by email/username (only when actively searching, not when user is selected)
  const shouldSearch = userSearchQuery.length >= 2 && !selectedUserId;
  const { data: userSearchData, isLoading: isSearching } = useQuery({
    queryKey: ['admin', 'userSearch', userSearchQuery],
    queryFn: async () => {
      // Get the actual input value (in case browser autofilled it)
      const actualValue = inputRef.current?.value || userSearchQuery;
      if (!actualValue || actualValue.length < 2) return { users: [] };
      const response = await api.get(`/admin/users?search=${encodeURIComponent(actualValue)}&limit=20`);
      return response;
    },
    enabled: shouldSearch,
  });

  // Fetch rankable products for selected user
  const { data: rankableData, isLoading, error } = useQuery({
    queryKey: ['admin', 'rankableProducts', selectedUserId],
    queryFn: async () => {
      const response = await api.get(`/admin/rankable-products/${selectedUserId}`);
      return response;
    },
    enabled: !!selectedUserId,
  });

  const searchResults = userSearchData?.users || [];
  const products = rankableData?.products || [];
  const targetUser = rankableData?.user || null;

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowUserResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (user) => {
    setSelectedUserId(user.id);
    setUserSearchQuery(user.email);
    setShowUserResults(false);
  };

  const handleClearUser = () => {
    setSelectedUserId(null);
    setUserSearchQuery('');
    setProductSearchQuery('');
  };

  // Filter products by search
  const filteredProducts = useMemo(() => {
    if (!productSearchQuery) return products;

    const search = productSearchQuery.toLowerCase();
    return products.filter((product) => {
      return (
        product.title?.toLowerCase().includes(search) ||
        product.vendor?.toLowerCase().includes(search) ||
        product.animalDisplay?.toLowerCase().includes(search) ||
        product.primaryFlavor?.toLowerCase().includes(search)
      );
    });
  }, [products, productSearchQuery]);

  // Get reason badge styling
  const getReasonBadge = (reasons) => {
    if (!reasons || reasons.length === 0) return null;

    if (reasons.includes('admin_email')) {
      return <span className="badge badge-admin">@jerky.com Admin</span>;
    }

    return (
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        {reasons.includes('force_rankable') && (
          <span className="badge badge-beta">Force Rankable</span>
        )}
        {reasons.includes('purchased') && (
          <span className="badge badge-success">Purchased</span>
        )}
      </div>
    );
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>🔍 Rankable Products Validator</h1>
        <p>Verify which products a user can rank (uses same logic as Rank page)</p>
      </div>

      <div className="admin-content">
        {/* User Search */}
        <div className="filters-section" style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          <div className="form-group" ref={searchRef} style={{ position: 'relative' }}>
            <label className="form-label" style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', display: 'block' }}>
              Search for User by Email or Username
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Type email or username (min 2 characters)..."
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  setShowUserResults(true);
                }}
                onInput={(e) => {
                  // Catch browser autofill which doesn't trigger onChange
                  setUserSearchQuery(e.target.value);
                  setShowUserResults(true);
                }}
                onFocus={() => setShowUserResults(true)}
                className="form-input"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                style={{ flex: 1, fontSize: '14px', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              {selectedUserId && (
                <button
                  onClick={handleClearUser}
                  style={{ padding: '10px 20px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Clear Selection
                </button>
              )}
            </div>
            <p className="form-help" style={{ marginTop: '10px', marginBottom: 0 }}>
              Type at least 2 characters to search across 412K users
            </p>

            {/* Autocomplete Results */}
            {showUserResults && userSearchQuery.length >= 2 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                marginTop: '5px',
                maxHeight: '300px',
                overflowY: 'auto',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                zIndex: 1000
              }}>
                {isSearching ? (
                  <div style={{ padding: '15px', textAlign: 'center', color: '#666' }}>
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: '15px', textAlign: 'center', color: '#666' }}>
                    No users found matching "{userSearchQuery}"
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '10px 15px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', fontSize: '12px', color: '#666' }}>
                      Found {searchResults.length} user{searchResults.length === 1 ? '' : 's'}
                    </div>
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        style={{
                          padding: '12px 15px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f0f0f0',
                          backgroundColor: selectedUserId === user.id ? '#e8f4f8' : 'white',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
                        onMouseLeave={(e) => e.target.style.backgroundColor = selectedUserId === user.id ? '#e8f4f8' : 'white'}
                      >
                        <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                          {user.role === 'employee_admin' && '👑 '}
                          {user.username || 'No username'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          {user.email}
                        </div>
                        {user.role && (
                          <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                            Role: {user.role}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* User Info Card */}
        {targetUser && (
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f4f8', borderRadius: '8px', border: '2px solid #0066cc' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#0066cc' }}>
              {targetUser.isEmployee ? '👑' : '👤'} {targetUser.username || targetUser.email}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '10px', fontSize: '14px' }}>
              <div><strong>Email:</strong></div>
              <div>{targetUser.email}</div>
              <div><strong>User ID:</strong></div>
              <div>{targetUser.id}</div>
              <div><strong>Role:</strong></div>
              <div>{targetUser.role || 'user'}</div>
              <div><strong>Access Level:</strong></div>
              <div>
                {targetUser.isEmployee ? (
                  <span className="badge badge-admin">Admin (Can rank all products)</span>
                ) : (
                  <span className="badge badge-info">Regular User (Filtered)</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {selectedUserId && (
          <>
            {isLoading && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
                <p>Loading rankable products...</p>
              </div>
            )}

            {error && (
              <div className="error-message">
                <strong>Error:</strong> {error.message || 'Failed to load rankable products'}
              </div>
            )}

            {!isLoading && !error && (
              <>
                {/* Search and Count */}
                <div className="filters-section">
                  <div className="search-box">
                    <input
                      type="text"
                      placeholder="Search by any attribute..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                    Showing {filteredProducts.length} of {products.length} rankable products
                  </div>
                </div>

                {/* Products Table */}
                {filteredProducts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <p style={{ fontSize: '18px', marginBottom: '10px' }}>
                      {productSearchQuery ? 'No products match your search' : 'No rankable products for this user'}
                    </p>
                    {!targetUser?.isEmployee && !productSearchQuery && (
                      <p style={{ fontSize: '14px' }}>
                        This user hasn't purchased any products and there are no force-rankable beta products.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '80px' }}>Image</th>
                          <th>Product Title</th>
                          <th style={{ width: '150px' }}>Vendor</th>
                          <th style={{ width: '120px' }}>Animal</th>
                          <th style={{ width: '120px' }}>Flavor</th>
                          <th style={{ width: '100px' }}>Price</th>
                          <th style={{ width: '200px' }}>Rankable Because</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((product) => (
                          <tr key={product.id}>
                            <td>
                              {product.imageUrl ? (
                                <img
                                  src={product.imageUrl}
                                  alt={product.title}
                                  style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
                                />
                              ) : (
                                <div style={{ width: '60px', height: '60px', backgroundColor: '#e0e0e0', borderRadius: '4px' }}></div>
                              )}
                            </td>
                            <td>
                              <div style={{ fontWeight: '500' }}>{product.title}</div>
                            </td>
                            <td>{product.vendor || '-'}</td>
                            <td>
                              <span style={{ fontSize: '18px', marginRight: '5px' }}>{product.animalIcon}</span>
                              {product.animalDisplay}
                            </td>
                            <td>
                              <span style={{ fontSize: '18px', marginRight: '5px' }}>{product.flavorIcon}</span>
                              {product.flavorDisplay}
                            </td>
                            <td>${product.price ? parseFloat(product.price).toFixed(2) : '0.00'}</td>
                            <td>{getReasonBadge(product.rankableReasons)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Instructions when no user selected */}
        {!selectedUserId && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔍</div>
            <h2 style={{ marginBottom: '10px', color: '#333' }}>Select a User to Begin</h2>
            <p style={{ fontSize: '16px', lineHeight: '1.6', maxWidth: '600px', margin: '0 auto' }}>
              Choose a user from the dropdown above to see exactly which products they can rank.
              This uses the same filtering logic as the Rank page, so you can validate the beta product access system.
            </p>
            <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', maxWidth: '700px', margin: '30px auto 0' }}>
              <h3 style={{ marginBottom: '15px', fontSize: '16px', color: '#333' }}>How Products Become Rankable:</h3>
              <div style={{ textAlign: 'left', fontSize: '14px', lineHeight: '1.8' }}>
                <div style={{ marginBottom: '10px' }}>
                  <span className="badge badge-admin" style={{ marginRight: '10px' }}>@jerky.com Admin</span>
                  Can rank all 164 products (no restrictions)
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <span className="badge badge-beta" style={{ marginRight: '10px' }}>Force Rankable</span>
                  Products marked in beta testing (available to all users)
                </div>
                <div>
                  <span className="badge badge-success" style={{ marginRight: '10px' }}>Purchased</span>
                  Products the user has purchased and received
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .badge-admin {
          background-color: #8b5cf6;
          color: white;
        }
        
        .badge-beta {
          background-color: #f59e0b;
          color: white;
        }
        
        .badge-success {
          background-color: #10b981;
          color: white;
        }
        
        .badge-info {
          background-color: #3b82f6;
          color: white;
        }
      `}</style>
    </div>
  );
}

export default RankableProductsPageAdmin;
