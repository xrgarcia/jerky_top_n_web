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
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #4F46E5; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0;
          }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Welcome back${customerName ? ', ' + customerName : ''}!</h2>
          <p>Click the button below to securely log in to your Jerky.com Rankings account:</p>
          <a href="${magicLink}" class="button">Log In to Jerky.com</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4F46E5;">${magicLink}</p>
          <p><strong>This link expires in 30 minutes.</strong></p>
          <div class="footer">
            <p>If you didn't request this login, you can safely ignore this email.</p>
            <p>© ${new Date().getFullYear()} Jerky.com. All rights reserved.</p>
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
