const jwt = require('jsonwebtoken');
const { getDb } = require('../config/db');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in .env file");
  process.exit(1);
}

function authenticateAndAttachDb(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    // console.log("No authorization header provided");
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    // console.log("Invalid token format");
    return res.status(401).json({ error: 'Invalid token format' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log("Invalid token error:", err.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    try {
      req.db = getDb();
    } catch (dbError) {
      console.error("Database access error:", dbError);
      return res.status(500).json({ error: "Server database not ready." });
    }

    req.user = decoded;
    req.token = token;

    next();
  });
}

module.exports = authenticateAndAttachDb;