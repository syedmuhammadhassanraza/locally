const rateLimit = require('express-rate-limit');

// Strict limit for Chat AI endpoints to manage Google Gemini usage costs
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many requests to the AI Matchmaker. Please try again after 1 minute.'
  }
});

// Extra strict limit for Auth endpoints to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Max 5 logins/signups per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many sign-in attempts. Please try again in 1 minute.'
  }
});

module.exports = { chatLimiter, authLimiter };
