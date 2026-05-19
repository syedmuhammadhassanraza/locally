const rateLimitCache = {};

const rateLimit = (limit = 100, windowMs = 60000) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimitCache[ip]) {
      rateLimitCache[ip] = { count: 1, resetTime: now + windowMs };
      return next();
    }

    const client = rateLimitCache[ip];

    if (now > client.resetTime) {
      client.count = 1;
      client.resetTime = now + windowMs;
      return next();
    }

    client.count++;
    if (client.count > limit) {
      return res.status(429).json({
        message: 'Too many requests from this IP, please try again later.'
      });
    }

    next();
  };
};

module.exports = { rateLimit };
