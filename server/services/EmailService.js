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

  isInitialized() {
    return this.initialized;
  }
}

module.exports = new EmailService();
