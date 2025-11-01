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
      const response = await apiClient('/products/all');
      const data = await response.json();
      
      if (data.products && Array.isArray(data.products)) {
        const rankedIds = new Set(rankedProductIds);
        const availableProducts = data.products.filter(
          product => !rankedIds.has(product.productId)
        );
        
        setProducts(availableProducts);
        setFilteredProducts(availableProducts);
        setAvailableCount(availableProducts.length);
        console.log(`✅ Loaded ${availableProducts.length} rankable products`);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [rankedProductIds]);

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
