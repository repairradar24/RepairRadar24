// routes/userRoutes.js
const express = require('express');
const authenticateAndGetUserDb = require('../middleware/middleware');
const { getUserDb } = require('../config/userDb');
const { getMainDb } = require('../config/mainDb');
const { ObjectId } = require("mongodb");

const router = express.Router();

// Protected route example
router.get('/my-data', authenticateAndGetUserDb, async (req, res) => {
  try {
    // Example: you can use req.userDb to query user's own DB
    // const items = await req.userDb.collection('items').find({}).toArray();

    res.status(200).json({ name: "Hetvik Test Dashboard page" });
  } catch (error) {
    console.error('Error in /my-data route:', error);
    res.status(500).json({ error: 'Server error while fetching data.' });
  }
});

// POST /save-config
router.post("/save-config",authenticateAndGetUserDb, async (req, res) => {
  console.log(req);
  
  const { schema } = req.body;
  const userId = req.user.userId; // from auth middleware

  const mainDbConnection = await getMainDb();

  const userDbConnection = await getUserDb(req.token);
  if (!userDbConnection) {
    console.log("User not found in cached backend map");
    return res.status(401).json({ error: 'Connection timed out' });
  }

  // Save schema to user DB
  await userDbConnection.collection("settings").updateOne(
    { schemaType: "jobCard" },
    { $set: { schema, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  // Mark schemaConfigured = true in main DB
  await mainDbConnection.collection("users").updateOne(
    { _id: new ObjectId(userId) },
    { $set: { schemaConfigured: true } }
  );

  res.status(200).json({ message: "Configuration saved successfully!" });
});

module.exports = router;
