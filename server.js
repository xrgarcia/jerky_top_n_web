const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const RankingStatsCache = require('./server/cache/RankingStatsCache');
const MetadataCache = require('./server/cache/MetadataCache');

const app = express();
const PORT = process.env.PORT || 5000;
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Detect environment and URL for Sentry tracking
const ENVIRONMENT = process.env.NODE_ENV || 
                   (process.env.REPL_SLUG && process.env.REPL_OWNER ? 'production' : 'development');
const APP_URL = process.env.REPLIT_DEV_DOMAIN || 
                (process.env.REPL_SLUG && process.env.REPL_OWNER ? 
                 `${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.replit.app` : 
                 'localhost:5000');

// Initialize Sentry for error monitoring and performance tracking
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: ENVIRONMENT,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    initialScope: {
      tags: {
        app_url: APP_URL,
        environment: ENVIRONMENT,
      },
    },
  });
  console.log(`✅ Sentry error monitoring initialized (${ENVIRONMENT} @ ${APP_URL})`);
} else {
  console.warn('⚠️  Sentry DSN not configured - error monitoring disabled');
}

// Startup validation - check critical environment variables
console.log('🚀 Starting Jerky Top N Web Application...');
console.log('🔍 Checking environment configuration...');

const requiredEnvVars = {
  SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
  SHOPIFY_ADMIN_ACCESS_TOKEN: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
  DATABASE_URL: process.env.DATABASE_URL
};

let shopifyAvailable = true;
let databaseAvailable = true;

// Check Shopify credentials
if (!requiredEnvVars.SHOPIFY_API_KEY || !requiredEnvVars.SHOPIFY_API_SECRET || !requiredEnvVars.SHOPIFY_ADMIN_ACCESS_TOKEN) {
  console.warn('⚠️  WARNING: Shopify credentials not configured');
  console.warn('   Missing one or more of: SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_ADMIN_ACCESS_TOKEN');
  console.warn('   Authentication and product features will be limited');
  shopifyAvailable = false;
} else {
  console.log('✅ Shopify credentials found');
}

// Check database connection
if (!requiredEnvVars.DATABASE_URL) {
  console.warn('⚠️  WARNING: DATABASE_URL not configured');
  console.warn('   User data persistence will not be available');
  databaseAvailable = false;
} else {
  console.log('✅ Database URL found');
}

// Import database storage
let storage;
try {
  const { storage: dbStorage } = require('./server/storage.js');
  storage = dbStorage;
  console.log('📂 Database storage connected');
  databaseAvailable = true;
} catch (err) {
  console.error('❌ Database storage failed to load:', err.message);
  console.warn('   Continuing without database - user sessions will not persist');
  databaseAvailable = false;
}

// Store for temporary OAuth sessions only (PKCE during OAuth flow)
const oauthSessions = new Map(); // For PKCE during OAuth flow
// Customer sessions are now stored in PostgreSQL database for persistence

// Jerky.com shop domain for customer authentication
const JERKY_SHOP_DOMAIN = 'jerky-com.myshopify.com';

