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
      return res.status(401).json({ error: "Connection timed out" });
    }

    const jobsCollection = userDbConnection.collection("jobs");
    const customersDataCollection = userDbConnection.collection("customer_phones");

    const newJob = req.body;

    // Generate job number
    const lastJob = await jobsCollection.findOne({}, { sort: { job_no: -1 } });
    const nextJobNo = lastJob ? lastJob.job_no + 1 : 1;

    newJob.job_no = nextJobNo;
    newJob.createdAt = new Date();

    // Save jobcard first (main operation)
    await jobsCollection.insertOne(newJob);

    // Send response immediately (non-blocking)
    res.json({
      success: true,
      message: "Job saved successfully",
      job_no: nextJobNo,
    });

    // 🔄 Run customer phone save in background (async)
    const { customer_name, customer_phone } = newJob;
    if (customer_phone && customer_name) {
      // no await here — fire-and-forget
      (async () => {
        try {
          await customersDataCollection.updateOne(
            { customer_phone : customer_phone },
            { $set: { customer_name: customer_name } },
            { upsert: true }
          );
        } catch (err) {
          console.error("Async customer save failed:", err);
        }
      })();
    }

  } catch (err) {
    console.error("Error saving job:", err);
    res.status(500).json({ success: false, message: "Failed to save job" });
  }
});

router.get("/jobs/getjobcard/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection) return res.status(401).json({ error: "Connection timed out" });

    const jobsCollection = userDbConnection.collection("jobs");
    const job = await jobsCollection.findOne({ _id: new ObjectId(req.params.id) });

    if (!job) return res.status(404).json({ error: "Job not found" });

    res.json({ job });
  } catch (err) {
    console.error("Error fetching job:", err);
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

router.put("/jobs/updatejobcard/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection) return res.status(401).json({ error: "Connection timed out" });

    const jobsCollection = userDbConnection.collection("jobs");
    const { _id, job_no, ...updates } = req.body; // prevent changing job_no

    const result = await jobsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) return res.status(404).json({ error: "Job not found" });

    res.json({ success: true, message: "Job updated successfully" });
  } catch (err) {
    console.error("Error updating job:", err);
    res.status(500).json({ error: "Failed to update job" });
  }
});

router.get("/whatsapp/get-messages", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection)
      return res.status(401).json({ error: "Connection timed out" });

    const messages = await userDbConnection
      .collection("whatsapp_messages")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(messages);
  } catch (err) {
    console.error("Error fetching WhatsApp messages:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/whatsapp/create-message", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection) return res.status(401).json({ error: "Connection timed out" });

    const { name, text } = req.body;

    if (!name || !text) {
      return res.status(400).json({ error: "Name and text are required." });
    }

    // const db = await getMainDb();
    await userDbConnection.collection("whatsapp_messages").insertOne({
      name,
      text,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({
      message: "Message created successfully",
      data: { name, text },
    });
  } catch (err) {
    console.error("Error creating WhatsApp message:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.put("/whatsapp/update-message/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection)
      return res.status(401).json({ error: "Connection timed out" });

    const { id } = req.params;
    const { name, text } = req.body;

    if (!name || !text)
      return res.status(400).json({ error: "Name and text are required." });

    const result = await userDbConnection
      .collection("whatsapp_messages")
      .updateOne(
        { _id: new ObjectId(id) },
        { $set: { name, text, updatedAt: new Date() } }
      );

    if (result.matchedCount === 0)
      return res.status(404).json({ error: "Message not found." });

    res.status(200).json({ message: "Message updated successfully." });
  } catch (err) {
    console.error("Error updating WhatsApp message:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});


router.delete("/whatsapp/delete-message/:id", authenticateAndGetUserDb, async (req, res) => {
  try {
    const userDbConnection = await getUserDb(req.token);
    if (!userDbConnection)
      return res.status(401).json({ error: "Connection timed out" });

    const { id } = req.params;

    const result = await userDbConnection
      .collection("whatsapp_messages")
      .deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0)
      return res.status(404).json({ error: "Message not found." });

    res.status(200).json({ message: "Message deleted successfully." });
  } catch (err) {
    console.error("Error deleting WhatsApp message:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});


module.exports = router;
