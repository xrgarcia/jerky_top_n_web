import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../utils/api';

export function useRankableProducts(rankedProductIds = []) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableCount, setAvailableCount] = useState(0);
  
  const searchTimeoutRef = useRef(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient('/products/rankable');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.products && Array.isArray(data.products)) {
        setProducts(data.products);
        setFilteredProducts(data.products);
        setAvailableCount(data.products.length);
        console.log(`✅ Loaded ${data.products.length} rankable products`);
      }
    } catch (err) {
      console.error('Failed to load rankable products:', err);
      setError('Failed to load products');
      setProducts([]);
      setFilteredProducts([]);
      setAvailableCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSearch = useCallback((term) => {
    setSearchTerm(term);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (!term.trim()) {
        setFilteredProducts(products);
        setAvailableCount(products.length);
        return;
      }

      const lowerTerm = term.toLowerCase();
      const filtered = products.filter(product => {
        const title = (product.title || '').toLowerCase();
        const description = (product.description || '').toLowerCase();
        const animal = (product.metadata?.animal || '').toLowerCase();
        const flavor = (product.metadata?.flavor || '').toLowerCase();
        
        return title.includes(lowerTerm) ||
               description.includes(lowerTerm) ||
               animal.includes(lowerTerm) ||
               flavor.includes(lowerTerm);
      });
      
      setFilteredProducts(filtered);
      setAvailableCount(filtered.length);
      console.log(`🔍 Search "${term}": ${filtered.length} results`);
    }, 300);
  }, [products]);

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
    reloadProducts: loadProducts
  };
}