// Get the application domain from request (works in both dev and production)
function getAppDomainFromRequest(req) {
  // Use the host header from the request (works for both dev and production)
  const host = req.get('host');
  if (host) {
    return host;
  }
  
  // Fallback to environment-based detection
  // In production deployments, use REPL_SLUG and REPL_OWNER
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.replit.app`;
  }
  // In development, use REPLIT_DEV_DOMAIN
  if (process.env.REPLIT_DEV_DOMAIN) {
    return process.env.REPLIT_DEV_DOMAIN;
  }
  // Fallback
  return 'localhost:5000';
}

// For startup logging only - not used for actual URLs
const APP_DOMAIN = process.env.REPLIT_DEV_DOMAIN || 
                   (process.env.REPL_SLUG && process.env.REPL_OWNER ? 
                    `${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.replit.app` : 
                    'localhost:5000');

console.log('🔧 Shopify Customer Authentication Configuration:');
console.log('🏪  Shop Domain:', JERKY_SHOP_DOMAIN);
console.log('🌐  App Domain:', APP_DOMAIN);
console.log('🔑  Using Customer Account API for jerky.com accounts');

const emailService = require('./server/services/EmailService.js');

// Configure Express to trust proxy (required for Replit)
app.set('trust proxy', true);

// Parse JSON bodies and cookies
app.use(express.json({ limit: '1mb' }));
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
    if (!shopifyAvailable) {
      console.error('🚫 Authentication unavailable: Shopify credentials not configured');
      return res.status(503).json({ 
        error: 'Authentication service unavailable',
        message: 'Please configure Shopify credentials in deployment settings'
      });
    }
    
    console.log('🔑 Starting email-based customer authentication for jerky.com');
    
    const appDomain = getAppDomainFromRequest(req);
    
    // Return our email login form URL
    res.json({
      authUrl: `https://${appDomain}/customer-login`,
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
    if (!shopifyAvailable) {
      console.error('🚫 Login unavailable: Shopify credentials not configured');
      return res.status(503).json({ 
        error: 'Login service unavailable',
        message: 'Please configure Shopify credentials in deployment settings'
      });
    }
    
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
    
    // Send magic link email using custom SMTP
    const emailService = require('./server/services/EmailService.js');
    const appDomain = getAppDomainFromRequest(req);
    const magicLinkUrl = `https://${appDomain}/api/customer/magic-login?token=${token}`;
    
    await emailService.sendMagicLink({
      to: customer.email,
      magicLink: magicLinkUrl,
      customerName: customer.firstName
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
    const appDomain = getAppDomainFromRequest(req);
    const redirectUrl = `https://${appDomain}/#login-success?sessionId=${session.id}`;
    
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
      // Get user from database to include role
      const user = await storage.getUserById(session.userId);
      
      console.log(`✅ 90-day session validated for: ${session.customerData.displayName}`);
      return res.json({ 
        authenticated: true, 
        customer: session.customerData,
        sessionId: session.id,
        role: user?.role || 'user'
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

// 30-minute product cache
const productCache = {
  data: null,
  timestamp: null,
  isLoading: false,
  isStale: false,
  TTL: 30 * 60 * 1000 // 30 minutes in milliseconds
};

// 30-minute ranking statistics cache (OOP implementation)
const rankingStatsCache = new RankingStatsCache(30);

// 30-minute metadata cache (OOP implementation)
const metadataCache = new MetadataCache(30);

// Check if cache is valid (within 30-minute TTL)
function isCacheValid() {
  if (!productCache.data || !productCache.timestamp) {
    return false;
  }
  const now = Date.now();
  const cacheAge = now - productCache.timestamp;
  return cacheAge < productCache.TTL && !productCache.isStale;
}

// Get cache age in minutes for logging
function getCacheAgeMinutes() {
  if (!productCache.timestamp) return 0;
  return Math.floor((Date.now() - productCache.timestamp) / (60 * 1000));
}

// Start background cache rehydration
async function startCacheRehydration() {
  if (productCache.isLoading) {
    console.log('🔄 Cache rehydration already in progress, skipping duplicate request');
    return;
  }
  
  console.log('🔄 Starting background cache rehydration...');
  productCache.isLoading = true;
  
  try {
    const freshProducts = await fetchProductsFromShopify();
    
    // Update cache with fresh data and mark as not stale
    productCache.data = freshProducts;
    productCache.timestamp = Date.now();
    productCache.isStale = false;
    productCache.isLoading = false;
    
    // Schedule next automatic invalidation
    scheduleNextCacheInvalidation();
    
    console.log(`✅ Cache rehydrated with ${freshProducts.length} products, next invalidation scheduled`);
  } catch (error) {
    console.error('❌ Cache rehydration failed:', error);
    productCache.isLoading = false;
    // Keep existing cache data (even if stale) for fallback
    console.log(`⚠️ Keeping stale cache as fallback after rehydration failure`);
  }
}

// Set up automatic cache invalidation timer
function scheduleNextCacheInvalidation() {
  // Clear any existing timer
  if (productCache.invalidationTimer) {
    clearTimeout(productCache.invalidationTimer);
  }
  
  // Schedule invalidation in 30 minutes
  productCache.invalidationTimer = setTimeout(() => {
    console.log('⏰ Cache TTL expired (30 minutes), marking as stale');
    // Mark cache as stale but keep data for fallback
    productCache.isStale = true;
    // Start background rehydration immediately
    startCacheRehydration();
  }, productCache.TTL);
  
  console.log(`⏰ Next cache invalidation scheduled in 30 minutes`);
}

// Helper function to fetch all products from Shopify with cursor-based pagination (actual API calls)
async function fetchProductsFromShopify() {
  if (!shopifyAvailable) {
    console.error('❌ Cannot fetch products: Shopify credentials not configured');
    throw new Error('Shopify credentials not configured');
  }
  
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
  
  // Filter to only include products with "rankable" tag
  const rankableProducts = allProducts.filter(product => {
    if (!product.tags) return false;
    
    // Tags can be a comma-separated string or an array
    const tags = Array.isArray(product.tags) 
      ? product.tags 
      : product.tags.split(',').map(tag => tag.trim().toLowerCase());
    
    return tags.includes('rankable');
  });
  
  console.log(`✅ Filtered to ${rankableProducts.length} rankable products (out of ${allProducts.length} total)`);
  return rankableProducts;
}

// Main function to get products (checks cache first, then fetches if needed)
async function fetchAllShopifyProducts() {
  // Check if cache is valid and return cached data
  if (isCacheValid()) {
    const cacheAge = getCacheAgeMinutes();
    console.log(`💾 Cache HIT: Returning ${productCache.data.length} products from cache (age: ${cacheAge} minutes)`);
    return { products: productCache.data, fromCache: true };
  }
  
  // Cache miss or expired - need to fetch fresh data
  const cacheAge = getCacheAgeMinutes();
  const cacheStatus = !productCache.data ? 'No cached data' : 
                      productCache.isStale ? `Cache stale (age: ${cacheAge} minutes)` : 
                      `Cache expired (age: ${cacheAge} minutes)`;
  console.log(`🚫 Cache MISS: ${cacheStatus}`);
  
  // If cache is currently being loaded by another request, wait for it
  if (productCache.isLoading) {
    console.log('⏳ Another request is already loading products, waiting...');
    // Wait for the loading to complete (with timeout)
    let attempts = 0;
    while (productCache.isLoading && attempts < 30) { // Max 30 seconds wait
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    // If loading completed successfully, return cached data
    if (isCacheValid()) {
      console.log(`✅ Waited for cache load, returning ${productCache.data.length} products`);
      return { products: productCache.data, fromCache: true };
    }
    
    // If still stale/invalid after waiting, use stale cache as fallback
    if (productCache.data) {
      const cacheAge = getCacheAgeMinutes();
      console.log(`⚠️ Load timed out, using stale cache as fallback (age: ${cacheAge} minutes, ${productCache.data.length} products)`);
      return { products: productCache.data, fromCache: true };
    }
  }
  
  // Start loading fresh data
  console.log('🔄 Fetching fresh products from Shopify API...');
  productCache.isLoading = true;
  
  try {
    const freshProducts = await fetchProductsFromShopify();
    
    // Update cache with fresh data and mark as not stale
    productCache.data = freshProducts;
    productCache.timestamp = Date.now();
    productCache.isStale = false;
    productCache.isLoading = false;
    
    // Schedule automatic invalidation in 30 minutes
    scheduleNextCacheInvalidation();
    
    console.log(`✅ Cache UPDATED: Loaded ${freshProducts.length} products, valid for 30 minutes`);
    return { products: freshProducts, fromCache: false };
    
  } catch (error) {
    productCache.isLoading = false;
    console.error('❌ Failed to fetch products from Shopify:', error);
    
    // If we have stale cache data, return it as fallback
    if (productCache.data) {
      const cacheAge = getCacheAgeMinutes();
      console.log(`⚠️ Using stale cache as fallback (age: ${cacheAge} minutes, ${productCache.data.length} products)`);
      return { products: productCache.data, fromCache: true };
    }
    
    // No cache data available, re-throw error
    throw error;
  }
}

// Lightweight helper to get just the product count (optimized for achievements endpoint)
function getRankableProductCount() {
  // If cache has data (even if stale), return count immediately
  if (productCache.data && productCache.data.length > 0) {
    return productCache.data.length;
  }
  
  // Default fallback (will trigger fetch on first request)
  return 89; // Default estimate based on current catalog
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

// Get animal categories with product counts
app.get('/api/products/animals', async (req, res) => {
  try {
    if (!storage) {
      return res.json({ animals: [] });
    }
    
    const { db } = require('./server/db.js');
    const ProductsMetadataService = require('./server/services/ProductsMetadataService');
    const metadataService = new ProductsMetadataService(db);
    
    const animals = await metadataService.getAnimalCategories();
    
    res.json({ animals });
  } catch (error) {
    console.error('Error fetching animal categories:', error);
    Sentry.captureException(error, {
      tags: { service: 'products', endpoint: '/api/products/animals' }
    });
    res.status(500).json({ error: 'Failed to fetch animal categories' });
  }
});

// Get all products with their ranking counts
app.get('/api/products/all', async (req, res) => {
  try {
    if (!shopifyAvailable) {
      console.warn('⚠️  Products unavailable: Shopify credentials not configured');
      return res.status(503).json({ 
        error: 'Products service unavailable',
        message: 'Please configure Shopify credentials in deployment settings',
        products: []
      });
    }
    
    const { query = '' } = req.query;
    
    console.log(`🛍️ Fetching all products with ranking counts, query: "${query}"`);
    
    // Use unified ProductsService for consistent data retrieval
    if (!storage) {
      return res.json({ products: [], total: 0 });
    }
    
    const { db } = require('./server/db.js');
    const ProductsService = require('./server/services/ProductsService');
    const ProductsMetadataService = require('./server/services/ProductsMetadataService');
    
    const metadataService = new ProductsMetadataService(db);
    
    // Create service with dependency injection (using shared cache instances)
    const productsService = new ProductsService(
      db,
      fetchAllShopifyProducts,
      (products) => metadataService.syncProductsMetadata(products),
      metadataCache,
      rankingStatsCache
    );
    
    // Get all products with complete data (Shopify + metadata + rankings)
    const enrichedProducts = await productsService.getAllProducts({
      query,
      includeMetadata: true,
      includeRankingStats: true
    });
    
    // Log search asynchronously (non-blocking)
    if (query && query.trim()) {
      const searchTerm = query.trim();
      const resultCount = enrichedProducts.length;
      
      // Try to get userId from session
      let userId = null;
      try {
        const sessionId = req.cookies.session_id || req.query.sessionId;
        if (sessionId) {
          const session = await storage.getSession(sessionId);
          if (session) {
            userId = session.userId;
          }
        }
      } catch (err) {
        // Continue without userId
      }
      
      // Fire-and-forget logging
      storage.logProductSearch(searchTerm, resultCount, userId, 'products').catch(err => {
        console.error('Failed to log search:', err);
      });
    }
    
    res.json({ 
      products: enrichedProducts,
      total: enrichedProducts.length
    });
    
  } catch (error) {
    console.error('Error fetching products with rankings:', error);
    Sentry.captureException(error, {
      tags: { service: 'products', endpoint: '/api/products/all' },
      extra: { query: req.query.query }
    });
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.get('/api/products/search', async (req, res) => {
  try {
    const { query = '', limit = 20, page = 1, sort = 'name-asc' } = req.query;
    
    console.log(`🔍 Searching products: "${query}", page: ${page}, limit: ${limit}, sort: ${sort}`);
    
    // Use unified ProductsService with shared cache instances
    const { db } = require('./server/db.js');
    const ProductsService = require('./server/services/ProductsService');
    const ProductsMetadataService = require('./server/services/ProductsMetadataService');
    
    const metadataService = new ProductsMetadataService(db);
    
    const productsService = new ProductsService(
      db,
      fetchAllShopifyProducts,
      (products) => metadataService.syncProductsMetadata(products),
      metadataCache,
      rankingStatsCache
    );
    
    // Get products with metadata and ranking stats
    const enrichedProducts = await productsService.getAllProducts({
      query,
      includeMetadata: true,
      includeRankingStats: true
    });
    
    console.log(`✅ Found ${enrichedProducts.length} products`);
    
    // Clone products array to avoid mutating the cache
    const products = [...enrichedProducts];
    
    // Apply server-side sorting
    const [field, order] = sort.split('-');
    const isAsc = order === 'asc';
    
    products.sort((a, b) => {
      let aVal, bVal;
      
      switch(field) {
        case 'name':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'recent':
          aVal = a.lastRankedAt || '1970-01-01';
          bVal = b.lastRankedAt || '1970-01-01';
          break;
        case 'avgrank':
          aVal = parseFloat(a.avgRank) || 9999;
          bVal = parseFloat(b.avgRank) || 9999;
          break;
        case 'totalranks':
          aVal = parseInt(a.rankingCount) || 0;
          bVal = parseInt(b.rankingCount) || 0;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return isAsc ? -1 : 1;
      if (aVal > bVal) return isAsc ? 1 : -1;
      return 0;
    });
    
    // Apply pagination after sorting
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    const transformedProducts = products.slice(startIndex, endIndex);
    const totalProducts = products.length;
    
    // Log search asynchronously (non-blocking)
    if (query && query.trim() && storage) {
      const searchTerm = query.trim();
      const resultCount = transformedProducts.length;
      
      // Try to get userId from session
      let userId = null;
      try {
        const sessionId = req.cookies.session_id || req.query.sessionId;
        if (sessionId) {
          const session = await storage.getSession(sessionId);
          if (session) {
            userId = session.userId;
          }
        }
      } catch (err) {
        // Continue without userId
      }
      
      // Fire-and-forget logging
      storage.logProductSearch(searchTerm, resultCount, userId, 'product_rankings').catch(err => {
        console.error('Failed to log search:', err);
      });
    }
    
    res.json({ 
      products: transformedProducts,
      hasMore: endIndex < totalProducts, // True if there are more products beyond the current page
      total: totalProducts,
      page: pageNum,
      limit: limitNum
    });
    
  } catch (error) {
    console.error('Product search error:', error);
    Sentry.captureException(error, {
      tags: { service: 'products', endpoint: '/api/products/search' },
      extra: { query: req.query.query, limit: req.query.limit, page: req.query.page }
    });
    res.status(500).json({ error: 'Product search failed' });
  }
});

// Get rankable products for authenticated user (excludes already-ranked products)
app.get('/api/products/rankable', async (req, res) => {
  try {
    const { query = '', limit = 20, page = 1, sort = 'name-asc' } = req.query;
    
    // Get session for user authentication
    const sessionId = req.cookies.session_id || req.query.sessionId;
    if (!sessionId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const session = await storage.getSession(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const userId = session.userId;
    console.log(`🎯 Fetching rankable products for user ${userId}: page ${page}, limit ${limit}, sort ${sort}`);
    
    // Use unified ProductsService with shared cache instances
    const { db } = require('./server/db.js');
    const ProductsService = require('./server/services/ProductsService');
    const ProductsMetadataService = require('./server/services/ProductsMetadataService');
    
    const metadataService = new ProductsMetadataService(db);
    
    const productsService = new ProductsService(
      db,
      fetchAllShopifyProducts,
      (products) => metadataService.syncProductsMetadata(products),
      metadataCache,
      rankingStatsCache
    );
    
    // Get products excluding user's already-ranked products
    const enrichedProducts = await productsService.getRankableProductsForUser(userId, {
      query,
      rankingListId: 'default',  // Must match the rankingListId used when saving rankings
      includeMetadata: true,
      includeRankingStats: true
    });
    
    // Clone products array to avoid mutating the cache
    const products = [...enrichedProducts];
    
    // Apply server-side sorting
    const [field, order] = sort.split('-');
    const isAsc = order === 'asc';
    
    products.sort((a, b) => {
      let aVal, bVal;
      
      switch(field) {
        case 'name':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'recent':
          aVal = a.lastRankedAt || '1970-01-01';
          bVal = b.lastRankedAt || '1970-01-01';
          break;
        case 'avgrank':
          aVal = parseFloat(a.avgRank) || 9999;
          bVal = parseFloat(b.avgRank) || 9999;
          break;
        case 'totalranks':
          aVal = parseInt(a.rankingCount) || 0;
          bVal = parseInt(b.rankingCount) || 0;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return isAsc ? -1 : 1;
      if (aVal > bVal) return isAsc ? 1 : -1;
      return 0;
    });
    
    // Apply pagination after sorting
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    
    const transformedProducts = products.slice(startIndex, endIndex);
    const totalProducts = products.length;
    
    console.log(`✅ Returning ${transformedProducts.length} rankable products (${totalProducts} total unranked)`);
    
    res.json({ 
      products: transformedProducts,
      hasMore: endIndex < totalProducts,
      total: totalProducts,
      page: pageNum,
      limit: limitNum
    });
    
  } catch (error) {
    console.error('Rankable products error:', error);
    Sentry.captureException(error, {
      tags: { service: 'products', endpoint: '/api/products/rankable' },
      extra: { query: req.query.query, limit: req.query.limit, page: req.query.page }
    });
    res.status(500).json({ error: 'Failed to fetch rankable products' });
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
    
    // Invalidate ranking stats cache since data changed
    rankingStatsCache.invalidate();
    
    // Invalidate home stats cache since rankings affect home page stats
    if (gamificationServices?.homeStatsService) {
      gamificationServices.homeStatsService.invalidateCache();
    }
    
    // Invalidate leaderboard cache since rankings affect top rankers
    if (gamificationServices?.leaderboardManager) {
      gamificationServices.leaderboardManager.leaderboardCache.invalidate();
    }
    
    console.log(`✅ Product ranking saved: ${productData.title} at rank ${ranking}`);
    
    res.json({ success: true, ranking: productRanking });
    
  } catch (error) {
    console.error('Save product ranking error:', error);
    Sentry.captureException(error, {
      tags: { service: 'rankings', endpoint: '/api/rankings/product' },
      extra: { productId: req.body.productId, ranking: req.body.ranking }
    });
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
    
    // Validate rankings for duplicates
    const productIds = rankings.map(r => r.productData.id);
    const uniqueProductIds = new Set(productIds);
    
    if (productIds.length !== uniqueProductIds.size) {
      // Find duplicate product IDs
      const duplicates = productIds.filter((id, index) => productIds.indexOf(id) !== index);
      console.error(`⚠️ Duplicate product IDs detected in rankings:`, duplicates);
      return res.status(400).json({ 
        error: 'Duplicate products detected in rankings', 
        duplicates: [...new Set(duplicates)] 
      });
    }
    
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
    
    // Invalidate ranking stats cache since data changed
    rankingStatsCache.invalidate();
    
    // Invalidate leaderboard position cache since rankings changed
    if (gamificationServices?.leaderboardManager) {
      gamificationServices.leaderboardManager.positionCache.invalidateAll();
    }
    
    // Invalidate home stats cache since rankings affect home page stats
    if (gamificationServices?.homeStatsService) {
      gamificationServices.homeStatsService.invalidateCache();
    }
    
    // Invalidate leaderboard cache since rankings affect top rankers
    if (gamificationServices?.leaderboardManager) {
      gamificationServices.leaderboardManager.leaderboardCache.invalidate();
    }

    console.log(`✅ Bulk saved ${rankings.length} product rankings for user ${userId}`);
    
    // Process gamification asynchronously to avoid slowing down the response
    if (gamificationServices && rankings.length > 0) {
      // Don't await this - let it run in the background
      (async () => {
        try {
          console.log(`🎮 Starting async gamification for user ${userId}`);
          const { achievementManager, leaderboardManager, streakManager } = gamificationServices;
          
          // Update daily ranking streak
          console.log(`🔥 Updating streak for user ${userId}...`);
          const streakResult = await streakManager.updateStreak(userId, 'daily_rank');
          console.log(`🔥 Streak update result:`, streakResult);
          
          // Broadcast streak update via WebSocket if streak changed
          if (streakResult && (streakResult.continued || streakResult.broken) && io) {
            io.to(`user:${userId}`).emit('streak:updated', streakResult);
            
            if (streakResult.continued) {
              console.log(`🔥 User ${userId} continued streak: ${streakResult.currentStreak} days`);
            } else if (streakResult.broken) {
              console.log(`💔 User ${userId} broke streak: was ${streakResult.previousStreak} days`);
            }
          }
          
          // Get updated user stats
          const userStats = await leaderboardManager.getUserStats(userId);
          const position = await leaderboardManager.getUserPosition(userId);
          const streaks = await streakManager.getUserStreaks(userId);
          const dailyStreak = streaks.find(s => s.streakType === 'daily_rank');
          
          // Get total rankable products count for dynamic achievement
          const { products } = await fetchAllShopifyProducts();
          const totalRankableProducts = products.length;
          
          // Calculate completed animal categories using service method (DRY principle)
          const completedAnimalCategories = await leaderboardManager.getCompletedAnimalCategories(
            userId,
            gamificationServices.productsService
          );
          
          const stats = {
            ...userStats,
            leaderboardPosition: position.rank || 999,
            currentStreak: dailyStreak?.currentStreak || 0,
            totalRankableProducts,
            completedAnimalCategories,
          };
          
          // Check and award flavor coins for newly ranked products
          const { flavorCoinManager, collectionManager } = gamificationServices;
          const newFlavorCoins = [];
          
          if (flavorCoinManager) {
            for (const ranking of rankings) {
              const coins = await flavorCoinManager.checkAndAwardFlavorCoins(userId, ranking.productData.id);
              newFlavorCoins.push(...coins);
            }
            
            if (newFlavorCoins.length > 0) {
              console.log(`🪙 User ${userId} earned ${newFlavorCoins.length} new Flavor Coin(s)`);
              if (io) {
                io.to(`user:${userId}`).emit('flavor_coins:earned', { coins: newFlavorCoins });
              }
            }
          }
          
          // Update dynamic collection progress
          if (collectionManager) {
            const collectionUpdates = await collectionManager.checkAndUpdateDynamicCollections(userId);
            
            if (collectionUpdates.length > 0) {
              console.log(`📚 User ${userId} updated ${collectionUpdates.length} collection(s)`);
              if (io) {
                io.to(`user:${userId}`).emit('collections:updated', { updates: collectionUpdates });
              }
            }
          }
          
          // Check for new achievements
          const newAchievements = await achievementManager.checkAndAwardAchievements(userId, stats);
          
          // Invalidate home stats cache if achievements were earned (affects recent achievements)
          if (newAchievements.length > 0 && gamificationServices?.homeStatsService) {
            gamificationServices.homeStatsService.invalidateCache();
          }
          
          // Invalidate leaderboard cache if achievements were earned (affects engagement scores)
          if (newAchievements.length > 0 && gamificationServices?.leaderboardManager) {
            gamificationServices.leaderboardManager.leaderboardCache.invalidate();
          }
          
          // Broadcast new achievements via WebSocket
          if (newAchievements.length > 0 && io) {
            io.to(`user:${userId}`).emit('achievements:earned', { achievements: newAchievements });
            console.log(`🏆 User ${userId} earned ${newAchievements.length} new achievement(s):`, 
              newAchievements.map(a => a.name).join(', '));
          }
        } catch (gamificationError) {
          console.error('Error processing gamification:', gamificationError);
          Sentry.captureException(gamificationError, {
            tags: { service: 'gamification', operation: 'async_update' },
            extra: { userId, rankingCount: rankings.length }
          });
        }
      })();
    }
    
    res.json({ 
      success: true, 
      message: `Saved ${rankings.length} rankings` 
    });
  } catch (error) {
    console.error('❌ Error bulk saving rankings:', error);
    Sentry.captureException(error, {
      tags: { service: 'rankings', endpoint: '/api/rankings/products', operation: 'bulk_save' },
      extra: { rankingCount: req.body.rankings?.length, rankingListId: req.body.rankingListId }
    });
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
    Sentry.captureException(error, {
      tags: { service: 'rankings', endpoint: '/api/rankings/products', operation: 'get' },
      extra: { rankingListId: req.query.rankingListId }
    });
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
    
    // Invalidate ranking stats cache since data changed
    rankingStatsCache.invalidate();
    
    console.log(`🗑️ Cleared rankings for user ${session.userId}, list: ${rankingListId}`);
    res.json({ success: true });
    
  } catch (error) {
    console.error('Clear product rankings error:', error);
    Sentry.captureException(error, {
      tags: { service: 'rankings', endpoint: '/api/rankings/products/clear', operation: 'clear' },
      extra: { rankingListId: req.query.rankingListId }
    });
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
        redirect_uri: `https://${getAppDomainFromRequest(req)}/api/customer/auth/callback`,
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

// Community API endpoints
// GET /api/community/users - List all users with ranking statistics
app.get('/api/community/users', async (req, res) => {
  try {
    if (!storage || !gamificationServices) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const communityService = gamificationServices.communityService;
    const users = await communityService.getCommunityUsers(limit, offset);
    
    res.json({
      users: users.map(user => ({
        id: user.id,
        displayShort: user.displayName,
        rankedCount: user.rankedCount,
        rankingListsCount: user.rankingListsCount
      })),
      limit,
      offset
    });
    
  } catch (error) {
    console.error('Error fetching community users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/products/:productId/stats - Get product statistics
app.get('/api/products/:productId/stats', async (req, res) => {
  try {
    const { productId } = req.params;
    
    if (!storage) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const { db } = require('./server/db.js');
    const { sql } = require('drizzle-orm');
    
    // Get product statistics from rankings
    const stats = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT pr.user_id) as unique_rankers,
        AVG(pr.ranking) as avg_ranking,
        COUNT(*) as total_rankings,
        MIN(pr.ranking) as best_ranking,
        MAX(pr.ranking) as worst_ranking
      FROM product_rankings pr
      WHERE pr.shopify_product_id = ${productId}
    `);
    
    const result = stats.rows[0];
    
    res.json({
      productId,
      uniqueRankers: parseInt(result.unique_rankers) || 0,
      avgRanking: result.avg_ranking ? parseFloat(result.avg_ranking).toFixed(2) : null,
      totalRankings: parseInt(result.total_rankings) || 0,
      bestRanking: result.best_ranking ? parseInt(result.best_ranking) : null,
      worstRanking: result.worst_ranking ? parseInt(result.worst_ranking) : null
    });
  } catch (error) {
    console.error('Product stats fetch error:', error);
    res.status(500).json({ error: 'Failed to load product statistics' });
  }
});

// GET /api/profile - Get current user profile
app.get('/api/profile', async (req, res) => {
  try {
    const sessionId = req.cookies.session_id;
    
    if (!sessionId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!storage) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    // Get session to find user ID
    const session = await storage.getSession(sessionId);
    
    if (!session) {
      return res.status(401).json({ error: 'Session expired' });
    }
    
    const { db } = require('./server/db.js');
    const { sql } = require('drizzle-orm');
    
    // Get user profile with ranking stats
    const result = await db.execute(sql`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.display_name,
        COUNT(DISTINCT pr.shopify_product_id) as ranked_count,
        COUNT(DISTINCT pr.ranking_list_id) as ranking_lists_count
      FROM users u
      LEFT JOIN product_rankings pr ON u.id = pr.user_id
      WHERE u.id = ${session.userId}
      GROUP BY u.id, u.first_name, u.last_name, u.email, u.display_name
    `);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      displayName: user.display_name,
      rankedCount: parseInt(user.ranked_count) || 0,
      rankingListsCount: parseInt(user.ranking_lists_count) || 0
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// GET /api/community/users/:userId/rankings - Get a specific user's rankings (public view)
app.get('/api/community/users/:userId/rankings', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!storage) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const { db } = require('./server/db.js');
    const { sql } = require('drizzle-orm');
    
    // Get user info
    const userResult = await db.execute(sql`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.display_name,
        COUNT(DISTINCT pr.shopify_product_id) as ranked_count,
        COUNT(DISTINCT pr.ranking_list_id) as ranking_lists_count
      FROM users u
      LEFT JOIN product_rankings pr ON u.id = pr.user_id
      WHERE u.id = ${userId}
      GROUP BY u.id, u.first_name, u.last_name, u.display_name
    `);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Format displayShort using CommunityService
    const CommunityService = require('./server/services/CommunityService');
    const communityService = new CommunityService(db);
    const displayShort = communityService.formatDisplayName(user);
    
    // Get user's rankings with product data
    const rankingsResult = await db.execute(sql`
      SELECT 
        pr.shopify_product_id,
        pr.ranking,
        pr.product_data,
        pr.ranking_list_id
      FROM product_rankings pr
      WHERE pr.user_id = ${userId}
      ORDER BY pr.ranking ASC, pr.created_at DESC
    `);
    
    const rankings = rankingsResult.rows.map(row => {
      // Parse product_data if it's stored as a string
      let productData = row.product_data;
      if (typeof productData === 'string') {
        try {
          productData = JSON.parse(productData);
        } catch (error) {
          console.error('Failed to parse product_data:', error);
          productData = {};
        }
      }
      
      return {
        productId: row.shopify_product_id,
        rank: row.ranking,
        product: {
          title: productData.title || 'Unknown Product',
          vendor: productData.vendor || 'Unknown Brand',
          price: productData.price || '0.00',
          image: productData.image || null
        },
        listId: row.ranking_list_id
      };
    });
    
    res.json({
      user: {
        id: user.id,
        displayShort,
        rankedCount: parseInt(user.ranked_count) || 0,
        rankingListsCount: parseInt(user.ranking_lists_count) || 0
      },
      rankings
    });
  } catch (error) {
    console.error('User rankings fetch error:', error);
    res.status(500).json({ error: 'Failed to load user rankings' });
  }
});

// GET /api/community/search - Search users by name or products they've ranked
app.get('/api/community/search', async (req, res) => {
  try {
    if (!storage || !gamificationServices) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit) || 20;
    
    if (!query.trim()) {
      return res.json({ users: [], query, limit });
    }
    
    const communityService = gamificationServices.communityService;
    const users = await communityService.searchCommunityUsers(query, limit);
    
    res.json({
      users: users.map(user => ({
        id: user.id,
        displayShort: user.displayName,
        rankedCount: user.rankedCount,
        type: user.type
      })),
      query,
      limit
    });
    
  } catch (error) {
    console.error('Error searching community users:', error);
    res.status(500).json({ error: 'Failed to search users' });
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

// GET /api/search/global - Unified search for products and users
app.get('/api/search/global', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit) || 5;
    
    if (!query.trim()) {
      return res.json({ products: [], users: [] });
    }
    
    // Search products from Shopify using intelligent multi-word search
    const allProductsResult = await fetchAllShopifyProducts();
    const allProducts = allProductsResult.products || [];
    const searchTerm = query.trim().toLowerCase();
    
    // Split search query into individual words
    const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0);
    
    const matchedProducts = allProducts.filter(product => {
      // Combine all searchable fields into one string
      const searchableText = [
        product.title,
        product.vendor,
        product.product_type,
        product.tags || ''
      ].join(' ').toLowerCase();
      
      // Check if ALL search words exist in the searchable text (in any order)
      return searchWords.every(word => searchableText.includes(word));
    });
    
    const products = matchedProducts.slice(0, limit).map(product => ({
      id: product.id.toString(),
      title: product.title,
      vendor: product.vendor,
      price: product.variants?.[0]?.price || '0.00',
      image: product.images?.[0]?.src || null,
      type: 'product'
    }));
    
    // Search users from community
    const { db } = require('./server/db.js');
    const { sql } = require('drizzle-orm');
    const usersResult = await db.execute(sql`
      SELECT DISTINCT ON (u.id)
        u.id,
        u.first_name,
        u.last_name,
        u.display_name,
        COUNT(DISTINCT pr.id) as ranked_count
      FROM users u
      LEFT JOIN product_rankings pr ON pr.user_id = u.id
      WHERE 
        u.first_name ILIKE ${`%${query}%`}
        OR u.last_name ILIKE ${`%${query}%`}
        OR u.display_name ILIKE ${`%${query}%`}
      GROUP BY u.id, u.first_name, u.last_name, u.display_name
      ORDER BY u.id, ranked_count DESC
      LIMIT ${limit}
    `);
    
    const CommunityService = require('./server/services/CommunityService');
    const communityService = new CommunityService(db);
    
    const users = usersResult.rows.map(user => {
      return {
        id: user.id,
        displayShort: communityService.formatDisplayName(user),
        rankedCount: parseInt(user.ranked_count) || 0,
        type: 'user'
      };
    });
    
    res.json({
      products,
      users
    });
  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Health check endpoint for Cloud Run deployments
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      shopify: shopifyAvailable,
      database: databaseAvailable
    }
  };
  res.status(200).json(health);
});

// Initialize gamification system BEFORE catch-all route if database is available
let gamificationServices = null;
if (databaseAvailable && storage) {
  const initializeGamification = require('./server/init/gamification');
  const { db } = require('./server/db');
  
  // Create shared ProductsService instance
  const ProductsService = require('./server/services/ProductsService');
  const ProductsMetadataService = require('./server/services/ProductsMetadataService');
  const metadataService = new ProductsMetadataService(db);
  
  const productsService = new ProductsService(
    db,
    fetchAllShopifyProducts,
    (products) => metadataService.syncProductsMetadata(products),
    metadataCache,
    rankingStatsCache
  );
  
  initializeGamification(app, io, db, storage, fetchAllShopifyProducts, getRankableProductCount, productsService)
    .then(services => {
      gamificationServices = services;
      console.log('✅ Gamification services available for achievements');
      
      // Initialize tools routes (employee admin only)
      const createToolsRoutes = require('./server/routes/tools');
      const toolsRouter = createToolsRoutes(services);
      app.use('/api/tools', toolsRouter);
      console.log('✅ Tools routes registered at /api/tools');
      
      // Initialize admin routes for achievement management (employee admin only)
      const achievementsAdminRouter = require('./server/routes/admin/achievementsAdmin');
      app.use('/api/admin', achievementsAdminRouter);
      console.log('✅ Admin routes registered at /api/admin');
      
      // Main route - serves SPA for all routes (MUST BE LAST)
      app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
      });
      console.log('✅ Catch-all route registered (serves SPA)');
    })
    .catch(error => {
      console.error('❌ Failed to initialize gamification:', error);
    });
} else {
  // If gamification not available, still need catch-all route
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// Sentry error handling middleware (must be before other error handlers)
if (process.env.SENTRY_DSN && Sentry.Handlers) {
  app.use(Sentry.Handlers.errorHandler());
}

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
const server = httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server successfully started!`);
  console.log(`🥩 Jerky Top N Web server running on http://0.0.0.0:${PORT}`);
  console.log(`Visit the app at: http://localhost:${PORT}`);
  console.log('');
  console.log('📊 Service Status:');
  console.log(`   Shopify Integration: ${shopifyAvailable ? '✅ Available' : '⚠️  Unavailable (missing credentials)'}`);
  console.log(`   Database: ${databaseAvailable ? '✅ Connected' : '⚠️  Unavailable'}`);
  console.log('');
  if (!shopifyAvailable) {
    console.log('⚠️  To enable full functionality, configure these secrets in Deployment settings:');
    console.log('   - SHOPIFY_API_KEY');
    console.log('   - SHOPIFY_API_SECRET');
    console.log('   - SHOPIFY_ADMIN_ACCESS_TOKEN');
  }
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  
  // Report to Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }
  
  // Don't exit immediately in production - log and continue
  if (process.env.NODE_ENV === 'production') {
    console.error('⚠️  Continuing despite error in production mode');
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  
  // Report to Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(reason);
  }
  
  // Don't exit immediately in production - log and continue
  if (process.env.NODE_ENV === 'production') {
    console.error('⚠️  Continuing despite error in production mode');
  }
});