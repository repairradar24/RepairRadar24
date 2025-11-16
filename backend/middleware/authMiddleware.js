// middleware/auth.js
const jwt = require('jsonwebtoken');
const { getUserDb } = require('../config/userDb');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in .env file");
  process.exit(1); // Stop the server if the secret is missing
}

function authenticateAndGetUserDb(req, res, next) {
  // console.log(req);

  const authHeader = req.headers['authorization'];
  console.log("Auth Header:", authHeader);

  if (!authHeader) {
    console.log("No authorization header provided");
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    console.log("Invalid token format");
    return res.status(401).json({ error: 'Invalid token format' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log("Invalid token");
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.log("Decoded token:", decoded);

    req.user = decoded;
    req.token = token;

    next();
  });
}

module.exports = authenticateAndGetUserDb;
