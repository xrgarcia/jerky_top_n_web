const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// Import database storage
let storage;
try {
  const { storage: dbStorage } = require('./server/storage.js');
  storage = dbStorage;
  console.log('📂 Database storage connected');
} catch (err) {
  console.error('❌ Database storage failed to load:', err);
}

// Store for temporary OAuth sessions only (PKCE during OAuth flow)
const oauthSessions = new Map(); // For PKCE during OAuth flow
// Customer sessions are now stored in PostgreSQL database for persistence

// Jerky.com shop domain for customer authentication
const JERKY_SHOP_DOMAIN = 'jerky-com.myshopify.com';

console.log('🔧 Shopify Customer Authentication Configuration:');
console.log('🏪  Shop Domain:', JERKY_SHOP_DOMAIN);
console.log('🔑  Using Customer Account API for jerky.com accounts');

// Configure Express to trust proxy (required for Replit)
app.set('trust proxy', true);

// Parse JSON bodies and cookies
app.use(express.json());
app.use(cookieParser());

// Disable caching for development in Replit environment
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Last-Modified', new Date().toUTCString());
  next();
});

// Serve static files with cache-busting for development
app.use(express.static('public', {
  setHeaders: (res, path) => {
    // Disable caching for JS/CSS files in development to ensure updates are loaded
    if (path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Sample jerky data
const jerkyData = [
  { id: 1, name: "Smoky BBQ Beef Jerky", brand: "Premium Jerky Co.", rating: 4.8, price: "$12.99" },
  { id: 2, name: "Spicy Jalapeño Turkey Jerky", brand: "Fire Mountain", rating: 4.6, price: "$14.99" },
  { id: 3, name: "Classic Original Beef", brand: "Hometown Jerky", rating: 4.7, price: "$11.99" },
  { id: 4, name: "Teriyaki Salmon Jerky", brand: "Pacific Northwest", rating: 4.5, price: "$16.99" },
  { id: 5, name: "Peppered Beef Jerky", brand: "Ranch Style", rating: 4.4, price: "$13.99" },
  { id: 6, name: "Sweet & Spicy Pork", brand: "Southern Comfort", rating: 4.3, price: "$15.99" },
  { id: 7, name: "Hickory Smoked Venison", brand: "Wild Game Co.", rating: 4.9, price: "$18.99" },
  { id: 8, name: "Garlic Pepper Beef", brand: "Gourmet Jerky", rating: 4.2, price: "$12.49" }
];

// Shopify Customer OAuth helper functions (standard OAuth flow)
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Real Shopify Customer Account API endpoints
async function getCustomerAccountEndpoints() {
  try {
    // Try Customer Account API first
    const response = await fetch(`https://${JERKY_SHOP_DOMAIN}/.well-known/shopify_customer_account_api`);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log('Customer Account API not available, using fallback OAuth');
  }
  
  // Fallback to standard Shopify OAuth
  return {
    authorization_endpoint: `https://${JERKY_SHOP_DOMAIN}/admin/oauth/authorize`,
    token_endpoint: `https://${JERKY_SHOP_DOMAIN}/admin/oauth/access_token`,
    userinfo_endpoint: `https://${JERKY_SHOP_DOMAIN}/admin/api/2023-10/customers.json`
  };
}

// Email-based customer authentication
app.get('/api/customer/auth/start', async (req, res) => {
  try {
    console.log('🔑 Starting email-based customer authentication for jerky.com');
    
    // Return our email login form URL
    res.json({
      authUrl: `https://${process.env.REPLIT_DEV_DOMAIN}/customer-login`,
      state: 'email_auth'
    });
    
  } catch (error) {
    console.error('Customer auth start error:', error);
    res.status(500).json({ error: 'Failed to start authentication' });
  }
});

// Customer email login form
app.get('/customer-login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Access Your Jerky.com Account</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 0;
          padding: 0;
          background: #2b2b2b;
          color: #333;
        }
        .header {
          background: #8B4513;
          padding: 20px;
          text-align: center;
          color: white;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
        }
        .container {
          max-width: 400px;
          margin: 50px auto;
          padding: 30px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        input[type="email"], input[type="text"] {
          width: 100%;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
          box-sizing: border-box;
        }
        .login-btn {
          width: 100%;
          padding: 15px;
          background: #6B8E23;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          transition: background 0.3s;
        }
        .login-btn:hover {
          background: #5a7a1e;
        }
        .demo-note {
          background: #f0f8ff;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
          border-left: 4px solid #6B8E23;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          color: #666;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">🥩 Jerky.com</div>
        <div>Premium Jerky Delivered Fresh</div>
      </div>
      
      <div class="container">
        <h2>Access Your Jerky.com Account</h2>
        
        <div class="demo-note">
          <strong>Customer Verification:</strong> Enter the email address from your jerky.com customer account. We'll verify you're a real jerky.com customer and log you in!
        </div>
        
        <form onsubmit="handleEmailLogin(event)">
          <div class="form-group">
            <label for="email">Your Jerky.com Email Address:</label>
            <input type="email" id="email" name="email" placeholder="customer@example.com" required>
          </div>
          
          <button type="submit" class="login-btn">🔑 Access Rankings with Jerky.com Account</button>
        </form>
        
        <div class="footer">
          Secure login powered by jerky.com customer accounts
        </div>
      </div>

      <script>
        async function handleEmailLogin(event) {
          event.preventDefault();
          
          const email = document.getElementById('email').value;
          const submitBtn = event.target.querySelector('button');
          
          submitBtn.disabled = true;
          submitBtn.textContent = '🔍 Verifying jerky.com customer...';
          
          try {
            const response = await fetch('/api/customer/email-login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email })
            });
            
            const result = await response.json();
            
            if (result.success) {
              // Show email sent confirmation
              document.body.innerHTML = \`
                <div style="text-align: center; padding: 50px; background: #6B8E23; color: white; font-family: Arial;">
                  <h2>📧 Check Your Email!</h2>
                  <p>\${result.message}</p>
                  <p>If you have a jerky.com account, the login link will expire in 30 minutes for your security.</p>
                  <br>
                  <p><small>You can close this window and check your email.</small></p>
                </div>
              \`;
            } else {
              alert('Customer verification failed: ' + result.error);
              submitBtn.disabled = false;
              submitBtn.textContent = '🔑 Access Rankings with Jerky.com Account';
            }
          } catch (error) {
            alert('Verification error: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = '🔑 Access Rankings with Jerky.com Account';
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Magic link email authentication endpoint
app.post('/api/customer/email-login', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    
    console.log(`🔍 Looking up jerky.com customer: ${email}`);
    
    // Look up customer in Shopify using Admin API
    const customerResponse = await fetch(`https://${JERKY_SHOP_DOMAIN}/admin/api/2023-10/customers/search.json?query=email:${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    if (!customerResponse.ok) {
      const errorText = await customerResponse.text();
      console.error('Failed to lookup customer in Shopify:', customerResponse.status, errorText);
      
      if (customerResponse.status === 401) {
        console.error('❌ Shopify API authentication failed. Please check Admin API access token.');
        return res.status(500).json({ error: 'Admin API authentication failed. Please check your Shopify access token.' });
      }
      
      return res.status(500).json({ error: 'Failed to verify customer account' });
    }
    
    const customerData = await customerResponse.json();
    const customers = customerData.customers || [];
    
    if (customers.length === 0) {
      console.log(`❌ No jerky.com customer found for email: ${email}`);
      // Return same success message to prevent email enumeration
      // Don't reveal whether email exists or not
      res.json({
        success: true,
        message: `If ${email} is a registered jerky.com customer, we've sent a login link to that address.`,
        email: email
      });
      return;
    }
    
    // Found valid jerky.com customer
    const shopifyCustomer = customers[0];
    const customer = {
      id: shopifyCustomer.id.toString(),
      email: shopifyCustomer.email,
      firstName: shopifyCustomer.first_name || 'Customer',
      lastName: shopifyCustomer.last_name || '',
      displayName: `${shopifyCustomer.first_name || 'Customer'} ${shopifyCustomer.last_name || ''}`.trim()
    };
    
    console.log(`✅ Found jerky.com customer: ${customer.displayName} (ID: ${customer.id})`);
    
    // Generate secure magic link token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store magic link in database
    if (!storage) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    await storage.createMagicLink({
      token,
      email: customer.email,
      shopifyCustomerId: customer.id,
      customerData: customer,
      expiresIn: 30 // 30 minutes
    });
    
    // Send magic link email
    const { sendEmail } = require('./server/replitmail.js');
    const magicLinkUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/api/customer/magic-login?token=${token}`;
    
    await sendEmail({
      to: customer.email,
      subject: '🔑 Your Jerky Rankings Login Link',
      html: `
        <h2>🥩 Welcome to Jerky Rankings!</h2>
        <p>Hi ${customer.firstName},</p>
        <p>Click the link below to securely access your jerky.com account on our rankings site:</p>
        <p><a href="${magicLinkUrl}" style="background: #6B8E23; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">🔑 Log In to Jerky Rankings</a></p>
        <p>This link will expire in 30 minutes for your security.</p>
        <p>If you didn't request this login, you can safely ignore this email.</p>
        <br>
        <p>Happy ranking!</p>
        <p>The Jerky.com Team</p>
      `,
      text: `
Hi ${customer.firstName},

Click this link to securely access your jerky.com account on our rankings site:
${magicLinkUrl}

This link will expire in 30 minutes for your security.

If you didn't request this login, you can safely ignore this email.

Happy ranking!
The Jerky.com Team
      `
    });
    
    console.log(`📧 Magic link sent to: ${customer.email}`);
    
    res.json({
      success: true,
      message: `If ${customer.email} is a registered jerky.com customer, we've sent a login link to that address.`,
      email: customer.email
    });
    
  } catch (error) {
    console.error('Magic link generation error:', error);
    res.status(500).json({ error: 'Failed to send login link. Please try again.' });
  }
});

// Magic link verification endpoint
app.get('/api/customer/magic-login', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>❌ Invalid Login Link</h2>
            <p>This login link is missing required information.</p>
            <p>Please request a new login link from rankings.jerky.com</p>
          </body>
        </html>
      `);
    }

    console.log(`🔗 Processing magic link token: ${token.substring(0, 8)}...`);

    if (!storage) {
      return res.status(500).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>❌ System Error</h2>
            <p>Database not available. Please try again later.</p>
          </body>
        </html>
      `);
    }

    // Find magic link in database
    const magicLink = await storage.findMagicLink(token);
    
    if (!magicLink) {
      return res.status(404).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>❌ Invalid Login Link</h2>
            <p>This login link is not valid or has already been used.</p>
            <p>Please request a new login link from rankings.jerky.com</p>
          </body>
        </html>
      `);
    }

    // Check if token is expired
    if (magicLink.expiresAt <= new Date()) {
      return res.status(410).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>⏰ Login Link Expired</h2>
            <p>This login link has expired for your security.</p>
            <p>Please request a new login link from rankings.jerky.com</p>
          </body>
        </html>
      `);
    }

    // Check if already used
    if (magicLink.used === 1) {
      return res.status(410).send(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h2>🔒 Login Link Already Used</h2>
            <p>This login link has already been used for security.</p>
            <p>Please request a new login link from rankings.jerky.com</p>
          </body>
        </html>
      `);
    }

    // Mark magic link as used
    await storage.useMagicLink(token);

    // Get customer data from magic link
    const customer = magicLink.customerData;
    
    console.log(`✅ Magic link verified for: ${customer.displayName} (${customer.email})`);

    // Create or update user in database
    const dbUser = await storage.createOrUpdateUser({
      shopifyCustomerId: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      displayName: customer.displayName,
      accessToken: null, // Don't store API secret in user records
      refreshToken: null,
    });

    // Create persistent database session (90-day expiration)
    const session = await storage.createSession({
      userId: dbUser.id,
      shopifyCustomerId: customer.id,
      accessToken: null,
      refreshToken: null,
      customerData: customer,
    });

    // Set HTTP-only cookie for 90-day persistence
    res.cookie('session_id', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
      path: '/'
    });

    console.log(`✅ 90-day session created for jerky.com customer: ${customer.displayName}`);

    // Redirect back to rankings app with session
    const redirectUrl = `https://${process.env.REPLIT_DEV_DOMAIN}/#login-success?sessionId=${session.id}`;
    
    res.send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px; background: #6B8E23; color: white;">
          <h2>🎉 Login Successful!</h2>
          <p>Hi ${customer.firstName}!</p>
          <p>You are now logged in with your jerky.com customer account.</p>
          <p>Redirecting to jerky rankings...</p>
          <script>
            // Store session and redirect
            if (window.opener) {
              // If opened from popup
              window.opener.postMessage({
                type: 'CUSTOMER_LOGIN_SUCCESS',
                sessionId: '${session.id}',
                customer: ${JSON.stringify(customer)}
              }, '*');
              window.close();
            } else {
              // Direct browser navigation
              window.location.href = '${redirectUrl}';
            }
          </script>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Magic link verification error:', error);
    res.status(500).send(`
      <html>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h2>❌ Authentication Error</h2>
          <p>Something went wrong during login. Please try again.</p>
          <p>Error: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

// Customer session status endpoint
app.get('/api/customer/status', async (req, res) => {
  try {
    // Check for session ID in HTTP-only cookie first, then query param (backwards compatibility)
    const sessionId = req.cookies.session_id || req.query.sessionId;
    
    if (!sessionId) {
      return res.json({ authenticated: false });
    }
    
    if (!storage) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    // Check if session exists and is valid (90-day expiration check included)
    const session = await storage.getSession(sessionId);
    
    if (session && session.customerData) {
      console.log(`✅ 90-day session validated for: ${session.customerData.displayName}`);
      return res.json({ 
        authenticated: true, 
        customer: session.customerData,
        sessionId: session.id 
      });
    } else {
      // Clear invalid cookie if it exists
      if (req.cookies.session_id) {
        res.clearCookie('session_id', { path: '/' });
      }
      return res.json({ authenticated: false });
    }
    
  } catch (error) {
    console.error('Session status check error:', error);
    res.json({ authenticated: false });
  }
});

// Shopify Products API endpoints
// Helper function to fetch all products from Shopify with cursor-based pagination
async function fetchAllShopifyProducts() {
  let allProducts = [];
  let pageInfo = null;
  const limit = 250; // Shopify's max per request
  let pageCount = 1;
  
  while (true) {
    const searchParams = new URLSearchParams({
      limit: limit,
      fields: 'id,title,handle,images,variants,vendor,product_type,tags'
    });
    
    // Add cursor for pagination (if we have one from previous page)
    if (pageInfo && pageInfo.next) {
      searchParams.set('page_info', pageInfo.next);
    } else {
      // Only set status on first page (not when using page_info)
      searchParams.set('status', 'active');
    }
    
    const shopifyUrl = `https://${JERKY_SHOP_DOMAIN}/admin/api/2023-10/products.json?${searchParams}`;
    
    const response = await fetch(shopifyUrl, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify Products API error:', response.status, errorText);
      throw new Error('Failed to fetch products from Shopify');
    }
    
    const data = await response.json();
    const products = data.products || [];
    
    if (products.length === 0) {
      break; // No more products
    }
    
    allProducts = allProducts.concat(products);
    console.log(`📄 Fetched page ${pageCount}: ${products.length} products (total so far: ${allProducts.length})`);
    
    // Check for pagination info in Link header
    const linkHeader = response.headers.get('Link');
    pageInfo = parseLinkHeader(linkHeader);
    
    if (!pageInfo || !pageInfo.next || products.length < limit) {
      break; // No more pages or last page
    }
    
    pageCount++;
  }
  
  console.log(`🛍️ Total products fetched from Shopify: ${allProducts.length}`);
  return allProducts;
}

// Helper function to parse Shopify's Link header for pagination
function parseLinkHeader(linkHeader) {
  if (!linkHeader) return null;
  
  const links = {};
  const parts = linkHeader.split(',');
  
  parts.forEach(part => {
    const section = part.split(';');
    if (section.length !== 2) return;
    
    const url = section[0].trim().slice(1, -1); // Remove < >
    const rel = section[1].trim().match(/rel="(.*)"/);
    
    if (rel) {
      const urlParams = new URL(url).searchParams;
      const pageInfo = urlParams.get('page_info');
      if (pageInfo) {
        links[rel[1]] = pageInfo;
      }
    }
  });
  
  return links;
}

app.get('/api/products/search', async (req, res) => {
  try {
    const { query = '', limit = 20, page = 1 } = req.query;
    
    console.log(`🔍 Searching products: "${query}", page: ${page}, limit: ${limit}`);
    
    // Fetch ALL products from Shopify (with pagination)
    let products = await fetchAllShopifyProducts();
    
    // If we have a search query, filter products client-side for partial title matches
    if (query && query.trim()) {
      const searchTerm = query.trim().toLowerCase();
      products = products.filter(product => 
        product.title.toLowerCase().includes(searchTerm) ||
        product.vendor.toLowerCase().includes(searchTerm) ||
        product.product_type.toLowerCase().includes(searchTerm) ||
        (product.tags && product.tags.toLowerCase().includes(searchTerm))
      );
      console.log(`🔍 Filtered to ${products.length} products matching "${query}"`);
    }
    
    console.log(`✅ Found ${products.length} products`);
    
    // Transform products for frontend
    const transformedProducts = products.map(product => ({
      id: product.id.toString(),
      title: product.title,
      handle: product.handle,
      vendor: product.vendor,
      productType: product.product_type,
      tags: product.tags,
      image: product.images?.[0]?.src || null,
      price: product.variants?.[0]?.price || '0.00',
      compareAtPrice: product.variants?.[0]?.compare_at_price || null,
    }));
    
    res.json({ 
      products: transformedProducts,
      hasMore: products.length >= parseInt(limit) // Simple pagination indicator
    });
    
  } catch (error) {
    console.error('Product search error:', error);
    res.status(500).json({ error: 'Product search failed' });
  }
});

// Save product ranking
app.post('/api/rankings/product', async (req, res) => {
  try {
    const { sessionId, productId, productData, ranking, rankingListId } = req.body;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!storage) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    // Verify session
    const session = await storage.getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    // Save product ranking
    const productRanking = await storage.saveProductRanking({
      userId: session.userId,
      shopifyProductId: productId,
      productData,
      ranking,
      rankingListId: rankingListId || 'default'
    });
    
    console.log(`✅ Product ranking saved: ${productData.title} at rank ${ranking}`);
    
    res.json({ success: true, ranking: productRanking });
    
  } catch (error) {
    console.error('Save product ranking error:', error);
    res.status(500).json({ error: 'Failed to save ranking' });
  }
});

// Save multiple product rankings (bulk save for auto-save)
app.post('/api/rankings/products', async (req, res) => {
  try {
    const { sessionId, rankingListId = 'default', rankings } = req.body;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!storage) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    // Verify session
    const session = await storage.getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const userId = session.userId;
    
    // Clear existing rankings for this user and list first
    await storage.clearUserProductRankings(userId, rankingListId);
    
    // Save all new rankings
    for (const ranking of rankings) {
      await storage.saveProductRanking({
        userId: userId,
        shopifyProductId: ranking.productData.id,
        productData: ranking.productData,
        ranking: ranking.ranking,
        rankingListId: rankingListId
      });
    }

    console.log(`✅ Bulk saved ${rankings.length} product rankings for user ${userId}`);
    res.json({ 
      success: true, 
      message: `Saved ${rankings.length} rankings` 
    });
  } catch (error) {
    console.error('❌ Error bulk saving rankings:', error);
    res.status(500).json({ error: 'Failed to save rankings' });
  }
});

