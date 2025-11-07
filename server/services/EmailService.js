const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.fromAddress = 'no-reply@jerky.com';
    this.initialize();
  }

  initialize() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT, 10);
    const password = process.env.EMAIL_PASSWORD;

    if (!host || !port || !password) {
      console.warn('⚠️  Email service not configured - missing SMTP credentials');
      console.warn('   Required: SMTP_HOST, SMTP_PORT, EMAIL_PASSWORD');
      this.initialized = false;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: port === 465,
        auth: {
          user: this.fromAddress,
          pass: password
        }
      });

      this.initialized = true;
      console.log(`✅ Email service initialized: ${this.fromAddress} via ${host}:${port}`);
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error.message);
      this.initialized = false;
    }
  }

  async sendEmail({ to, subject, text, html }) {
    if (!this.initialized) {
      throw new Error('Email service not initialized - check SMTP configuration');
    }

    try {
      const mailOptions = {
        from: `Jerky.com <${this.fromAddress}>`,
        to: to,
        subject: subject,
        text: text,
        html: html
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Email sent to ${to}: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId
      };
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);
      throw error;
    }
  }

  async sendMagicLink({ to, magicLink, customerName }) {
    const subject = 'Login to Jerky.com Rankings';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; 
            color: #333; 
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .email-wrapper {
            background-color: #f5f5f5;
            padding: 40px 20px;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: #2c2c2c;
            padding: 30px 40px;
            text-align: center;
          }
          .logo {
            max-width: 200px;
            height: auto;
            margin-bottom: 10px;
          }
          .content {
            padding: 40px;
          }
          h2 {
            color: #1a1a1a;
            font-size: 24px;
            margin: 0 0 20px 0;
            font-weight: 600;
          }
          p {
            color: #555;
            margin: 0 0 15px 0;
            font-size: 16px;
          }
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          .button { 
            display: inline-block; 
            padding: 16px 40px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important; 
            text-decoration: none; 
            border-radius: 50px; 
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            transition: all 0.3s ease;
          }
          .link-container {
            background-color: #f8f9fa;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
          }
          .link-text {
            word-break: break-all; 
            color: #667eea;
            font-size: 14px;
            margin: 0;
          }
          .expiry {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .expiry p {
            margin: 0;
            color: #856404;
            font-weight: 500;
          }
          .footer { 
            background-color: #f8f9fa;
            padding: 30px 40px;
            text-align: center;
            border-top: 1px solid #e9ecef;
          }
          .footer p {
            font-size: 13px;
            color: #6c757d;
            margin: 5px 0;
          }
          .security-note {
            font-size: 14px;
            color: #6c757d;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <img src="https://www.jerky.com/cdn/shop/files/jerky_logo_aeed54c0-3f7f-462d-93c3-785b3c97af9d_300x.png?v=1678208718" alt="Jerky.com Logo" class="logo">
            </div>
            <div class="content">
              <h2>Welcome back${customerName ? ', ' + customerName : ', Customer'}!</h2>
              <p>Click the button below to securely log in to your Jerky.com Rankings account:</p>
              
              <div class="button-container">
                <a href="${magicLink}" class="button">🥩 Log In to Your Account</a>
              </div>
              
              <div class="expiry">
                <p>⏱️ This link expires in 30 minutes for your security</p>
              </div>
              
              <p style="margin-top: 25px;">Or copy and paste this link into your browser:</p>
              <div class="link-container">
                <p class="link-text">${magicLink}</p>
              </div>
              
              <p class="security-note">If you didn't request this login, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p><strong>Jerky.com Rankings</strong></p>
              <p>© ${new Date().getFullYear()} Jerky.com. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Welcome back${customerName ? ', ' + customerName : ''}!

Click this link to log in to your Jerky.com Rankings account:
${magicLink}

This link expires in 30 minutes.

If you didn't request this login, you can safely ignore this email.

© ${new Date().getFullYear()} Jerky.com. All rights reserved.
    `.trim();

    return await this.sendEmail({ to, subject, html, text });
  }

  async sendBulkImportCompletionEmail({ stats, mode, batchSize }) {
    const environment = process.env.NODE_ENV === 'production' ? 'Production' : 'Development';
    const to = 'ray@jerky.com';
    const subject = `[${environment}] Bulk Import Complete - ${stats.usersCreated} Users Created`;
    
    const duration = stats.completedAt && stats.startedAt 
      ? Math.round((new Date(stats.completedAt) - new Date(stats.startedAt)) / 1000)
      : 'N/A';
    
    const statusColor = stats.errors > 0 ? '#ffc107' : '#28a745';
    const statusIcon = stats.errors > 0 ? '⚠️' : '✅';
    const statusText = stats.errors > 0 ? 'Completed with Warnings' : 'Successfully Completed';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6; 
            color: #333; 
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .email-wrapper {
            background-color: #f5f5f5;
            padding: 40px 20px;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: ${statusColor};
            padding: 30px 40px;
            text-align: center;
            color: white;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
          }
          .content {
            padding: 40px;
          }
          .status-banner {
            background-color: ${statusColor}15;
            border-left: 4px solid ${statusColor};
            padding: 15px 20px;
            margin: 0 0 30px 0;
            border-radius: 4px;
          }
          .status-banner h2 {
            margin: 0 0 5px 0;
            color: ${statusColor};
            font-size: 20px;
          }
          .status-banner p {
            margin: 0;
            color: #666;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 25px 0;
          }
          .stat-card {
            background-color: #f8f9fa;
            border-radius: 6px;
            padding: 15px;
            text-align: center;
          }
          .stat-value {
            font-size: 32px;
            font-weight: 700;
            color: #1a1a1a;
            margin: 0 0 5px 0;
          }
          .stat-label {
            font-size: 14px;
            color: #6c757d;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .details-section {
            margin: 30px 0;
          }
          .details-section h3 {
            font-size: 18px;
            color: #1a1a1a;
            margin: 0 0 15px 0;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 10px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #f1f3f5;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            color: #6c757d;
            font-weight: 500;
          }
          .detail-value {
            color: #1a1a1a;
            font-weight: 600;
          }
          .footer { 
            background-color: #f8f9fa;
            padding: 30px 40px;
            text-align: center;
            border-top: 1px solid #e9ecef;
          }
          .footer p {
            font-size: 13px;
            color: #6c757d;
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <h1>${statusIcon} Bulk Import Complete</h1>
            </div>
            <div class="content">
              <div class="status-banner">
                <h2>${statusText}</h2>
                <p>Environment: <strong>${environment}</strong> | Mode: <strong>${mode || 'full'}</strong></p>
              </div>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-value">${stats.customersFetched || 0}</div>
                  <div class="stat-label">Customers Fetched</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${stats.usersCreated || 0}</div>
                  <div class="stat-label">New Users Created</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${stats.usersUpdated || 0}</div>
                  <div class="stat-label">Existing Users Updated</div>
                </div>
                <div class="stat-card">
                  <div class="stat-value">${stats.jobsEnqueued || 0}</div>
                  <div class="stat-label">Jobs Enqueued</div>
                </div>
              </div>

              <div class="details-section">
                <h3>📋 Import Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Mode</span>
                  <span class="detail-value">${mode === 'full' ? 'Full Import (Create New)' : mode === 'reprocess' ? 'Re-processing (Existing)' : 'Legacy'}</span>
                </div>
                ${batchSize ? `
                <div class="detail-row">
                  <span class="detail-label">Target Batch Size</span>
                  <span class="detail-value">${batchSize}</span>
                </div>
                ` : ''}
                <div class="detail-row">
                  <span class="detail-label">Duration</span>
                  <span class="detail-value">${duration !== 'N/A' ? `${duration}s` : duration}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Errors</span>
                  <span class="detail-value" style="color: ${stats.errors > 0 ? '#dc3545' : '#28a745'};">${stats.errors || 0}</span>
                </div>
              </div>

              ${stats.alreadyInDB ? `
              <div class="details-section">
                <h3>📊 Additional Stats</h3>
                <div class="detail-row">
                  <span class="detail-label">Already in Database</span>
                  <span class="detail-value">${stats.alreadyInDB}</span>
                </div>
                ${stats.notInDB ? `
                <div class="detail-row">
                  <span class="detail-label">Not in Database</span>
                  <span class="detail-value">${stats.notInDB}</span>
                </div>
                ` : ''}
                ${stats.jobsPendingEnqueue ? `
                <div class="detail-row">
                  <span class="detail-label">Jobs Pending Enqueue</span>
                  <span class="detail-value">${stats.jobsPendingEnqueue}</span>
                </div>
                ` : ''}
              </div>
              ` : ''}

              <div class="details-section">
                <h3>⏰ Timestamps</h3>
                <div class="detail-row">
                  <span class="detail-label">Started</span>
                  <span class="detail-value">${stats.startedAt ? new Date(stats.startedAt).toLocaleString() : 'N/A'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Completed</span>
                  <span class="detail-value">${stats.completedAt ? new Date(stats.completedAt).toLocaleString() : 'N/A'}</span>
                </div>
              </div>
            </div>
            <div class="footer">
              <p><strong>Jerky.com Rankings - Bulk Import System</strong></p>
              <p>© ${new Date().getFullYear()} Jerky.com. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
BULK IMPORT COMPLETE - ${statusText}

Environment: ${environment}
Mode: ${mode || 'full'}
${batchSize ? `Target Batch Size: ${batchSize}` : ''}

STATISTICS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Customers Fetched: ${stats.customersFetched || 0}
• New Users Created: ${stats.usersCreated || 0}
• Existing Users Updated: ${stats.usersUpdated || 0}
• Jobs Enqueued: ${stats.jobsEnqueued || 0}
• Errors: ${stats.errors || 0}
${stats.alreadyInDB ? `• Already in Database: ${stats.alreadyInDB}` : ''}
${stats.notInDB ? `• Not in Database: ${stats.notInDB}` : ''}

TIMING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Started: ${stats.startedAt ? new Date(stats.startedAt).toLocaleString() : 'N/A'}
• Completed: ${stats.completedAt ? new Date(stats.completedAt).toLocaleString() : 'N/A'}
• Duration: ${duration !== 'N/A' ? `${duration}s` : duration}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
© ${new Date().getFullYear()} Jerky.com. All rights reserved.
    `.trim();

    try {
      await this.sendEmail({ to, subject, html, text });
      console.log(`📧 Bulk import completion email sent to ${to}`);
    } catch (error) {
      console.error('⚠️ Failed to send bulk import completion email:', error.message);
      // Don't throw - email failures shouldn't block the import completion
    }
  }

  isInitialized() {
    return this.initialized;
  }
}

module.exports = new EmailService();
