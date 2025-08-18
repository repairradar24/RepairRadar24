// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { getMainDb } = require('../config/mainDb');
const { connectUserDb } = require('../config/userDb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'repairradar_secret_key'; // Replace with secure key or use .env in production

// POST /api/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields are required.' });

    const db = await getMainDb();

    // Check if email already exists
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser)
      return res.status(409).json({ error: 'Email already registered.' });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await db.collection('users').insertOne({
      name,
      email,
      password: hashedPassword,
      validity: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days free validity in milliseconds
      dbUrl: "",
      schemaConfigured: false
    });

    res.status(201).json({
      message: 'User registered successfully',
      userId: result.insertedId
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup.' });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const db = await getMainDb();
    const user = await db.collection('users').findOne({ email });

    if (!user)
      return res.status(404).json({ error: 'No user found with this email.' });

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(401).json({ error: 'Invalid password.' });

    if (user.dbUrl === "") {
      res.status(204).json({ error: 'No database URL found for this user.' });
      return;
    }


    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '6h' } // Token valid for 6 hours
    );

    connectUserDb(user.dbUrl, token)

    res.status(200).json({
      message: 'Signin successful',
      token,
      user: { name: user.name, email: user.email },
      schemaConfigured: user.schemaConfigured
    });

  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error during signin.' });
  }
});

module.exports = router;
