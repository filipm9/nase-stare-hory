const isProduction = process.env.NODE_ENV === 'production';

// Validate required secrets in production
function requireEnv(name, devDefault = undefined) {
  const value = process.env[name];
  if (!value) {
    if (isProduction) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    if (devDefault === undefined) {
      throw new Error(`Missing required environment variable: ${name} (no dev default)`);
    }
    return devDefault;
  }
  return value;
}

export const config = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database - required in production, dev default for local development
  dbUrl: requireEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/watermeter'),
  
  // JWT & Session - required in production, no insecure defaults
  jwtSecret: requireEnv('JWT_SECRET', isProduction ? undefined : 'dev-only-secret-not-for-production'),
  jwtExpiresIn: '7d',
  sessionName: process.env.SESSION_NAME || 'app_session',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // Cron
  cronSecret: process.env.CRON_SECRET,
  
  // VAS API
  vas: {
    apiUrl: process.env.VAS_API_URL || 'https://crm.vodarenska.cz:65000',
    username: process.env.VAS_USERNAME,
    password: process.env.VAS_PASSWORD,
    clientId: process.env.VAS_CLIENT_ID,
    clientSecret: process.env.VAS_CLIENT_SECRET,
  },
  
  // Email
  resendApiKey: process.env.RESEND_API_KEY,
};
