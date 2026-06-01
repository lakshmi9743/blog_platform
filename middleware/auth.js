const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'premium_blogging_platform_jwt_secret_token_2026_key';

module.exports = (req, res, next) => {
  // Get token from header
  const authHeader = req.header('Authorization');
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // If no token, return 401
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No authentication token provided.' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is invalid or has expired.' });
  }
};
