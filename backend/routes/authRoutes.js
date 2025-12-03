const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');
const authenticateAndAttachDb = require('../middleware/authMiddleware.js');

const { ObjectId } = require("mongodb");
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in .env file");
  process.exit(1);
}

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields are required.' });

    const db = getDb();

    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser)
      return res.status(409).json({ error: 'Email already registered.' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.collection('users').insertOne({
      name,
      email,
      password: hashedPassword,
      validity: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days free
      schemaConfigured: true,
      createdAt: new Date()
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

    const db = getDb();
    const user = await db.collection('users').findOne({ email });

    if (!user)
      return res.status(404).json({ error: 'No user found with this email.' });

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(401).json({ error: 'Invalid password.' });

    let isPlanExpired = false;
    let validityDate = new Date();

    if (!user.validity) {
      console.warn(`User ${user.email} has no 'validityEndDate'. Treating as active.`);
    } else {
      validityDate = new Date(user.validity);
      validityDate.setHours(23, 59, 59, 999);
      isPlanExpired = new Date() > validityDate;
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        isExpired: isPlanExpired
      },
      JWT_SECRET,
      { expiresIn: '6h' }
    );

    res.status(200).json({
      message: 'Signin successful',
      token,
      user: { name: user.name, email: user.email },
      schemaConfigured: user.schemaConfigured,
      isPlanExpired: isPlanExpired,
      planValidity: validityDate
    });

  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error during signin.' });
  }
});

router.put("/update-name", authenticateAndAttachDb, async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.userId;

    if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const result = await req.db.collection("users").findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { name } },
      { returnDocument: "after" }
    );

    if (!result || !result.value) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Business name updated successfully",
      name: result.value.name
    });
  } catch (err) {
    console.error("Error updating name:", err);
    return res.status(500).json({ success: false, message: "Server error during update" });
  }
});

router.post("/verify-password", authenticateAndAttachDb, async (req, res) => {
  try {
    const { currentPassword } = req.body;
    const userId = req.user.userId;

    const user = await req.db.collection("users").findOne({ _id: new ObjectId(userId) });

    if (!user) return res.status(404).json({ error: "User not found" });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (match) {
      return res.status(200).json({ verified: true });
    } else {
      return res.status(401).json({ verified: false });
    }
  } catch (err) {
    console.error("Error verifying password:", err);
    res.status(500).json({ message: "Error verifying password" });
  }
});

router.put("/update-password", authenticateAndAttachDb, async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.user.userId;

    const hashedPassword = await bcrypt.hash(password, 10);

    await req.db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: hashedPassword } }
    );

    res.status(200).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Error verifying password:", err);
    res.status(500).json({ message: "Error updating password" });
  }
});

module.exports = router;