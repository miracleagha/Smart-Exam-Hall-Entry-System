const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * SMTP-based email service.
 *
 * If SMTP_HOST/USER/PASS are missing, we skip sending and log the email
 * body to the console instead — useful for local development where a
 * live SMTP server may not be configured.
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this._init();
  }

  _init() {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE, // true for 465, false for 587/others
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });

      // Fire-and-forget verify so a misconfigured SMTP surfaces early in logs
      // without blocking startup.
      this.transporter.verify().then(
        () => logger.info(`SMTP transport ready (${env.SMTP_HOST}:${env.SMTP_PORT})`),
        (err) => logger.error(`SMTP verify failed: ${err.message}`)
      );

      this.isConfigured = true;
    } else {
      logger.warn(
        'SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing). Emails will be logged to console.'
      );
    }
  }

  async _sendMail(to, subject, html) {
    if (!this.isConfigured) {
      logger.info('EMAIL (console fallback):');
      logger.info(`  To: ${to}`);
      logger.info(`  Subject: ${subject}`);
      logger.info(`  Body preview: ${html.substring(0, 200)}...`);
      return { id: 'console-fallback' };
    }

    const fromAddress = env.EMAIL_FROM_NAME
      ? `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM}>`
      : env.EMAIL_FROM;

    try {
      const info = await this.transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
      });
      logger.info(`Email sent to ${to}: ${subject} (messageId: ${info.messageId})`);
      return info;
    } catch (error) {
      // Don't throw — email failures should not break the operation that triggered them.
      logger.error(`Email failed to ${to}: ${error.message}`);
      return null;
    }
  }

  async sendWelcomeEmail(to, firstName, institutionName) {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #3B82F6; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Smart Hall Entry System</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2>Welcome, ${firstName}!</h2>
          <p>Your institution <strong>${institutionName}</strong> has been successfully registered.</p>
          <p>You can now:</p>
          <ul>
            <li>Add students to your institution</li>
            <li>Create and manage exams</li>
            <li>Scan student identity QR codes for exam verification</li>
            <li>Track attendance in real-time</li>
          </ul>
          <a href="${env.CLIENT_URL}" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 16px;">Go to Dashboard</a>
        </div>
        <div style="padding: 16px; text-align: center; color: #888; font-size: 12px;">
          &copy; ${new Date().getFullYear()} Smart Hall Entry System
        </div>
      </div>
    `;
    return this._sendMail(to, 'Welcome to Smart Hall Entry System', html);
  }

  async sendStudentCredentials(to, firstName, username, password, institutionName = '') {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #10B981; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Your Student Account</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2>Hello, ${firstName}!</h2>
          <p>${institutionName ? `<strong>${institutionName}</strong> has created` : 'Your institution has created'} a student account for you on the Smart Hall Entry System. Use the credentials below to sign in.</p>
          <div style="background: white; border: 2px solid #e5e7eb; padding: 20px; margin: 16px 0;">
            <p><strong>Username:</strong> <code style="background: #f3f4f6; padding: 2px 8px;">${username}</code></p>
            <p><strong>Temporary Password:</strong> <code style="background: #f3f4f6; padding: 2px 8px;">${password}</code></p>
          </div>
          <p style="color: #ef4444;"><strong>Important:</strong> Please change your password after your first login. After signing in, generate and download your identity QR code from the "My QR Code" section so you can present it at exam halls.</p>
          <a href="${env.STUDENT_CLIENT_URL}" style="display: inline-block; background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 16px;">Login Now</a>
        </div>
        <div style="padding: 16px; text-align: center; color: #888; font-size: 12px;">
          &copy; ${new Date().getFullYear()} Smart Hall Entry System
        </div>
      </div>
    `;
    return this._sendMail(to, 'Your Student Login Credentials', html);
  }

  async sendPasswordResetEmail(to, firstName, resetUrl) {
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #F59E0B; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">Password Reset</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2>Hello, ${firstName}!</h2>
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <a href="${resetUrl}" style="display: inline-block; background: #F59E0B; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 16px;">Reset Password</a>
          <p style="margin-top: 20px; color: #888; font-size: 14px;">This link expires in 30 minutes. If you didn't request this, please ignore this email.</p>
        </div>
        <div style="padding: 16px; text-align: center; color: #888; font-size: 12px;">
          &copy; ${new Date().getFullYear()} Smart Hall Entry System
        </div>
      </div>
    `;
    return this._sendMail(to, 'Password Reset Request', html);
  }

  async sendVerificationAlert(to, studentName, examTitle, status) {
    const bgColor = status === 'verified' ? '#10B981' : '#EF4444';
    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${bgColor}; padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">Verification ${status === 'verified' ? 'Success' : 'Alert'}</h2>
        </div>
        <div style="padding: 20px; background: #f9f9f9;">
          <p>Student <strong>${studentName}</strong> was <strong>${status}</strong> for exam <strong>${examTitle}</strong>.</p>
          <p style="color: #888; font-size: 14px;">Time: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;
    return this._sendMail(to, `Verification ${status}: ${studentName}`, html);
  }
}

module.exports = new EmailService();
