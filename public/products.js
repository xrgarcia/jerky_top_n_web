let allProducts = [];
let filteredProducts = [];
let displayedCount = 0;
let searchTimeout = null;
const PRODUCTS_PER_PAGE = 30;

async function init() {
  await validateSession();
  await loadProducts();
  setupEventListeners();
  setupInfiniteScroll();
}

async function validateSession() {
  try {
    const response = await fetch('/api/session/validate');
    if (!response.ok) {
      window.location.href = '/';
      return;
    }
    const data = await response.json();
    console.log('✅ 90-day customer session validated:', data.user.displayName);
  } catch (error) {
    console.error('❌ Session validation failed:', error);
    window.location.href = '/';
  }
}

async function loadProducts() {
  try {
    const response = await fetch('/api/products/all');
    const data = await response.json();
    allProducts = data.products;
    filteredProducts = allProducts;
    console.log(`✅ Loaded ${allProducts.length} products with ranking counts`);
    displayProducts(true);
  } catch (error) {
    console.error('Error loading products:', error);
    document.getElementById('products-grid').innerHTML = '<div class="error">Failed to load products</div>';
  }
}

function displayProducts(reset = false) {
  const grid = document.getElementById('products-grid');
  
  if (reset) {
    displayedCount = 0;
    grid.innerHTML = '';
  }
  
  if (filteredProducts.length === 0) {
    grid.innerHTML = '<div class="no-results">No products found</div>';
    return;
  }
  
  const productsToShow = filteredProducts.slice(displayedCount, displayedCount + PRODUCTS_PER_PAGE);
  
  const productsHTML = productsToShow.map(product => `
    <div class="product-card">
      <div class="product-image">
        ${product.image ? `<img src="${product.image}" alt="${product.title}">` : '<div class="no-image">No image</div>'}
        <div class="ranking-badge ${product.rankingCount > 0 ? 'has-rankings' : ''}">
          🏆 ${product.rankingCount} ranking${product.rankingCount !== 1 ? 's' : ''}
        </div>
      </div>
      <div class="product-info">
        <h3>${product.title}</h3>
        <p class="vendor">${product.vendor}</p>
        <p class="price">$${product.price}</p>
      </div>
    </div>
  `).join('');
  
  grid.insertAdjacentHTML('beforeend', productsHTML);
  displayedCount += productsToShow.length;
  
  console.log(`📦 Displaying ${displayedCount} of ${filteredProducts.length} products`);
}

function setupEventListeners() {
  const searchInput = document.getElementById('product-search');
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    clearTimeout(searchTimeout);
    
    if (query.length === 0) {
      filteredProducts = allProducts;
      displayProducts(true);
      return;
    }
    
    if (query.length < 3) {
      return;
    }
    
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  });
  
  document.getElementById('logout-link').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = '/';
    }
  });
}

async function performSearch(query) {
  try {
    const response = await fetch(`/api/products/all?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    filteredProducts = data.products;
    displayProducts(true);
  } catch (error) {
    console.error('Search error:', error);
  }
}

function setupInfiniteScroll() {
  const options = {
    root: null,
    rootMargin: '100px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && displayedCount < filteredProducts.length) {
        displayProducts(false);
      }
    });
  }, options);

  const sentinel = document.createElement('div');
  sentinel.id = 'scroll-sentinel';
  sentinel.style.height = '1px';
  document.querySelector('.products-page').appendChild(sentinel);
  
  observer.observe(sentinel);
}

document.addEventListener('DOMContentLoaded', init);
