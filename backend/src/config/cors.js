const cors = require('cors');

// Allow all origins. Reflects the request Origin so browsers accept the
// response even when credentials are included.
const corsOptions = {
  origin: (origin, callback) => callback(null, true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],
  maxAge: 86400, // 24 hours preflight cache
};

module.exports = { corsMiddleware: cors(corsOptions), corsOptions };
