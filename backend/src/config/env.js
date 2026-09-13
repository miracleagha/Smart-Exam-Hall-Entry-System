const dotenv = require('dotenv');
const path = require('path');

// Load .env file
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const env = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,

  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-hall-entry',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '15m',
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || '7d',

  // AES-256
  AES_SECRET_KEY: process.env.AES_SECRET_KEY,
  AES_IV: process.env.AES_IV,

  // Email (SMTP)
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_SECURE:
    (process.env.SMTP_SECURE || '').toString().toLowerCase() === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'no-reply@smart-hall-entry.local',
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME || 'Smart Hall Entry',

  // Client URLs (used for email links only — CORS is allow-all)
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  STUDENT_CLIENT_URL: process.env.STUDENT_CLIENT_URL || 'http://localhost:5174',

  // Security
  MAX_LOGIN_ATTEMPTS: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5,
  LOCK_TIME_MINUTES: parseInt(process.env.LOCK_TIME_MINUTES, 10) || 30,

  // QR Code
  // Legacy exam-hall QR expiry (hours) — kept for backwards compat.
  QR_EXPIRY_HOURS: parseInt(process.env.QR_EXPIRY_HOURS, 10) || 24,
  // Student identity QR lifetime (days). Defaults to ~1 academic year.
  STUDENT_QR_EXPIRY_DAYS: parseInt(process.env.STUDENT_QR_EXPIRY_DAYS, 10) || 365,

  // Helpers
  isDev() {
    return this.NODE_ENV === 'development';
  },
  isProd() {
    return this.NODE_ENV === 'production';
  },
};

// Validate required env vars in production
if (env.isProd()) {
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'AES_SECRET_KEY', 'AES_IV', 'MONGODB_URI'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = env;
