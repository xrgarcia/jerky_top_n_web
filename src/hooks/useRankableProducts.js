import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../utils/api';

export function useRankableProducts(rankedProductIds = []) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableCount, setAvailableCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const searchTimeoutRef = useRef(null);

  const loadProducts = useCallback(async (page = 1, reset = false) => {
    if (reset) {
      setLoading(true);
      setProducts([]);
      setFilteredProducts([]);
      setCurrentPage(1);
      setHasMore(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);
    
    try {
      const queryParams = new URLSearchParams({
        query: searchTerm,
        page: page.toString(),
        limit: '20',
        sort: 'name-asc'
      });
      
      const response = await apiClient(`/api/products/rankable?${queryParams}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.products && Array.isArray(data.products)) {
        setProducts(prev => reset ? data.products : [...prev, ...data.products]);
        setFilteredProducts(prev => reset ? data.products : [...prev, ...data.products]);
        setHasMore(data.hasMore || false);
        setTotalProducts(data.total || 0);
        setCurrentPage(page);
        setAvailableCount(data.total || 0);
        console.log(`✅ Loaded ${data.products.length} rankable products (page ${page}, hasMore: ${data.hasMore})`);
      }
    } catch (err) {
      console.error('Failed to load rankable products:', err);
      setError('Failed to load products');
      if (reset) {
        setProducts([]);
        setFilteredProducts([]);
        setAvailableCount(0);
      }
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    loadProducts(1, true);
  }, []);

  const handleSearch = useCallback((term) => {
    setSearchTerm(term);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      loadProducts(1, true);
    }, 300);
  }, [loadProducts]);

  const loadMoreProducts = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    loadProducts(currentPage + 1, false);
  }, [hasMore, isLoadingMore, currentPage, loadProducts]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return {
    products: filteredProducts,
    loading,
    error,
    availableCount,
    searchTerm,
    handleSearch,
    reloadProducts: () => loadProducts(1, true),
    loadMoreProducts,
    hasMore,
    isLoadingMore,
    totalProducts,
    currentPage
  };
}
