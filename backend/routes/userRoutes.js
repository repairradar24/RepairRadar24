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
router.post("/save-config", authenticateAndGetUserDb, async (req, res) => {
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

router.get("/get-config", authenticateAndGetUserDb, async (req, res) => {
  const userId = req.user.userId; // from auth middleware

  const userDbConnection = await getUserDb(req.token);
  if (!userDbConnection) {
    console.log("User not found in cached backend map");
    return res.status(401).json({ error: 'Connection timed out' });
  }

  if (!userDbConnection) {
    console.log("User not found in cached backend map");
    return res.status(401).json({ error: 'Connection timed out' });
  }

  // Fetch schema from user DB
  const config = await userDbConnection.collection("settings").findOne({ schemaType: "jobCard" });

  if (!config) {
    return res.status(204).json({ error: 'Configuration not found' });
  }

  res.status(200).json(config);
});

router.get("/jobs/count", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection) {
      console.log("User not found in cached backend map");
      return res.status(401).json({ error: 'Connection timed out' });
    }

    const total = await userDbConnection.collection("jobs").countDocuments({});
    console.log("Total jobs count:", total);
    return res.status(200).json({ total });
  } catch (err) {
    console.error("Error getting job count:", err);
    res.status(500).json({ error: "Failed to get job count" });
  }
});

router.get("/jobs/getjobcards", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDb = getUserDb(req.token);
    if (!userDb) {
      return res.status(500).json({ error: "User DB not found" });
    }

    // Pagination params
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;
    if (page < 1) page = 1;

    const skip = (page - 1) * limit;

    // Fetch jobs sorted by latest first
    const jobs = await userDb
      .collection("jobs")
      .find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Check if more jobs exist
    const total = await userDb.collection("jobs").countDocuments();
    const hasMore = skip + jobs.length < total;

    res.json({
      jobs,
      page,
      limit,
      total,
      hasMore,
    });
  } catch (err) {
    console.error("Error fetching jobs:", err);
    res.status(500).json({ error: "Server error while fetching jobs" });
  }
});

router.get("/jobs/list", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection) {
      console.log("User not found in cached backend map");
      return res.status(401).json({ error: 'Connection timed out' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const jobs = await userDbConnection
      .collection("jobs")
      .find({})
      .skip(skip)
      .limit(limit)
      .toArray();

    res.json({ jobs });
  } catch (err) {
    console.error("Error getting jobs list:", err);
    res.status(500).json({ error: "Failed to get jobs list" });
  }
});

router.post("/jobs/savejobcard", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection) {
      console.log("User not found in cached backend map");
      return res.status(401).json({ error: 'Connection timed out' });
    }

    const jobsCollection = userDbConnection.collection("jobs");

    const newJob = req.body;

    const lastJob = await jobsCollection.findOne(
      {},
      { sort: { jobNo: -1 } }
    );
    const nextJobNo = lastJob ? lastJob.jobNo + 1 : 1;

    newJob.jobNo = nextJobNo;
    newJob.createdAt = new Date();

    await jobsCollection.insertOne(newJob);

    res.json({
      success: true,
      message: "Job saved successfully",
      jobNo: nextJobNo,
    });
  } catch (err) {
    console.error("Error saving job:", err);
    res.status(500).json({ success: false, message: "Failed to save job" });
  }
});


module.exports = router;
