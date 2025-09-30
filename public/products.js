let allProducts = [];
let searchTimeout = null;

async function init() {
  await validateSession();
  await loadProducts();
  setupEventListeners();
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
    console.log(`✅ Loaded ${allProducts.length} products with ranking counts`);
    displayProducts(allProducts);
  } catch (error) {
    console.error('Error loading products:', error);
    document.getElementById('products-grid').innerHTML = '<div class="error">Failed to load products</div>';
  }
}

function displayProducts(products) {
  const grid = document.getElementById('products-grid');
  
  if (products.length === 0) {
    grid.innerHTML = '<div class="no-results">No products found</div>';
    return;
  }
  
  grid.innerHTML = products.map(product => `
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
}

function setupEventListeners() {
  const searchInput = document.getElementById('product-search');
  const searchResults = document.getElementById('search-results');
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    clearTimeout(searchTimeout);
    
    if (query.length < 3) {
      searchResults.style.display = 'none';
      displayProducts(allProducts);
      return;
    }
    
    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  });
  
  searchInput.addEventListener('blur', () => {
    setTimeout(() => {
      searchResults.style.display = 'none';
    }, 200);
  });
  
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.length >= 3) {
      performSearch(searchInput.value);
    }
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
    const matchedProducts = data.products;
    
    const searchResults = document.getElementById('search-results');
    
    if (matchedProducts.length === 0) {
      searchResults.innerHTML = '<div class="no-results-dropdown">No products found</div>';
      searchResults.style.display = 'block';
      displayProducts([]);
      return;
    }
    
    const topResults = matchedProducts.slice(0, 8);
    searchResults.innerHTML = topResults.map(product => `
      <div class="search-result-item" onclick="selectProduct('${product.id}')">
        <img src="${product.image || ''}" alt="${product.title}">
        <div class="result-info">
          <div class="result-title">${product.title}</div>
          <div class="result-vendor">${product.vendor}</div>
        </div>
      </div>
    `).join('');
    searchResults.style.display = 'block';
    
    displayProducts(matchedProducts);
  } catch (error) {
    console.error('Search error:', error);
  }
}

function selectProduct(productId) {
  const product = allProducts.find(p => p.id === productId);
  if (product) {
    displayProducts([product]);
    document.getElementById('product-search').value = product.title;
    document.getElementById('search-results').style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', init);