// Get user's product rankings
app.get('/api/rankings/products', async (req, res) => {
  try {
    const { sessionId, rankingListId = 'default' } = req.query;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!storage) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    // Verify session
    const session = await storage.getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    // Get user's rankings
    const rankings = await storage.getUserProductRankings(session.userId, rankingListId);
    
    res.json({ rankings });
    
  } catch (error) {
    console.error('Get product rankings error:', error);
    res.status(500).json({ error: 'Failed to get rankings' });
  }
});

// Clear user's product rankings for a specific ranking list
app.delete('/api/rankings/products/clear', async (req, res) => {
  try {
    const { sessionId, rankingListId = 'default' } = req.query;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!storage) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    // Verify session
    const session = await storage.getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    // Clear user's rankings
    await storage.clearUserProductRankings(session.userId, rankingListId);
    
    console.log(`🗑️ Cleared rankings for user ${session.userId}, list: ${rankingListId}`);
    res.json({ success: true });
    
  } catch (error) {
    console.error('Clear product rankings error:', error);
    res.status(500).json({ error: 'Failed to clear rankings' });
  }
});

app.get('/api/customer/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).send('Missing authorization code or state');
    }
    
    // Verify state and get stored PKCE values
    const oauthSession = oauthSessions.get(state);
    if (!oauthSession) {
      return res.status(400).send('Invalid state parameter');
    }
    
    // Clean up used OAuth session
    oauthSessions.delete(state);
    
    // Get real Shopify endpoints
    const endpoints = await getCustomerAccountEndpoints();
    
    // Exchange code for access token with real Shopify
    const tokenResponse = await fetch(endpoints.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code: code,
        redirect_uri: `https://${process.env.REPLIT_DEV_DOMAIN}/api/customer/auth/callback`,
        code_verifier: oauthSession.codeVerifier
      })
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return res.status(400).send('Failed to exchange authorization code');
    }
    
    const tokens = await tokenResponse.json();
    console.log('✅ Successfully got Shopify access token');
    
    // Get real customer data from Shopify
    let customer;
    
    if (endpoints.userinfo_endpoint.includes('customer_account_api')) {
      // Use Customer Account API
      const customerResponse = await fetch(endpoints.userinfo_endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `
            query GetCustomer {
              customer {
                id
                email
                firstName
                lastName
                displayName
              }
            }
          `
        })
      });
      
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        customer = customerData.data?.customer;
      }
    } else {
      // Use Admin API to get customer data
      const customerResponse = await fetch(endpoints.userinfo_endpoint, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': tokens.access_token,
        }
      });
      
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        const customers = customerData.customers || [];
        if (customers.length > 0) {
          const shopifyCustomer = customers[0];
          customer = {
            id: shopifyCustomer.id.toString(),
            email: shopifyCustomer.email,
            firstName: shopifyCustomer.first_name,
            lastName: shopifyCustomer.last_name,
            displayName: `${shopifyCustomer.first_name} ${shopifyCustomer.last_name}`.trim()
          };
        }
      }
    }
    
    // Fallback if no customer data retrieved
    if (!customer) {
      console.log('No customer data retrieved, creating authenticated user profile');
      customer = {
        id: `jerky_${Date.now()}`,
        email: 'authenticated@jerky.com',
        firstName: 'Jerky',
        lastName: 'Customer', 
        displayName: 'Jerky Customer'
      };
    }
    
    // Save customer profile to database
    if (!storage) {
      return res.status(500).send('Database not available');
    }
    
    try {
      const dbUser = await storage.createOrUpdateUser({
        shopifyCustomerId: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        displayName: customer.displayName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      
      // Create persistent database session (90-day expiration)
      const session = await storage.createSession({
        userId: dbUser.id,
        shopifyCustomerId: customer.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        customerData: customer,
      });

      // Set HTTP-only cookie for 90-day persistence
      res.cookie('session_id', session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days in milliseconds
        path: '/'
      });
      
      console.log(`✅ Real Shopify customer logged in with 90-day session: ${customer.displayName || customer.firstName} (${customer.email})`);
      
    } catch (dbError) {
      console.error('Database error during login:', dbError);
      return res.status(500).send('Failed to save user profile');
    }
    
    // Return success page that closes popup and notifies parent window
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Login Successful</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #6B8E23, #8FBC8F);
            color: white;
          }
          .success-message {
            background: rgba(255, 255, 255, 0.1);
            padding: 30px;
            border-radius: 10px;
            max-width: 400px;
            margin: 0 auto;
          }
        </style>
      </head>
      <body>
        <div class="success-message">
          <h2>✅ Welcome ${customer.displayName || customer.firstName}!</h2>
          <p>You're successfully logged in to your jerky.com account.</p>
          <p>This window will close automatically...</p>
        </div>
        <script>
          // Store session ID and notify parent window
          if (window.opener) {
            window.opener.postMessage({
              type: 'CUSTOMER_LOGIN_SUCCESS',
              sessionId: '${session.id}',
              customer: ${JSON.stringify(customer)}
            }, '*');
          }
          setTimeout(() => {
            window.close();
          }, 2000);
        </script>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Customer OAuth callback error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Login Failed</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #dc3545, #c82333);
            color: white;
          }
        </style>
      </head>
      <body>
        <h2>❌ Login Failed</h2>
        <p>Unable to log in to your jerky.com account.</p>
        <p>Please try again or contact support.</p>
        <script>
          setTimeout(() => { window.close(); }, 3000);
        </script>
      </body>
      </html>
    `);
  }
});

// API endpoint to check customer authentication status
app.get('/api/customer/status', async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    
    if (!sessionId || !storage) {
      return res.json({ authenticated: false, customer: null });
    }
    
    // Get session from database (includes expiry check)
    const session = await storage.getSession(sessionId);
    
    if (session) {
      res.json({
        authenticated: true,
        customer: session.customerData
      });
    } else {
      res.json({
        authenticated: false,
        customer: null
      });
    }
  } catch (error) {
    console.error('Error checking session status:', error);
    res.json({ authenticated: false, customer: null });
  }
});

// API endpoint to logout customer
app.post('/api/customer/logout', async (req, res) => {
  try {
    // Check for session ID in cookie first, then body (backwards compatibility)
    const sessionId = req.cookies.session_id || req.body.sessionId;
    
    if (!sessionId || !storage) {
      return res.status(400).json({ error: 'Session ID required' });
    }
    
    // Get session before deleting for logging
    const session = await storage.getSession(sessionId);
    
    if (session) {
      await storage.deleteSession(sessionId);
      console.log(`🔌 Customer logged out: ${session.customerData?.email}`);
      
      // Clear the HTTP-only cookie
      res.clearCookie('session_id', { 
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
      
      res.json({ success: true, message: 'Logged out successfully' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// API endpoint to save user ranking
app.post('/api/customer/ranking', async (req, res) => {
  try {
    const sessionId = req.headers.authorization?.replace('Bearer ', '');
    
    if (!sessionId || !storage) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const session = await storage.getSession(sessionId);
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    if (!storage) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const { rankingName, rankingData, isPublic } = req.body;
    
    if (!rankingName || !rankingData) {
      return res.status(400).json({ error: 'Ranking name and data are required' });
    }
    
    const ranking = await storage.saveRanking(session.userId, {
      rankingName,
      rankingData,
      isPublic: isPublic || false
    });
    
    console.log(`💾 Ranking saved for user ${session.customerData.email}: "${rankingName}"`);
    
    res.json({
      success: true,
      ranking: {
        id: ranking.id,
        name: ranking.rankingName,
        isPublic: ranking.isPublic === 1
      }
    });
    
  } catch (error) {
    console.error('Error saving ranking:', error);
    res.status(500).json({ error: 'Failed to save ranking' });
  }
});

// API endpoint to get user rankings
app.get('/api/customer/rankings', async (req, res) => {
  try {
    const sessionId = req.query.sessionId;
    
    if (!sessionId || !storage) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const session = await storage.getSession(sessionId);
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    
    const rankings = await storage.getUserRankings(session.userId);
    
    res.json({
      rankings: rankings.map(r => ({
        id: r.id,
        name: r.rankingName,
        data: r.rankingData,
        isPublic: r.isPublic === 1,
        createdAt: r.createdAt
      }))
    });
    
  } catch (error) {
    console.error('Error fetching rankings:', error);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});

// API endpoint to get jerky products from jerky.com (using storefront API)
app.get('/api/jerky/products', async (req, res) => {
  try {
    // For now, return the static jerky data
    // Later we can integrate with jerky.com's Storefront API to get real products
    
    const jerkyProducts = jerkyData.map(product => ({
      ...product,
      shopifyId: `jerky-${product.id}`, // Add Shopify-like ID for compatibility
      description: `Delicious ${product.name} from ${product.brand}. Premium quality jerky with authentic flavors.`,
      image: null // Will be populated when we integrate with actual Shopify storefront
    }));

    res.json(jerkyProducts);
  } catch (error) {
    console.error('Error fetching jerky products:', error);
    res.status(500).json({ error: 'Failed to fetch jerky products' });
  }
});

// API endpoint to get top N jerky items
app.get('/api/jerky/top/:n', (req, res) => {
  const n = parseInt(req.params.n) || 5;
  const topJerky = jerkyData
    .sort((a, b) => b.rating - a.rating)
    .slice(0, Math.min(n, jerkyData.length));
  
  res.json({
    count: topJerky.length,
    items: topJerky
  });
});

// Main route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Periodic cleanup of expired sessions (every hour)
if (storage) {
  setInterval(async () => {
    try {
      const cleanedCount = await storage.cleanupExpiredSessions();
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
      }
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }, 60 * 60 * 1000); // Every hour
}

// Start server on all interfaces (required for Replit)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🥩 Jerky Top N Web server running on http://0.0.0.0:${PORT}`);
  console.log(`Visit the app at: http://localhost:${PORT}`);
});