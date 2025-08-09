// middleware/auth.js
const jwt = require('jsonwebtoken');
const { getUserDb } = require('../config/userDb');

const JWT_SECRET = "repairradar_secret_key"; // You can hardcode for now

function authenticateAndGetUserDb(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Invalid token format' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });

    const userDb = getUserDb(token);
    if (!userDb) {
      return res.status(401).json({ error: 'Connection timed out' });
    }

    req.user = decoded;
    req.userDb = userDb; // Attach DB connection for route handlers
    req.token = token;

    next();
  });
}

module.exports = authenticateAndGetUserDb;
