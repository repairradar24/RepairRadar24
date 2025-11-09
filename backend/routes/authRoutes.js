// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { getMainDb } = require('../config/mainDb');
const { connectUserDb } = require('../config/userDb');
const { ObjectId } = require("mongodb");
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

    let isPlanExpired = false;

    if (!user.validity) {
      console.warn(`User ${user.email} has no 'validityEndDate'. Treating as active.`);
    } else {
      const validityDate = new Date(user.validity);

      validityDate.setHours(23, 59, 59, 999);

      isPlanExpired = new Date() > validityDate;
    }


    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        isExpired: isPlanExpired
      },
      JWT_SECRET,
      { expiresIn: '6h' } // Token valid for 6 hours
    );

    connectUserDb(user.dbUrl, token)

    res.status(200).json({
      message: 'Signin successful',
      token,
      user: { name: user.name, email: user.email },
      schemaConfigured: user.schemaConfigured,
      isPlanExpired: isPlanExpired
    });

  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error during signin.' });
  }
});

const extractHeaderToken = (req) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    console.log("No auth header");
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "Invalid token format" });
  }

  // 2️⃣ Verify token
  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

router.put("/update-name", async (req, res) => {
  try {
    const decoded = extractHeaderToken(req);

    const userId = decoded.userId; // signed at login
    if (!userId) {
      return res.status(400).json({ success: false, message: "Invalid token payload" });
    }

    // 3️⃣ Validate input
    const { name } = req.body;
    if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    // 4️⃣ Connect to main DB
    const db = await getMainDb();

    // 5️⃣ Update user
    const result = await db.collection("users").findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { name } },
      { returnDocument: "after" }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 6️⃣ Respond
    return res.status(200).json({
      success: true,
      message: "Business name updated successfully",
      name: result.name
    });
  } catch (err) {
    console.error("Error updating name:", err);
    return res.status(500).json({ success: false, message: "Server error during update" });
  }
});

router.post("/verify-password", async (req, res) => {
  try {

    const decoded = extractHeaderToken(req);

    const { currentPassword } = req.body;
    const userId = decoded.userId; // assuming you have auth middleware
    const db = await getMainDb();
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });

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

// Update password
router.put("/update-password", async (req, res) => {
  try {

    const decoded = extractHeaderToken(req);
    const { password } = req.body;
    const userId = decoded.userId;
    const db = await getMainDb();

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.collection("users").updateOne(
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
